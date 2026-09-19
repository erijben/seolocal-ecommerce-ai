<?php

namespace App\Services\Ai\Microservice;

use App\Models\KnowledgeDocument;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

final class KnowledgeDocumentSyncService
{
    public function __construct(
        private AiMicroserviceClient $client
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function indexDocument(
        KnowledgeDocument $document,
        ?string $requestId = null
    ): array {
        if (
            is_string($document->ai_document_id)
            && Str::isUuid($document->ai_document_id)
            && $document->ai_index_status === 'ready'
        ) {
            return [
                'status' => 'already_indexed',
                'error_code' => null,
                'document' => $document,
            ];
        }

        if (! $this->client->isEnabled()) {
            return [
                'status' => 'skipped',
                'error_code' => 'ai_microservice_disabled',
                'document' => $document,
            ];
        }

        if (! $this->client->isConfigured()) {
            return $this->markAsFailed(
                document: $document,
                errorCode: 'ai_microservice_not_configured',
            );
        }


        if (
            ! is_string($document->file_path)
            || $document->file_path === ''
        ) {
            return $this->markAsFailed(
                document: $document,
                errorCode: 'document_file_path_missing',
            );
        }

        $disk = Storage::disk('local');

        if (! $disk->exists($document->file_path)) {
            return $this->markAsFailed(
                document: $document,
                errorCode: 'document_file_missing',
            );
        }

        try {
            $absolutePath = $disk->path(
                $document->file_path
            );

            $checksum = hash_file('sha256', $absolutePath);

            if (! is_string($checksum) || $checksum === '') {
                return $this->markAsFailed(
                    document: $document,
                    errorCode: 'document_checksum_failed',
                );
            }

            $document->update([
                'ai_index_status' => 'processing',
                'ai_index_error' => null,
                'ai_indexed_at' => null,
            ]);

            $uploadedFile = new UploadedFile(
                path: $absolutePath,
                originalName: (
                    $document->original_filename
                    ?: basename($absolutePath)
                ),
                mimeType: (
                    $document->mime_type
                    ?: 'application/pdf'
                ),
                error: null,
                test: true,
            );

            $response = $this->client
                ->uploadKnowledgeDocument(
                    file: $uploadedFile,
                    title: $document->title,
                    externalId: $this->externalId($document),
                    requestId: $requestId,
                );

            $remoteDocumentId = data_get(
                $response,
                'data.document_id'
            );

            if (
                data_get($response, 'status') !== 'ok'
                || ! is_string($remoteDocumentId)
                || ! Str::isUuid($remoteDocumentId)
            ) {
                $errorCode = (string) data_get(
                    $response,
                    'error_code',
                    'ai_document_indexing_failed'
                );

                $recoveredResult = null;

                if (in_array($errorCode, [
                    'duplicate_document',
                    'duplicate_external_id',
                    'document_conflict',
                ], true)) {
                    $recoveredResult = $this
                        ->recoverExistingRemoteDocument(
                            document: $document,
                            checksum: $checksum,
                            originalResponse: $response,
                            requestId: $requestId,
                        );
                }

                if ($recoveredResult !== null) {
                    return $recoveredResult;
                }

                return $this->markAsFailed(
                    document: $document,
                    errorCode: $errorCode,
                    response: $response,
                );
            }

            $document->update([
                'ai_document_id' => $remoteDocumentId,
                'ai_index_status' => 'ready',
                'ai_index_error' => null,
                'ai_indexed_at' => now(),
            ]);

            return [
                'status' => 'ok',
                'error_code' => null,
                'document' => $document->fresh(),
                'response' => $response,
            ];
        } catch (Throwable $exception) {
            Log::error(
                'Knowledge document synchronization failed',
                [
                    'knowledge_document_id' => $document->id,
                    'request_id' => $requestId,
                    'exception' => $exception::class,
                ]
            );

            return $this->markAsFailed(
                document: $document,
                errorCode: 'ai_document_indexing_exception',
            );
        }
    }



    /**
 * @return array<string, mixed>
 */
public function searchDocuments(
    string $query,
    int $limit = 5,
    ?string $requestId = null
): array {
    if (! $this->client->isEnabled()) {
        return [
            'status' => 'skipped',
            'error_code' => 'ai_microservice_disabled',
            'results' => [],
            'response' => null,
        ];
    }

    if (! $this->client->isConfigured()) {
        return [
            'status' => 'error',
            'error_code' => 'ai_microservice_not_configured',
            'results' => [],
            'response' => null,
        ];
    }

    $response = $this->client->searchKnowledge(
        query: $query,
        topK: max(1, min($limit, 10)),
        requestId: $requestId,
    );

    if (data_get($response, 'status') !== 'ok') {
        return [
            'status' => 'error',
            'error_code' => data_get(
                $response,
                'error_code',
                'semantic_search_failed'
            ),
            'results' => [],
            'response' => $response,
        ];
    }

    $hits = collect(
        data_get($response, 'data.hits', [])
    );

    if ($hits->isEmpty()) {
        return [
            'status' => 'ok',
            'error_code' => null,
            'results' => [],
            'response' => $response,
        ];
    }

    $remoteDocumentIds = $hits
        ->pluck('document_id')
        ->filter(fn ($id) => is_string($id))
        ->unique()
        ->values();

    $documents = KnowledgeDocument::query()
        ->with('chunks')
        ->where('status', 'active')
        ->whereIn(
            'ai_document_id',
            $remoteDocumentIds->all()
        )
        ->get()
        ->keyBy('ai_document_id');

    $results = $hits
        ->map(function (array $hit) use ($documents) {
            $document = $documents->get(
                data_get($hit, 'document_id')
            );

            if (! $document instanceof KnowledgeDocument) {
                return null;
            }

            $chunkIndex = (int) data_get(
                $hit,
                'chunk_index',
                0
            );

            $localChunk = $document->chunks
                ->firstWhere('chunk_index', $chunkIndex);

            if ($localChunk === null) {
                return null;
            }

            return [
                'chunk_id' => $localChunk->id,
                'document_id' => $document->id,
                'document_title' => $document->title,
                'document_type' => $document->type,
                'chunk_index' => $chunkIndex,
                'content' => (string) data_get(
                    $hit,
                    'content',
                    ''
                ),
                'score' => (float) data_get(
                    $hit,
                    'score',
                    0
                ),
            ];
        })
        ->filter()
        ->take($limit)
        ->values()
        ->all();

    return [
        'status' => 'ok',
        'error_code' => null,
        'results' => $results,
        'response' => $response,
    ];
}





/**
 * @return array<string, mixed>
 */
public function buildRagContext(
    string $query,
    int $limit = 5,
    ?string $requestId = null
): array {
    $searchResult = $this->searchDocuments(
        query: $query,
        limit: $limit,
        requestId: $requestId,
    );

    if (data_get($searchResult, 'status') === 'skipped') {
        return [
            'status' => 'skipped',
            'query' => $query,
            'chunks_count' => 0,
            'chunks' => [],
            'context_text' => '',
            'provider' => null,
            'model' => null,
            'error_code' => 'ai_microservice_disabled',
        ];
    }

    if (data_get($searchResult, 'status') === 'error') {
        return [
            'status' => 'error',
            'query' => $query,
            'chunks_count' => 0,
            'chunks' => [],
            'context_text' => '',
            'provider' => null,
            'model' => null,
            'error_code' => data_get(
                $searchResult,
                'error_code',
                'semantic_search_failed'
            ),
        ];
    }

    $chunks = collect(
        data_get($searchResult, 'results', [])
    )->values();

    $contextText = $chunks
        ->map(function (array $chunk, int $index) {
            $sourceNumber = $index + 1;

            return '[Source '.$sourceNumber.'] '
                .$chunk['document_title']
                .' ('.$chunk['document_type'].')'
                ."\n"
                .$chunk['content'];
        })
        ->implode("\n\n---\n\n");

    return [
        'status' => (
            $chunks->isEmpty()
                ? 'empty'
                : 'ok'
        ),
        'query' => $query,
        'chunks_count' => $chunks->count(),
        'chunks' => $chunks->all(),
        'context_text' => $contextText,
        'provider' => data_get(
            $searchResult,
            'response.data.provider'
        ),
        'model' => data_get(
            $searchResult,
            'response.data.model'
        ),
        'error_code' => null,
    ];
}


    /**
     * Delete only the derived microservice copy.
     *
     * Laravel keeps the source row and PDF until this operation
     * succeeds or the remote document is confirmed absent.
     *
     * @return array<string, mixed>
     */
    public function deleteRemoteDocument(
        KnowledgeDocument $document,
        ?string $requestId = null
    ): array {
        $hasRemoteId = is_string($document->ai_document_id)
            && Str::isUuid($document->ai_document_id);
        $hasAmbiguousRemoteState = in_array(
            $document->ai_index_status,
            ['processing', 'ready', 'failed'],
            true
        );

        if (! $hasRemoteId && ! $hasAmbiguousRemoteState) {
            return [
                'status' => 'not_indexed',
                'error_code' => null,
                'document' => $document,
                'response' => null,
            ];
        }

        if (! $this->client->isEnabled()) {
            return $this->markDeletionAsFailed(
                document: $document,
                errorCode: 'ai_microservice_disabled',
            );
        }

        if (! $this->client->isConfigured()) {
            return $this->markDeletionAsFailed(
                document: $document,
                errorCode: 'ai_microservice_not_configured',
            );
        }

        if (! $hasRemoteId) {
            $lookupResult = $this->findExistingRemoteDocument(
                document: $document,
                requestId: $requestId,
                requireChecksumMatch: false,
            );

            if (data_get($lookupResult, 'status') === 'error') {
                return $this->markDeletionAsFailed(
                    document: $document,
                    errorCode: (string) data_get(
                        $lookupResult,
                        'error_code',
                        'ai_document_lookup_failed'
                    ),
                    response: data_get(
                        $lookupResult,
                        'response'
                    ),
                );
            }

            $remoteDocumentId = data_get(
                $lookupResult,
                'document.document_id'
            );

            if (! is_string($remoteDocumentId)
                || ! Str::isUuid($remoteDocumentId)) {
                return [
                    'status' => 'not_indexed',
                    'error_code' => null,
                    'document' => $document,
                    'response' => data_get(
                        $lookupResult,
                        'response'
                    ),
                ];
            }

            $document->update([
                'ai_document_id' => $remoteDocumentId,
            ]);
        }

        $response = $this->client->deleteKnowledgeDocument(
            documentId: (string) $document->ai_document_id,
            requestId: $requestId,
        );

        $isDeleted = data_get($response, 'status') === 'ok';
        $isAlreadyMissing = (
            data_get($response, 'http_status') === 404
            && data_get($response, 'error_code')
                === 'document_not_found'
        );

        if (! $isDeleted && ! $isAlreadyMissing) {
            return $this->markDeletionAsFailed(
                document: $document,
                errorCode: (string) data_get(
                    $response,
                    'error_code',
                    'ai_document_deletion_failed'
                ),
                response: $response,
            );
        }

        $document->update([
            'ai_document_id' => null,
            'ai_index_status' => null,
            'ai_index_error' => null,
            'ai_indexed_at' => null,
        ]);

        return [
            'status' => (
                $isDeleted
                    ? 'ok'
                    : 'already_deleted'
            ),
            'error_code' => null,
            'document' => $document->fresh(),
            'response' => $response,
        ];
    }

    /**
     * Recover an indexation that succeeded remotely while
     * Laravel did not receive the successful response.
     *
     * @param array<string, mixed> $originalResponse
     * @return array<string, mixed>|null
     */
    private function recoverExistingRemoteDocument(
        KnowledgeDocument $document,
        string $checksum,
        array $originalResponse,
        ?string $requestId = null
    ): ?array {
        $lookupResult = $this->findExistingRemoteDocument(
            document: $document,
            checksum: $checksum,
            requestId: $requestId,
        );

        $remoteDocument = data_get(
            $lookupResult,
            'document'
        );

        if (! is_array($remoteDocument)) {
            return null;
        }

        $remoteDocumentId = data_get(
            $remoteDocument,
            'document_id'
        );

        if (! is_string($remoteDocumentId)
            || ! Str::isUuid($remoteDocumentId)) {
            return null;
        }

        $document->update([
            'ai_document_id' => $remoteDocumentId,
            'ai_index_status' => 'ready',
            'ai_index_error' => null,
            'ai_indexed_at' => now(),
        ]);

        return [
            'status' => 'recovered',
            'error_code' => null,
            'document' => $document->fresh(),
            'response' => $originalResponse,
            'recovery_response' => data_get(
                $lookupResult,
                'response'
            ),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function findExistingRemoteDocument(
        KnowledgeDocument $document,
        ?string $checksum = null,
        ?string $requestId = null,
        bool $requireChecksumMatch = true
    ): array {
        if (
            $requireChecksumMatch
            && $checksum === null
            && is_string($document->file_path)
        ) {
            $disk = Storage::disk('local');

            if ($disk->exists($document->file_path)) {
                $computedChecksum = hash_file(
                    'sha256',
                    $disk->path($document->file_path)
                );

                if (is_string($computedChecksum)) {
                    $checksum = $computedChecksum;
                }
            }
        }

        if (
            $requireChecksumMatch
            && ($checksum === null || $checksum === '')
        ) {
            return [
                'status' => 'error',
                'error_code' => 'document_checksum_failed',
                'document' => null,
                'response' => null,
            ];
        }

        $externalId = $this->externalId($document);
        $offset = 0;
        $limit = 100;

        do {
            $listResponse = $this->client
                ->listKnowledgeDocuments(
                    limit: $limit,
                    offset: $offset,
                    requestId: $requestId,
                );

            if (data_get($listResponse, 'status') !== 'ok') {
                return [
                    'status' => 'error',
                    'error_code' => data_get(
                        $listResponse,
                        'error_code',
                        'ai_document_lookup_failed'
                    ),
                    'document' => null,
                    'response' => $listResponse,
                ];
            }

            $remoteDocuments = collect(
                data_get(
                    $listResponse,
                    'data.documents',
                    []
                )
            );

            $remoteDocument = $remoteDocuments->first(
                function ($item) use (
                    $externalId,
                    $checksum,
                    $requireChecksumMatch
                ): bool {
                    if (! is_array($item)) {
                        return false;
                    }

                    $remoteChecksum = (string) data_get(
                        $item,
                        'checksum_sha256',
                        ''
                    );

                    if (data_get(
                        $item,
                        'external_id'
                    ) !== $externalId) {
                        return false;
                    }

                    if (! $requireChecksumMatch) {
                        return true;
                    }

                    return $remoteChecksum !== ''
                        && is_string($checksum)
                        && hash_equals(
                            $checksum,
                            $remoteChecksum
                        );
                }
            );

            if (is_array($remoteDocument)) {
                return [
                    'status' => 'found',
                    'error_code' => null,
                    'document' => $remoteDocument,
                    'response' => $listResponse,
                ];
            }

            $documentsCount = $remoteDocuments->count();
            $total = (int) data_get(
                $listResponse,
                'data.total',
                0
            );

            $offset += $documentsCount;
        } while (
            $documentsCount > 0
            && $offset < $total
        );

        return [
            'status' => 'not_found',
            'error_code' => null,
            'document' => null,
            'response' => null,
        ];
    }

    /**
     * @param array<string, mixed>|null $response
     * @return array<string, mixed>
     */
    private function markDeletionAsFailed(
        KnowledgeDocument $document,
        string $errorCode,
        ?array $response = null
    ): array {
        $document->update([
            'ai_index_status' => 'failed',
            'ai_index_error' => 'delete:'.$errorCode,
        ]);

        return [
            'status' => 'error',
            'error_code' => $errorCode,
            'document' => $document->fresh(),
            'response' => $response,
        ];
    }

    private function externalId(
        KnowledgeDocument $document
    ): string {
        return 'laravel-knowledge-document-'.$document->id;
    }

    /**
     * @param array<string, mixed>|null $response
     * @return array<string, mixed>
     */
    private function markAsFailed(
        KnowledgeDocument $document,
        string $errorCode,
        ?array $response = null
    ): array {
        $document->update([
            'ai_index_status' => 'failed',
            'ai_index_error' => $errorCode,
            'ai_indexed_at' => null,
        ]);

        return [
            'status' => 'error',
            'error_code' => $errorCode,
            'document' => $document->fresh(),
            'response' => $response,
        ];
    }
}