<?php

namespace Tests\Unit;

use App\Console\Commands\SyncKnowledgeDocumentsToAiMicroservice;
use App\Models\KnowledgeDocument;
use App\Services\Ai\Microservice\AiMicroserviceClient;
use App\Services\Ai\Microservice\KnowledgeDocumentSyncService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Console\Tester\CommandTester;
use Tests\TestCase;

class SyncKnowledgeDocumentsCommandTest extends TestCase
{
    public function test_dry_run_does_not_call_or_mutate_anything(): void
    {
        config([
            'services.ai_microservice.enabled' => false,
            'services.ai_microservice.base_url' => 'http://ai.test',
            'services.ai_microservice.api_key' => null,
        ]);
        Http::fake();

        $document = new KnowledgeDocument();
        $document->forceFill([
            'id' => 7,
            'title' => 'Document a synchroniser',
            'original_filename' => 'document.pdf',
            'file_path' => 'knowledge-documents/document.pdf',
            'mime_type' => 'application/pdf',
            'ai_document_id' => null,
            'ai_index_status' => 'failed',
            'ai_index_error' => 'provider_timeout',
        ]);
        $document->exists = true;

        $client = new AiMicroserviceClient();
        $command = new DryRunSyncCommand(
            documents: new Collection([$document]),
            syncService: new KnowledgeDocumentSyncService(
                $client
            ),
            client: $client,
        );
        $command->setLaravel($this->app);
        $tester = new CommandTester($command);

        $exitCode = $tester->execute([
            '--dry-run' => true,
        ]);

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString(
            'dry-run',
            $tester->getDisplay()
        );
        $this->assertSame('failed', $document->ai_index_status);
        $this->assertSame(
            'provider_timeout',
            $document->ai_index_error
        );
        Http::assertNothingSent();
    }
}

final class DryRunSyncCommand extends
    SyncKnowledgeDocumentsToAiMicroservice
{
    /**
     * @param Collection<int, KnowledgeDocument> $documents
     */
    public function __construct(
        private Collection $documents,
        KnowledgeDocumentSyncService $syncService,
        AiMicroserviceClient $client
    ) {
        parent::__construct($syncService, $client);
    }

    protected function documentsToSynchronize(
        ?string $documentOption,
        int $limit
    ): Collection {
        return $this->documents;
    }
}