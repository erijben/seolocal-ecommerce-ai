<?php

namespace App\Services\Ai;

use App\Services\DashboardService;
use Throwable;

class AiToolExecutorService
{
    public function __construct(
        private DashboardService $dashboardService,
        private KnowledgeBaseService $knowledgeBaseService,
        private AiStockForecastService $stockForecastService,
    ) {
    }

    public function execute(array $tools, string $question): array
    {
        $results = [];

        foreach ($tools as $tool) {
            $name = $tool['name'] ?? null;

            try {
                if ($name === 'search_knowledge_base') {
                    $results['knowledge_base'] = $this->knowledgeBaseService
                     ->buildRagContext($question, 3);
                }

                if ($name === 'get_stock_forecast') {
                    $results['stock_forecast'] = $this->stockForecastService
                        ->getStockForecast();
                }

                if ($name === 'get_business_snapshot') {
                    $results['business_snapshot'] = $this->getBusinessSnapshot();
                }
            } catch (Throwable) {
                $this->setEmptyResult($results, $name, $question);
            }
        }

        return $results;
    }

    private function getBusinessSnapshot(): array
    {
        return [
            'stats' => $this->dashboardService->getStats(),
            'sales_by_period' => $this->dashboardService->getSalesByPeriod('monthly'),
            'top_products' => $this->dashboardService->getTopProducts(5),
            'top_customers' => $this->dashboardService->getTopCustomers(5),
            'orders_by_status' => $this->dashboardService->getOrdersByStatus(),
            'low_stock_products' => $this->dashboardService->getLowStockProducts(),
        ];
    }

    private function setEmptyResult(array &$results, ?string $name, string $question): void
    {
        if ($name === 'search_knowledge_base') {
            $results['knowledge_base'] = [
                'query' => $question,
                'chunks_count' => 0,
                'chunks' => [],
                'context_text' => '',
            ];
        }

        if ($name === 'get_stock_forecast') {
            $results['stock_forecast'] = ['products' => []];
        }

        if ($name === 'get_business_snapshot') {
            $results['business_snapshot'] = [];
        }
    }
}