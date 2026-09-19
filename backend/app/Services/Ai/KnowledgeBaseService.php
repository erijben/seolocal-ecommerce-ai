<?php

namespace App\Services\Ai;

use App\Models\KnowledgeChunk;
use App\Models\KnowledgeDocument;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;
class KnowledgeBaseService
{
    private const CHUNK_SIZE = 900;
    private const CHUNK_OVERLAP = 150;
   

public function __construct(
    private PdfTextExtractorService $pdfTextExtractorService
) {
}

    //Cette méthode crée un document complet dans knowledge-document
    public function createDocument(array $data, ?int $userId = null): KnowledgeDocument
    {
        return DB::transaction(function () use ($data, $userId) {
            $document = KnowledgeDocument::create([
                'title' => $data['title'],
                'type' => $data['type'] ?? 'other',
                'content' => $data['content'],
                'status' => $data['status'] ?? 'active',
                'created_by' => $userId,
            ]);
 
            //elle appelle
            $this->rebuildChunks($document); //c a dire Donc dès qu’un document est créé, Laravel le découpe automatiquement en morceaux.

            return $document->load('chunks');
        });
    }


    public function createDocumentFromPdf(
    UploadedFile $file,
    array $data,
    ?int $userId = null
): KnowledgeDocument {
    $path = $file->store('knowledge-documents', 'local');

    try {
        $absolutePath = Storage::disk('local')->path($path);

        $content = $this->pdfTextExtractorService->extract($absolutePath);

        if (mb_strlen($content) < 50) {
            throw ValidationException::withMessages([
                'file' => 'Le texte extrait du PDF est trop court. Le fichier est peut-être scanné comme image ou protégé.',
            ]);
        }

        return DB::transaction(function () use ($file, $data, $userId, $path, $content) {
            $title = $data['title']
                ?? pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);

            $document = KnowledgeDocument::create([
                'title' => $title,
                'type' => $data['type'] ?? 'other',
                'content' => $content,
                'status' => $data['status'] ?? 'active',
                'created_by' => $userId,

                'original_filename' => $file->getClientOriginalName(),
                'file_path' => $path,
                'mime_type' => $file->getMimeType(),
                'file_size' => $file->getSize(),
                'extraction_status' => 'success',
                'extraction_error' => null,
                'ai_index_status' => 'pending',
                'ai_index_error' => null,
            ]);

            $this->rebuildChunks($document);

            return $document->load('chunks');
        });
    } catch (Throwable $exception) {
        Storage::disk('local')->delete($path);

        throw ValidationException::withMessages([
            'file' => 'Impossible d’extraire correctement le texte du PDF. Vérifie que le PDF contient du texte sélectionnable et qu’il n’est pas protégé.',
        ]);
    }
}

    public function updateDocument(KnowledgeDocument $document, array $data): KnowledgeDocument
    {
        return DB::transaction(function () use ($document, $data) {
            $document->update([
                'title' => $data['title'] ?? $document->title,
                'type' => $data['type'] ?? $document->type,
                'content' => $data['content'] ?? $document->content,
                'status' => $data['status'] ?? $document->status,
            ]);

            $this->rebuildChunks($document);

            return $document->fresh()->load('chunks');
        });
    }

    //supprime les anciens chunks du document, puis recrée les nouveaux.
    /*C’est important parce qu’un RAG ne cherche pas dans tout le document d’un coup. 
    Il cherche dans des petits passages.*/
    public function rebuildChunks(KnowledgeDocument $document): void
    {
        $document->chunks()->delete();

        $chunks = $this->splitTextIntoChunks($document->content);

        foreach ($chunks as $index => $chunkContent) {
            KnowledgeChunk::create([
                'knowledge_document_id' => $document->id,
                'chunk_index' => $index,
                'content' => $chunkContent,
                'metadata' => [
                    'document_title' => $document->title,
                    'document_type' => $document->type,
                    'chunk_length' => mb_strlen($chunkContent),
                ],
            ]);
        }
    }


    //reçoit une question Puis elle cherche les chunks les plus pertinents.
  
public function search(string $query, int $limit = 5): array
{
    $queryTokens = $this->tokenize($query);

    if (empty($queryTokens)) {
        return [];
    }

    $chunks = KnowledgeChunk::query()
        ->with('document')
        ->whereHas('document', function ($documentQuery) {
            $documentQuery->where('status', 'active');
        })
        ->get();

    return $chunks
        ->map(function (KnowledgeChunk $chunk) use ($queryTokens, $query) {
            return [
                'chunk_id' => $chunk->id,
                'document_id' => $chunk->knowledge_document_id,
                'document_title' => $chunk->document?->title,
                'document_type' => $chunk->document?->type,
                'chunk_index' => $chunk->chunk_index,
                'content' => $chunk->content,
                'score' => $this->calculateScore(
                    query: $query,
                    queryTokens: $queryTokens,
                    chunk: $chunk
                ),
            ];
        })
        ->filter(fn (array $item) => $item['score'] >= 2)
        ->sortByDesc('score')
        ->take($limit)
        ->values()
        ->toArray();
}

    //prépare le contexte à donner à l’agent IA.
    public function buildRagContext(string $query, int $limit = 5): array
    {
        $results = $this->search($query, $limit);

        return [
            'status' => count($results) > 0 ? 'ok' : 'empty',
            'query' => $query,
            'chunks_count' => count($results),
            'chunks' => $results,
            'context_text' => collect($results)
                ->map(function (array $item, int $index) {
                    $number = $index + 1;

                    return "[Source {$number}] {$item['document_title']} ({$item['document_type']})\n"
                        . $item['content'];
                })
                ->implode("\n\n---\n\n"),
        ];
    }

    private function splitTextIntoChunks(string $text): array
    {
        $cleanText = trim(preg_replace('/\s+/', ' ', $text));

        if ($cleanText === '') {
            return [];
        }

        $chunks = [];
        $length = mb_strlen($cleanText);
        $start = 0;

        while ($start < $length) {
            $chunk = mb_substr($cleanText, $start, self::CHUNK_SIZE);

            $chunks[] = trim($chunk);

            $start += self::CHUNK_SIZE - self::CHUNK_OVERLAP;
        }

        return array_values(array_filter($chunks));
    }

    private function calculateScore(
        string $query,
        array $queryTokens,
        KnowledgeChunk $chunk
    ): float {
        $score = 0;
        $content = $this->normalize($chunk->content);
        $title = $this->normalize($chunk->document?->title ?? '');
        $type = $this->normalize($chunk->document?->type ?? '');
        $normalizedQuery = $this->normalize($query);

        foreach ($queryTokens as $token) {
            if (str_contains($content, $token)) {
                $score += 2;
            }

            if (str_contains($title, $token)) {
                $score += 3;
            }

            if (str_contains($type, $token)) {
                $score += 1;
            }
        }

        if (str_contains($content, $normalizedQuery)) {
            $score += 8;
        }

        return $score;
    }

    private function tokenize(string $text): array
    {
        $text = $this->normalize($text);

        $tokens = preg_split('/\s+/', $text);

        $stopWords = [
            'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd',
            'a', 'à', 'au', 'aux', 'et', 'ou', 'en', 'pour', 'par',
            'sur', 'dans', 'avec', 'sans', 'est', 'sont', 'notre',
            'nos', 'mon', 'ma', 'mes', 'ce', 'cette', 'ces', 'quel',
            'quelle', 'quels', 'quelles', 'comment', 'quoi', 'doit', 'doivent', 'être', 'etre', 'peut', 'peuvent',
'quand', 'lorsque', 'avant', 'après', 'apres',
        ];

        return collect($tokens)
            ->filter(fn ($token) => mb_strlen($token) >= 2)
            ->reject(fn ($token) => in_array($token, $stopWords, true))
            ->unique()
            ->values()
            ->toArray();
    }
    



private function normalize(string $text): string
{
    $text = str($text)
        ->lower()
        ->ascii()
        ->toString();

    $text = preg_replace('/[^a-z0-9\s]/', ' ', $text);
    $text = preg_replace('/\s+/', ' ', $text);

    return trim($text);
}
}

