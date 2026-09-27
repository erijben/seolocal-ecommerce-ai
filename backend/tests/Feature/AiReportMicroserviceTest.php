<?php

namespace Tests\Feature;

use App\Services\Ai\AiRouterService;
use App\Services\Ai\AiToolExecutorService;
use App\Services\Ai\Microservice\AiMicroserviceClient;
use App\Services\Ai\Providers\AiProviderManager;
use App\Services\AiService;
use App\Services\DashboardService;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Mockery;
use Tests\TestCase;

class AiReportMicroserviceTest extends TestCase
{
    public function test_report_uses_microservice_codes_and_keeps_laravel_figures(): void
    {
        $this->configureMicroservice(
            enabled: true,
            legacyFallbackEnabled: false,
        );

        Http::fake([
            'http://ai.test/*' => Http::response([
                'status' => 'ok',
                'action_codes' => [
                    'PRIORITIZE_RESTOCK',
                    'ANALYZE_CANCELLATIONS',
                    'RETAIN_IMPORTANT_CUSTOMERS',
                ],
                'llm_provider' => 'ollama_cloud',
                'llm_model' => 'gpt-oss:20b',
                'error_code' => null,
            ]),
        ]);

        $providerManager = Mockery::mock(
            AiProviderManager::class
        );
        $providerManager->shouldNotReceive('chat');

        $result = $this->makeService($providerManager)
            ->generateReport(
                'sales_report',
                'monthly',
                '22222222-2222-4222-8222-222222222222'
            );

        $this->assertSame('ok', $result['status']);
        $this->assertSame(
            'ollama_cloud',
            $result['provider']
        );
        $this->assertStringContainsString(
            '# Rapport de ventes',
            $result['content']
        );
        $this->assertStringContainsString(
            '1 000,00 €',
            $result['content']
        );
        $this->assertStringContainsString(
            'Prioriser le réapprovisionnement',
            $result['content']
        );
        $this->assertStringContainsString(
            'Examiner les commandes annulées',
            $result['content']
        );
        $this->assertStringContainsString(
            'Préparer une action de fidélisation',
            $result['content']
        );
        $this->assertStringContainsString(
            'Réapprovisionner Casque Bluetooth d’au moins 2 unité(s)',
            $result['content']
        );

        Http::assertSent(function (HttpRequest $request): bool {
            $payload = $request->data();

            return $request->url()
                === 'http://ai.test/api/v1/reports/recommendations'
                && $payload['report_type'] === 'sales_report'
                && $payload['period'] === 'monthly'
                && $request->hasHeader(
                    'X-Request-ID',
                    '22222222-2222-4222-8222-222222222222'
                )
                && is_string($payload['context'])
                && str_contains(
                    $payload['context'],
                    'Réapprovisionnements calculés'
                )
                && ! array_key_exists('stats', $payload)
                && ! array_key_exists('sales_by_period', $payload);
        });
    }

    public function test_report_failure_does_not_use_legacy_provider_by_default(): void
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
            ->generateReport('sales_report', 'monthly');

        $this->assertSame('error', $result['status']);
        $this->assertSame(
            'provider_timeout',
            $result['error_code']
        );
        $this->assertNull($result['content']);
    }

    public function test_report_rejects_invalid_microservice_codes(): void
    {
        $this->configureMicroservice(
            enabled: true,
            legacyFallbackEnabled: false,
        );

        Http::fake([
            'http://ai.test/*' => Http::response([
                'status' => 'ok',
                'action_codes' => [
                    'PRIORITIZE_RESTOCK',
                    'PRIORITIZE_RESTOCK',
                    'INVENT_REVENUE',
                ],
                'llm_provider' => 'ollama_cloud',
                'llm_model' => 'gpt-oss:20b',
                'error_code' => null,
            ]),
        ]);

        $providerManager = Mockery::mock(
            AiProviderManager::class
        );
        $providerManager->shouldNotReceive('chat');

        $result = $this->makeService($providerManager)
            ->generateReport('sales_report', 'monthly');

        $this->assertSame('error', $result['status']);
        $this->assertSame(
            'invalid_report_action_codes',
            $result['error_code']
        );
        $this->assertNull($result['content']);
    }

    public function test_report_uses_legacy_provider_only_with_explicit_fallback(): void
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
                'answer' => implode("\n", [
                    'PRIORITIZE_RESTOCK',
                    'FOLLOW_ORDER_STATUSES',
                    'ANALYZE_CANCELLATIONS',
                ]),
            ]);

        $result = $this->makeService($providerManager)
            ->generateReport('sales_report', 'monthly');

        $this->assertSame('ok', $result['status']);
        $this->assertSame('ollama', $result['provider']);
        $this->assertStringContainsString(
            'Assurer un suivi opérationnel',
            $result['content']
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
            'services.ai_microservice.base_url' => 'http://ai.test',
            'services.ai_microservice.api_key' => 'test-key',
            'services.ai_microservice.connect_timeout' => 1,
            'services.ai_microservice.timeout' => 1,
            'services.ai.provider' => 'ollama',
            'services.ai.allow_provider_fallback' => false,
        ]);
    }

    private function makeService(
        AiProviderManager $providerManager
    ): AiService {
        $dashboardService = Mockery::mock(
            DashboardService::class
        );
        $dashboardService->shouldReceive('getStats')
            ->once()
            ->andReturn([
                'total_revenue' => 1000,
                'orders_count' => 10,
                'customers_count' => 3,
                'products_count' => 4,
                'low_stock_count' => 1,
            ]);
        $dashboardService->shouldReceive('getSalesByPeriod')
            ->once()
            ->with('monthly')
            ->andReturn([
                [
                    'period' => '2026-01',
                    'total_sales' => 400,
                    'orders_count' => 4,
                ],
                [
                    'period' => '2026-02',
                    'total_sales' => 600,
                    'orders_count' => 6,
                ],
            ]);
        $dashboardService->shouldReceive('getTopProducts')
            ->once()
            ->with(5)
            ->andReturn([
                [
                    'product_name' => 'Casque Bluetooth',
                    'total_sold' => 10,
                    'total_revenue' => 500,
                ],
            ]);
        $dashboardService->shouldReceive('getTopCustomers')
            ->once()
            ->with(5)
            ->andReturn([
                [
                    'first_name' => 'Sami',
                    'last_name' => 'Achour',
                    'orders_count' => 3,
                    'total_spent' => 300,
                ],
            ]);
        $dashboardService->shouldReceive('getOrdersByStatus')
            ->once()
            ->andReturn([
                [
                    'status' => 'cancelled',
                    'count' => 1,
                ],
            ]);
        $dashboardService->shouldReceive('getLowStockProducts')
            ->once()
            ->andReturn([
                [
                    'name' => 'Casque Bluetooth',
                    'stock_quantity' => 18,
                    'stock_alert_threshold' => 20,
                    'category' => [
                        'name' => 'Électronique',
                    ],
                ],
            ]);

        return new AiService(
            dashboardService: $dashboardService,
            routerService: Mockery::mock(
                AiRouterService::class
            ),
            toolExecutorService: Mockery::mock(
                AiToolExecutorService::class
            ),
            providerManager: $providerManager,
            aiMicroserviceClient: new AiMicroserviceClient,
        );
    }
}
