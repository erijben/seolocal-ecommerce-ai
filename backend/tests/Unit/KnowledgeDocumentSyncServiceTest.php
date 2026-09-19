<?php

namespace Tests\Unit;

use App\Models\KnowledgeDocument;
use App\Services\Ai\Microservice\AiMicroserviceClient;
use App\Services\Ai\Microservice\KnowledgeDocumentSyncService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class KnowledgeDocumentSyncServiceTest extends TestCase
{
    private const REMOTE_ID = '123e4567-e89b-12d3-a456-426614174000';

    private const PDF_CONTENT = '%PDF-1.4 test document';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.ai_microservice.enabled' => true,
            'services.ai_microservice.base_url' => 'http://ai.test',
            'services.ai_microservice.api_key' => 'test-key',
            'services.ai_microservice.connect_timeout' => 1,
            'services.ai_microservice.timeout' => 1,
        ]);

        Storage::fake('local');
        Storage::disk('local')->put(
            'knowledge-documents/test.pdf',
            self::PDF_CONTENT
        );
    }

    public function test_initial_sync_transitions_from_processing_to_ready(): void
    {
        Http::fake([
            'http://ai.test/api/v1/knowledge/documents' => Http::response([
                'document_id' => self::REMOTE_ID,
                'status' => 'ready',
                'chunks_count' => 2,
                'pages_count' => 1,
                'provider' => 'ollama_local',
                'model' => 'embeddinggemma',
            ], 201),
        ]);

        $document = $this->document([
            'ai_index_status' => 'pending',
        ]);

        $result = $this->service()->indexDocument(
            document: $document,
            requestId: 'sync-initial'
        );

        $this->assertSame('ok', $result['status']);
        $this->assertSame(self::REMOTE_ID, $document->ai_document_id);
        $this->assertSame('ready', $document->ai_index_status);
        $this->assertSame(
            ['processing', 'ready'],
            $document->statusHistory()
        );
        Http::assertSentCount(1);
    }

    public function test_ready_document_is_not_uploaded_twice(): void
    {
        config([
            'services.ai_microservice.enabled' => false,
            'services.ai_microservice.api_key' => null,
        ]);
        Http::fake();

        $document = $this->document([
            'ai_document_id' => self::REMOTE_ID,
            'ai_index_status' => 'ready',
        ]);

        $result = $this->service()->indexDocument($document);

        $this->assertSame('already_indexed', $result['status']);
        $this->assertSame([], $document->updateHistory);
        Http::assertNothingSent();
    }

    public function test_failed_document_can_be_retried(): void
    {
        Http::fake([
            'http://ai.test/api/v1/knowledge/documents' => Http::response([
                'document_id' => self::REMOTE_ID,
                'status' => 'ready',
                'chunks_count' => 2,
                'pages_count' => 1,
                'provider' => 'ollama_local',
                'model' => 'embeddinggemma',
            ], 201),
        ]);

        $document = $this->document([
            'ai_index_status' => 'failed',
            'ai_index_error' => 'embedding_provider_timeout',
        ]);

        $result = $this->service()->indexDocument($document);

        $this->assertSame('ok', $result['status']);
        $this->assertSame('ready', $document->ai_index_status);
        $this->assertNull($document->ai_index_error);
        $this->assertSame(
            ['processing', 'ready'],
            $document->statusHistory()
        );
    }

    public function test_unavailable_microservice_marks_document_as_failed(): void
    {
        Http::fake(fn () => Http::failedConnection());

        $document = $this->document([
            'ai_index_status' => 'pending',
        ]);

        $result = $this->service()->indexDocument($document);

        $this->assertSame('error', $result['status']);
        $this->assertSame(
            'ai_microservice_unavailable',
            $result['error_code']
        );
        $this->assertSame('failed', $document->ai_index_status);
        $this->assertNull($document->ai_document_id);
        $this->assertSame(
            ['processing', 'failed'],
            $document->statusHistory()
        );
        Http::assertSentCount(1);
    }

    public function test_exact_duplicate_is_recovered_with_checksum(): void
    {
        $checksum = hash('sha256', self::PDF_CONTENT);

        Http::fakeSequence()
            ->push([
                'detail' => [
                    'code' => 'duplicate_document',
                    'message' => 'Already indexed.',
                ],
            ], 409)
            ->push([
                'documents' => [[
                    'document_id' => self::REMOTE_ID,
                    'external_id' => 'laravel-knowledge-document-42',
                    'checksum_sha256' => $checksum,
                    'title' => 'Test document',
                    'status' => 'ready',
                ]],
                'total' => 1,
            ], 200);

        $document = $this->document([
            'ai_index_status' => 'failed',
        ]);

        $result = $this->service()->indexDocument($document);

        $this->assertSame('recovered', $result['status']);
        $this->assertSame(self::REMOTE_ID, $document->ai_document_id);
        $this->assertSame('ready', $document->ai_index_status);
        Http::assertSentCount(2);
    }

    public function test_same_checksum_with_other_external_id_is_not_recovered(): void
    {
        $checksum = hash('sha256', self::PDF_CONTENT);

        Http::fakeSequence()
            ->push([
                'detail' => [
                    'code' => 'duplicate_document',
                    'message' => 'Already indexed.',
                ],
            ], 409)
            ->push([
                'documents' => [[
                    'document_id' => self::REMOTE_ID,
                    'external_id' => 'laravel-knowledge-document-999',
                    'checksum_sha256' => $checksum,
                    'title' => 'Other document',
                    'status' => 'ready',
                ]],
                'total' => 1,
            ], 200);

        $document = $this->document([
            'ai_index_status' => 'failed',
        ]);

        $result = $this->service()->indexDocument($document);

        $this->assertSame('error', $result['status']);
        $this->assertSame('duplicate_document', $result['error_code']);
        $this->assertNull($document->ai_document_id);
        $this->assertSame('failed', $document->ai_index_status);
    }

    public function test_remote_delete_success_clears_ai_link(): void
    {
        Http::fake([
            'http://ai.test/api/v1/knowledge/documents/*' => Http::response([
                'document_id' => self::REMOTE_ID,
                'status' => 'deleted',
            ], 200),
        ]);

        $document = $this->document([
            'ai_document_id' => self::REMOTE_ID,
            'ai_index_status' => 'ready',
        ]);

        $result = $this->service()->deleteRemoteDocument($document);

        $this->assertSame('ok', $result['status']);
        $this->assertNull($document->ai_document_id);
        $this->assertNull($document->ai_index_status);
        $this->assertNull($document->ai_index_error);
        Http::assertSentCount(1);
    }

    public function test_remote_delete_failure_is_traced_and_keeps_link(): void
    {
        Http::fake(fn () => Http::failedConnection());

        $document = $this->document([
            'ai_document_id' => self::REMOTE_ID,
            'ai_index_status' => 'ready',
        ]);

        $result = $this->service()->deleteRemoteDocument($document);

        $this->assertSame('error', $result['status']);
        $this->assertSame(
            'ai_microservice_unavailable',
            $result['error_code']
        );
        $this->assertSame(self::REMOTE_ID, $document->ai_document_id);
        $this->assertSame('failed', $document->ai_index_status);
        $this->assertSame(
            'delete:ai_microservice_unavailable',
            $document->ai_index_error
        );
    }

    public function test_delete_recovers_missing_remote_id_before_deleting(): void
    {
        $checksum = hash('sha256', self::PDF_CONTENT);

        Http::fakeSequence()
            ->push([
                'documents' => [[
                    'document_id' => self::REMOTE_ID,
                    'external_id' => 'laravel-knowledge-document-42',
                    'checksum_sha256' => $checksum,
                    'title' => 'Test document',
                    'status' => 'ready',
                ]],
                'total' => 1,
            ], 200)
            ->push([
                'document_id' => self::REMOTE_ID,
                'status' => 'deleted',
            ], 200);

        $document = $this->document([
            'ai_document_id' => null,
            'ai_index_status' => 'failed',
        ]);

        $result = $this->service()->deleteRemoteDocument($document);

        $this->assertSame('ok', $result['status']);
        $this->assertNull($document->ai_document_id);
        $this->assertNull($document->ai_index_status);
        Http::assertSentCount(2);
    }

    public function test_pending_document_without_remote_id_can_be_deleted_locally(): void
    {
        config([
            'services.ai_microservice.enabled' => false,
        ]);
        Http::fake();

        $document = $this->document([
            'ai_document_id' => null,
            'ai_index_status' => 'pending',
        ]);

        $result = $this->service()->deleteRemoteDocument($document);

        $this->assertSame('not_indexed', $result['status']);
        $this->assertSame([], $document->updateHistory);
        Http::assertNothingSent();
    }

    private function service(): KnowledgeDocumentSyncService
    {
        return new KnowledgeDocumentSyncService(
            new AiMicroserviceClient()
        );
    }

    /**
     * @param array<string, mixed> $attributes
     */
    private function document(
        array $attributes = []
    ): InMemoryKnowledgeDocument {
        $document = new InMemoryKnowledgeDocument();
        $document->forceFill(array_merge([
            'id' => 42,
            'title' => 'Test document',
            'original_filename' => 'test.pdf',
            'file_path' => 'knowledge-documents/test.pdf',
            'mime_type' => 'application/pdf',
            'ai_document_id' => null,
            'ai_index_status' => null,
            'ai_index_error' => null,
            'ai_indexed_at' => null,
        ], $attributes));
        $document->exists = true;

        return $document;
    }
}

final class InMemoryKnowledgeDocument extends KnowledgeDocument
{
    /**
     * @var list<array<string, mixed>>
     */
    public array $updateHistory = [];

    public function update(
        array $attributes = [],
        array $options = []
    ) {
        $this->updateHistory[] = $attributes;
        $this->forceFill($attributes);

        return true;
    }

    public function fresh($with = [])
    {
        return $this;
    }

    /**
     * @return list<string|null>
     */
    public function statusHistory(): array
    {
        return array_map(
            fn (array $update) => (
                $update['ai_index_status'] ?? null
            ),
            array_values(array_filter(
                $this->updateHistory,
                fn (array $update): bool => array_key_exists(
                    'ai_index_status',
                    $update
                )
            ))
        );
    }
}
