<?php
/*Là, on fait quelque chose de très important :
l’IA ne reçoit pas toujours toutes les données. Elle reçoit seulement les données nécessaires selon l’intention.

C’est plus sécurisé, plus propre, plus scalable.*/
namespace App\Services\Ai;

use App\Services\DashboardService;
use App\Services\Ai\AiStockForecastService;
use App\Services\Ai\KnowledgeBaseService;
class AiDataToolService
{
    public function __construct(
    private DashboardService $dashboardService,
    private AiStockForecastService $stockForecastService,
    private KnowledgeBaseService $knowledgeBaseService
) {
}

public function getContextForIntent(string $intent, ?string $question = null): array
    {
        
        return match ($intent) {
            'stock_forecast' => [
    'stats' => $this->dashboardService->getStats(),
    'stock_forecast' => $this->stockForecastService->getStockForecast(),
    'low_stock_products' => $this->dashboardService->getLowStockProducts(),
],

'knowledge_search' => [
    'stats' => $this->dashboardService->getStats(),
    'rag_context' => $this->knowledgeBaseService->buildRagContext(
        query: $question ?: 'réapprovisionnement stock seuil alerte produit fournisseur règles internes',
        limit: 5
    ),

],
            'stock_analysis' => [
                'stats' => $this->dashboardService->getStats(),
                'low_stock_products' => $this->dashboardService->getLowStockProducts(),
                'top_products' => $this->dashboardService->getTopProducts(5),
            ],

            'sales_analysis' => [
                'stats' => $this->dashboardService->getStats(),
                'sales_by_period' => $this->dashboardService->getSalesByPeriod('monthly'),
                'orders_by_status' => $this->dashboardService->getOrdersByStatus(),
                'top_products' => $this->dashboardService->getTopProducts(5),
            ],

            'customer_analysis' => [
                'stats' => $this->dashboardService->getStats(),
                'top_customers' => $this->dashboardService->getTopCustomers(5),
                'orders_by_status' => $this->dashboardService->getOrdersByStatus(),
            ],

            'product_analysis' => [
                'stats' => $this->dashboardService->getStats(),
                'top_products' => $this->dashboardService->getTopProducts(5),
                'low_stock_products' => $this->dashboardService->getLowStockProducts(),
            ],

            'marketing_advice' => [
                'stats' => $this->dashboardService->getStats(),
                'top_products' => $this->dashboardService->getTopProducts(5),
                'top_customers' => $this->dashboardService->getTopCustomers(5),
                'low_stock_products' => $this->dashboardService->getLowStockProducts(),
            ],

            default => [
                'stats' => $this->dashboardService->getStats(),
                'sales_by_period' => $this->dashboardService->getSalesByPeriod('monthly'),
                'top_products' => $this->dashboardService->getTopProducts(5),
                'top_customers' => $this->dashboardService->getTopCustomers(5),
                'orders_by_status' => $this->dashboardService->getOrdersByStatus(),
                'low_stock_products' => $this->dashboardService->getLowStockProducts(),
            ],
        };
    }

    public function summarizeUsedData(array $businessData): array
    {
        $stockForecast = $businessData['stock_forecast'] ?? null;

return [
    
    'has_stats' => isset($businessData['stats']),
    'sales_periods_count' => collect($businessData['sales_by_period'] ?? [])->count(),
    'top_products_count' => collect($businessData['top_products'] ?? [])->count(),
    'top_customers_count' => collect($businessData['top_customers'] ?? [])->count(),
    'orders_status_count' => collect($businessData['orders_by_status'] ?? [])->count(),
    'low_stock_products_count' => collect($businessData['low_stock_products'] ?? [])->count(),
    'stock_forecast_products_count' => collect(data_get($stockForecast, 'products', []))->count(),
    'stock_forecast_provider' => data_get($stockForecast, 'provider'),
'rag_chunks_count' => (int) data_get($businessData, 'rag_context.chunks_count', 0),
'rag_sources' => collect(data_get($businessData, 'rag_context.chunks', []))
    ->pluck('document_title')
    ->unique()
    ->values()
    ->toArray(),

];
    }
}