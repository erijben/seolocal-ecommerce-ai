<?php

namespace App\Console\Commands;

use App\Models\KnowledgeDocument;
use App\Services\Ai\Microservice\AiMicroserviceClient;
use App\Services\Ai\Microservice\KnowledgeDocumentSyncService;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;

class SyncKnowledgeDocumentsToAiMicroservice extends Command
{
    protected $signature = 'ai:sync-knowledge-documents
        {--document= : Synchroniser uniquement cet ID Laravel}
        {--limit=0 : Nombre maximal de documents à traiter}
        {--dry-run : Afficher les documents sans les envoyer}';

    protected $description = (
        'Synchronise les PDF Laravel avec le '
        .'microservice IA sémantique'
    );

    public function __construct(
        private KnowledgeDocumentSyncService $syncService,
        private AiMicroserviceClient $client
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        if (function_exists('set_time_limit')) {
    set_time_limit(0);
    }
        $dryRun = (bool) $this->option('dry-run');
        $documentOption = $this->option('document');
        $limit = (int) $this->option('limit');

        if (
            $documentOption !== null
            && (
                ! is_string($documentOption)
                || ! ctype_digit($documentOption)
            )
        ) {
            $this->error(
                'L’option --document doit contenir un ID numérique.'
            );

            return self::FAILURE;
        }

        if ($limit < 0) {
            $this->error(
                'L’option --limit doit être positive ou égale à zéro.'
            );

            return self::FAILURE;
        }

        if (
            ! $dryRun
            && ! $this->client->isEnabled()
        ) {
            $this->error(
                'Le microservice IA est désactivé. '
                .'Utilisez d’abord --dry-run ou activez '
                .'AI_MICROSERVICE_ENABLED.'
            );

            return self::FAILURE;
        }

        if (
            ! $dryRun
            && ! $this->client->isConfigured()
        ) {
            $this->error(
                'Le microservice IA n’est pas correctement configuré.'
            );

            return self::FAILURE;
        }

        $documents = $this->documentsToSynchronize(
            documentOption: $documentOption,
            limit: $limit,
        );

        if ($documents->isEmpty()) {
            $this->info(
                'Aucun document PDF ne nécessite de synchronisation.'
            );

            return self::SUCCESS;
        }

        $this->table(
            [
                'ID Laravel',
                'Titre',
                'Fichier',
                'Statut IA',
            ],
            $documents->map(
                fn (KnowledgeDocument $document) => [
                    $document->id,
                    $document->title,
                    $document->original_filename
                        ?: basename($document->file_path),
                    $document->ai_index_status ?? 'non indexé',
                ]
            )->all()
        );

        if ($dryRun) {
            $this->info(
                'Mode dry-run : aucun appel distant effectué.'
            );

            return self::SUCCESS;
        }

        $successCount = 0;
        $failureCount = 0;

        foreach ($documents as $document) {
            $requestId = (string) Str::uuid();

            $result = $this->syncService->indexDocument(
                document: $document,
                requestId: $requestId,
            );

            $status = data_get($result, 'status');

            if (in_array(
    $status,
    [
        'ok',
        'recovered',
        'already_indexed',
    ],
    true
)) {
                $successCount++;

                $this->info(
                    "Document {$document->id} synchronisé."
                );

                continue;
            }

            $failureCount++;

            $errorCode = data_get(
                $result,
                'error_code',
                'unknown_error'
            );

            $this->error(
                "Document {$document->id} en échec : {$errorCode}."
            );
        }

        $this->newLine();

        $this->info(
            "Réussites : {$successCount}"
        );

        if ($failureCount > 0) {
            $this->error(
                "Échecs : {$failureCount}"
            );

            return self::FAILURE;
        }

        $this->info('Échecs : 0');

        return self::SUCCESS;
    }

    /**
     * @return Collection<int, KnowledgeDocument>
     */
    protected function documentsToSynchronize(
        ?string $documentOption,
        int $limit
    ): Collection {
        $query = KnowledgeDocument::query()
            ->whereNotNull('file_path')
            ->whereNull('ai_document_id')
            ->orderBy('id');

        if ($documentOption !== null) {
            $query->where(
                'id',
                (int) $documentOption
            );
        }

        if ($limit > 0) {
            $query->limit($limit);
        }

        return $query->get([
            'id',
            'title',
            'original_filename',
            'file_path',
            'mime_type',
            'ai_document_id',
            'ai_index_status',
            'ai_index_error',
        ]);
    }
}