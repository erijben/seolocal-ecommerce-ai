<?php

namespace Tests\Feature;

use App\Services\Ai\AiRouterService;
use App\Services\Ai\AiStockForecastService;
use App\Services\Ai\AiToolExecutorService;
use App\Services\Ai\KnowledgeBaseService;
use App\Services\Ai\Microservice\AiMicroserviceClient;
use App\Services\Ai\Microservice\KnowledgeDocumentSyncService;
use App\Services\Ai\Providers\AiProviderManager;
use App\Services\AiService;
use App\Services\DashboardService;
use Illuminate\Support\Facades\Http;
use Mockery;
use Tests\TestCase;

class AiServiceFallbackPolicyTest extends TestCase
{
    public function test_microservice_failure_does_not_use_legacy_provider_by_default(): void
    {
        $this->configureMicroservice(
            enabled: true,
            legacyFallbackEnabled: false,
        );

        Http::fake([
            'http://ai.test/*' => Http::response([
                'detail' => [
                    'code' => 'provider_timeout',
                    'message' => 'Provider timeout.',
                ],
            ], 503),
        ]);

        $providerManager = Mockery::mock(
            AiProviderManager::class
        );
        $providerManager->shouldNotReceive('chat');

        $result = $this->makeService($providerManager)
            ->answerQuestion(
                'Quels produits faut-il réapprovisionner ?',
                1
            );

        $this->assertSame('error', $result['status']);
        $this->assertSame(
            'provider_timeout',
            $result['error_code']
        );
        $this->assertNull($result['answer']);
        Http::assertSentCount(1);
    }

    public function test_microservice_failure_uses_explicit_legacy_fallback(): void
    {
        $this->configureMicroservice(
            enabled: true,
            legacyFallbackEnabled: true,
        );

        Http::fake([
            'http://ai.test/*' => Http::response([
                'detail' => [
                    'code' => 'provider_timeout',
                    'message' => 'Provider timeout.',
                ],
            ], 503),
        ]);

        $providerManager = Mockery::mock(
            AiProviderManager::class
        );
        $providerManager->shouldReceive('chat')
            ->once()
            ->andReturn([
                'provider' => 'ollama',
                'answer' => 'Réponse du provider Laravel.',
            ]);

        $result = $this->makeService($providerManager)
            ->answerQuestion(
                'Quels produits faut-il réapprovisionner ?',
                1
            );

        $this->assertSame('ok', $result['status']);
        $this->assertSame('ollama', $result['provider']);
        $this->assertSame(
            'Réponse du provider Laravel.',
            $result['answer']
        );
        Http::assertSentCount(1);
    }

    public function test_disabled_microservice_uses_legacy_provider_directly(): void
    {
        $this->configureMicroservice(
            enabled: false,
            legacyFallbackEnabled: false,
        );

        Http::fake();

        $providerManager = Mockery::mock(
            AiProviderManager::class
        );
        $providerManager->shouldReceive('chat')
            ->once()
            ->andReturn([
                'provider' => 'ollama',
                'answer' => 'Réponse Laravel directe.',
            ]);

        $result = $this->makeService($providerManager)
            ->answerQuestion(
                'Quels produits faut-il réapprovisionner ?',
                1
            );

        $this->assertSame('ok', $result['status']);
        $this->assertSame('ollama', $result['provider']);
        $this->assertSame(
            'Réponse Laravel directe.',
            $result['answer']
        );
        Http::assertNothingSent();
    }

    public function test_semantic_search_failure_does_not_use_lexical_fallback_by_default(): void
    {
        $this->configureMicroservice(
            enabled: true,
            legacyFallbackEnabled: false,
        );

        Http::fake([
            'http://ai.test/*' => Http::response([
                'detail' => [
                    'code' => 'semantic_search_failed',
                    'message' => 'Semantic search failed.',
                ],
            ], 503),
        ]);

        $knowledgeBaseService = Mockery::mock(
            KnowledgeBaseService::class
        );
        $knowledgeBaseService->shouldNotReceive(
            'buildRagContext'
        );

        $result = $this
            ->makeToolExecutor($knowledgeBaseService)
            ->execute(
                tools: [
                    [
                        'name' => 'search_knowledge_base',
                    ],
                ],
                question: 'Quelle est la politique de retour ?',
                requestId: 'rag-no-fallback-test',
            );

        $this->assertSame(
            'error',
            $result['knowledge_base']['status']
        );
        $this->assertSame(
            'semantic_search_failed',
            $result['knowledge_base']['error_code']
        );
    }

    public function test_semantic_search_failure_uses_explicit_lexical_fallback(): void
    {
        $this->configureMicroservice(
            enabled: true,
            legacyFallbackEnabled: true,
        );

        Http::fake([
            'http://ai.test/*' => Http::response([
                'detail' => [
                    'code' => 'semantic_search_failed',
                    'message' => 'Semantic search failed.',
                ],
            ], 503),
        ]);

        $question = 'Quelle est la politique de retour ?';
        $lexicalContext = [
            'status' => 'ok',
            'query' => $question,
            'chunks_count' => 1,
            'chunks' => [
                [
                    'content' => 'Retour sous 14 jours.',
                ],
            ],
            'context_text' => 'Retour sous 14 jours.',
        ];

        $knowledgeBaseService = Mockery::mock(
            KnowledgeBaseService::class
        );
        $knowledgeBaseService->shouldReceive(
            'buildRagContext'
        )
            ->once()
            ->with($question, 3)
            ->andReturn($lexicalContext);

        $result = $this
            ->makeToolExecutor($knowledgeBaseService)
            ->execute(
                tools: [
                    [
                        'name' => 'search_knowledge_base',
                    ],
                ],
                question: $question,
                requestId: 'rag-explicit-fallback-test',
            );

        $this->assertSame(
            $lexicalContext,
            $result['knowledge_base']
        );
    }

    private function configureMicroservice(
        bool $enabled,
        bool $legacyFallbackEnabled
    ): void {
        config()->set([
            'services.ai_microservice.enabled' => $enabled,
            'services.ai_microservice.legacy_fallback_enabled' => (
                $legacyFallbackEnabled
            ),
            'services.ai_microservice.base_url' => (
                'http://ai.test'
            ),
            'services.ai_microservice.api_key' => 'test-key',
            'services.ai_microservice.connect_timeout' => 1,
            'services.ai_microservice.timeout' => 1,
            'services.ai.provider' => 'ollama',
            'services.ai.allow_provider_fallback' => false,
        ]);
    }

    private function makeToolExecutor(
        KnowledgeBaseService $knowledgeBaseService
    ): AiToolExecutorService {
        $client = new AiMicroserviceClient;

        return new AiToolExecutorService(
            dashboardService: Mockery::mock(
                DashboardService::class
            ),
            knowledgeBaseService: $knowledgeBaseService,
            stockForecastService: Mockery::mock(
                AiStockForecastService::class
            ),
            knowledgeDocumentSyncService: (
                new KnowledgeDocumentSyncService($client)
            ),
        );
    }

    private function makeService(
        AiProviderManager $providerManager
    ): AiService {
        $routerService = Mockery::mock(
            AiRouterService::class
        );
        $routerService->shouldReceive('route')
            ->once()
            ->andReturn([
                'provider' => 'local_router',
                'confidence' => 1.0,
                'tools' => [
                    [
                        'name' => 'get_business_snapshot',
                    ],
                ],
            ]);

        $toolExecutorService = Mockery::mock(
            AiToolExecutorService::class
        );
        $toolExecutorService->shouldReceive('execute')
            ->once()
            ->andReturn([
                'business_snapshot' => [
                    'status' => 'ok',
                    'stats' => [
                        'orders_count' => 10,
                    ],
                    'sales_by_period' => [],
                    'top_products' => [],
                    'top_customers' => [],
                    'orders_by_status' => [],
                    'low_stock_products' => [],
                ],
            ]);

        return new AiService(
            dashboardService: Mockery::mock(
                DashboardService::class
            ),
            routerService: $routerService,
            toolExecutorService: $toolExecutorService,
            providerManager: $providerManager,
            aiMicroserviceClient: new AiMicroserviceClient,
        );
    }
}
