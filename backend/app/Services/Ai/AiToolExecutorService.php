<?php

namespace App\Services\Ai;

use App\Services\DashboardService;
use Throwable;
use Illuminate\Support\Facades\Log;
use App\Services\Ai\Microservice\KnowledgeDocumentSyncService;

class AiToolExecutorService
{
    public function __construct(
    private DashboardService $dashboardService,
    private KnowledgeBaseService $knowledgeBaseService,
    private AiStockForecastService $stockForecastService,
    private KnowledgeDocumentSyncService $knowledgeDocumentSyncService,
) {
}

public function execute(array $tools, string $question, ?string $requestId = null): array
    {
        $results = [];

        foreach ($tools as $tool) {
            $name = $tool['name'] ?? null;
            $toolStartedAt = microtime(true);

Log::info('AI tool started', [
    'request_id' => $requestId,
    'tool' => $name,
]);

            try {
               if ($name === 'search_knowledge_base') {
    $semanticContext = $this
        ->knowledgeDocumentSyncService
        ->buildRagContext(
            query: $question,
            limit: 3,
            requestId: $requestId,
        );

    $semanticStatus = data_get(
        $semanticContext,
        'status'
    );

    $useLegacyKnowledgeFallback = (
        $semanticStatus === 'skipped'
        || (
            $semanticStatus === 'error'
            && (bool) config(
                'services.ai_microservice.legacy_fallback_enabled',
                false
            )
        )
    );

    if ($useLegacyKnowledgeFallback) {
        $results['knowledge_base'] = $this
            ->knowledgeBaseService
            ->buildRagContext($question, 3);
    } else {
        $results['knowledge_base'] = $semanticContext;
    }
}

                if ($name === 'get_stock_forecast') {
              $results['stock_forecast'] = $this->stockForecastService->getStockForecast(
    requestId: $requestId
);
                }

                if ($name === 'get_business_snapshot') {
                    $results['business_snapshot'] = $this->getBusinessSnapshot();
                }
                Log::info('AI tool finished', [
    'request_id' => $requestId,
    'tool' => $name,
    'duration_ms' => (int) round((microtime(true) - $toolStartedAt) * 1000),
]);
        } catch (Throwable $exception) {
    Log::warning('AI tool failed', [
        'request_id' => $requestId,
        'tool' => $name,
        'exception' => $exception::class,
        'message' => $exception->getMessage(),
        'duration_ms' => (int) round((microtime(true) - $toolStartedAt) * 1000),
    ]);

    $this->setEmptyResult($results, $name, $question);
}
        }

        return $results;
    }

  private function getBusinessSnapshot(): array
{
    $snapshot = [
        'stats' => $this->dashboardService->getStats(),
        'sales_by_period' => $this->dashboardService->getSalesByPeriod('monthly'),
        'top_products' => $this->dashboardService->getTopProducts(5),
        'top_customers' => $this->dashboardService->getTopCustomers(5),
        'orders_by_status' => $this->dashboardService->getOrdersByStatus(),
        'low_stock_products' => $this->dashboardService->getLowStockProducts(),
    ];

    return [
        'status' => ! empty($snapshot['stats']) ? 'ok' : 'empty',
        ...$snapshot,
    ];
}

private function setEmptyResult(array &$results, ?string $name, string $question): void
{
    if ($name === 'search_knowledge_base') {
        $results['knowledge_base'] = [
            'status' => 'error',
            'error_message' => 'Knowledge base search failed',
            'query' => $question,
            'chunks_count' => 0,
            'chunks' => [],
            'context_text' => '',
        ];

        return;
    }

    if ($name === 'get_stock_forecast') {
        $results['stock_forecast'] = [
            'status' => 'error',
            'error_message' => 'Stock forecast failed',
            'provider' => null,
            'products' => [],
        ];

        return;
    }

    if ($name === 'get_business_snapshot') {
        $results['business_snapshot'] = [
            'status' => 'error',
            'error_message' => 'Business snapshot failed',
            'stats' => [],
            'sales_by_period' => [],
            'top_products' => [],
            'top_customers' => [],
            'orders_by_status' => [],
            'low_stock_products' => [],
        ];
    }
}
}