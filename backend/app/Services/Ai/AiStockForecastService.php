<?php

namespace App\Services\Ai;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class AiStockForecastService
{
    public function getStockForecast(int $days = 90, ?string $requestId = null): array
    {
        $startedAt = microtime(true);

        Log::info('AI stock forecast started', [
            'request_id' => $requestId,
            'analysis_window_days' => $days,
        ]);

        $latestOrderDate = Order::where('status', '!=', 'cancelled')->max('order_date');

        $endDate = $latestOrderDate
            ? Carbon::parse($latestOrderDate)->endOfDay()
            : now();

        $startDate = (clone $endDate)->subDays($days)->startOfDay();

        $products = Product::with('category')
            ->where('status', 'active')
            ->get();

        $dailySalesByProduct = $this->getDailySalesByProduct($startDate, $endDate);

        $payload = $this->buildMlPayload(
            products: $products,
            dailySalesByProduct: $dailySalesByProduct,
            startDate: $startDate,
            endDate: $endDate,
            days: $days
        );

        $mlResponse = $this->callMlService($payload, $requestId);

        if ($mlResponse !== null) {
            $result = [
         'status' => empty($mlResponse['products'] ?? []) ? 'empty' : 'ok',
                'provider' => $mlResponse['provider'] ?? 'python_scikit_learn',
                'model_version' => $mlResponse['model_version'] ?? 'linear-regression-v1',
                'analysis_window_days' => $days,
                'forecast_horizon_days' => $payload['forecast_horizon_days'],
                'analysis_start_date' => $startDate->toDateTimeString(),
                'analysis_end_date' => $endDate->toDateTimeString(),
                'summary' => $mlResponse['summary'] ?? [],
                'products' => $mlResponse['products'] ?? [],
            ];

            Log::info('AI stock forecast succeeded with ML service', [
                'request_id' => $requestId,
                'provider' => $result['provider'],
                'model_version' => $result['model_version'],
                'products_count' => count($result['products']),
                'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
            ]);

            return $result;
        }

        Log::warning('AI stock forecast using Laravel baseline', [
            'request_id' => $requestId,
            'products_count' => $products->count(),
            'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
        ]);

        return $this->getLaravelFallbackForecast(
            products: $products,
            dailySalesByProduct: $dailySalesByProduct,
            startDate: $startDate,
            endDate: $endDate,
            days: $days,
            forecastHorizonDays: $payload['forecast_horizon_days']
        );
    }

    private function getDailySalesByProduct(Carbon $startDate, Carbon $endDate)
    {
        return OrderItem::query()
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.status', '!=', 'cancelled')
            ->whereBetween('orders.order_date', [$startDate, $endDate])
            ->select(
                'order_items.product_id',
                DB::raw('DATE(orders.order_date) as sale_date'),
                DB::raw('SUM(order_items.quantity) as total_quantity')
            )
            ->groupBy('order_items.product_id', DB::raw('DATE(orders.order_date)'))
            ->get()
            ->groupBy('product_id');
    }

    private function buildMlPayload(
        $products,
        $dailySalesByProduct,
        Carbon $startDate,
        Carbon $endDate,
        int $days
    ): array {
        $forecastHorizonDays = (int) config('services.ml_service.forecast_horizon_days', 30);

        return [
            'analysis_window_days' => $days,
            'forecast_horizon_days' => $forecastHorizonDays,
            'products' => $products->map(function (Product $product) use (
                $dailySalesByProduct,
                $startDate,
                $endDate
            ) {
                return [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'category' => $product->category?->name,
                    'price' => (float) $product->price,
                    'current_stock' => (int) $product->stock_quantity,
                    'stock_alert_threshold' => (int) $product->stock_alert_threshold,
                    'daily_sales' => $this->buildDailySalesForProduct(
                        productId: $product->id,
                        dailySalesByProduct: $dailySalesByProduct,
                        startDate: $startDate,
                        endDate: $endDate
                    ),
                ];
            })->values()->toArray(),
        ];
    }

    private function buildDailySalesForProduct(
        int $productId,
        $dailySalesByProduct,
        Carbon $startDate,
        Carbon $endDate
    ): array {
        $salesRows = collect($dailySalesByProduct->get($productId, []));

        $salesByDate = $salesRows->mapWithKeys(function ($row) {
            return [
                $row->sale_date => (int) $row->total_quantity,
            ];
        });

        $dailySales = [];
        $currentDate = $startDate->copy();

        while ($currentDate->lte($endDate)) {
            $dateKey = $currentDate->toDateString();

            $dailySales[] = [
                'date' => $dateKey,
                'quantity' => (int) ($salesByDate[$dateKey] ?? 0),
            ];

            $currentDate->addDay();
        }

        return $dailySales;
    }

    private function callMlService(array $payload, ?string $requestId = null): ?array
    {
        $startedAt = microtime(true);
        $baseUrl = rtrim((string) config('services.ml_service.url'), '/');
        $timeout = (int) config('services.ml_service.timeout', 30);

        if ($baseUrl === '') {
            Log::warning('AI stock forecast skipped ML service: empty base URL', [
                'request_id' => $requestId,
            ]);

            return null;
        }

        try {
            Log::info('AI stock forecast ML request started', [
                'request_id' => $requestId,
                'url' => $baseUrl . '/forecast/stock',
                'timeout' => $timeout,
                'products_count' => count($payload['products'] ?? []),
                'analysis_window_days' => $payload['analysis_window_days'] ?? null,
                'forecast_horizon_days' => $payload['forecast_horizon_days'] ?? null,
            ]);

            $response = Http::timeout($timeout)
                ->post($baseUrl . '/forecast/stock', $payload);

            $durationMs = (int) round((microtime(true) - $startedAt) * 1000);

            if (! $response->successful()) {
                Log::warning('AI stock forecast ML service returned non-success status', [
                    'request_id' => $requestId,
                    'status' => $response->status(),
                    'duration_ms' => $durationMs,
                ]);

                return null;
            }

            $json = $response->json();

            Log::info('AI stock forecast ML response received', [
                'request_id' => $requestId,
                'provider' => data_get($json, 'provider'),
                'model_version' => data_get($json, 'model_version'),
                'products_count' => count(data_get($json, 'products', [])),
                'duration_ms' => $durationMs,
            ]);

            return is_array($json) ? $json : null;
        } catch (Throwable $exception) {
            Log::warning('AI stock forecast ML request failed', [
                'request_id' => $requestId,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
                'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
            ]);

            return null;
        }
    }

    private function getLaravelFallbackForecast(
        $products,
        $dailySalesByProduct,
        Carbon $startDate,
        Carbon $endDate,
        int $days,
        int $forecastHorizonDays
    ): array {
        $forecastProducts = $products->map(function (Product $product) use (
            $dailySalesByProduct,
            $startDate,
            $endDate,
            $days,
            $forecastHorizonDays
        ) {
            $dailySales = collect($this->buildDailySalesForProduct(
                productId: $product->id,
                dailySalesByProduct: $dailySalesByProduct,
                startDate: $startDate,
                endDate: $endDate
            ));

            $totalSold = (int) $dailySales->sum('quantity');
            $dailyVelocity = $days > 0 ? $totalSold / $days : 0;
            $weeklyDemand = $dailyVelocity * 7;
            $projectedDemand = $dailyVelocity * $forecastHorizonDays;

            $daysUntilStockout = $dailyVelocity > 0
                ? $product->stock_quantity / $dailyVelocity
                : null;

            $riskLevel = $this->calculateRiskLevel(
                currentStock: (int) $product->stock_quantity,
                threshold: (int) $product->stock_alert_threshold,
                daysUntilStockout: $daysUntilStockout,
                projectedDemand: $projectedDemand
            );

            $recommendedRestockQuantity = $this->calculateRecommendedRestockQuantity(
                currentStock: (int) $product->stock_quantity,
                threshold: (int) $product->stock_alert_threshold,
                projectedDemand: $projectedDemand,
                riskLevel: $riskLevel
            );

            return [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'category' => $product->category?->name,
                'price' => (float) $product->price,
                'current_stock' => (int) $product->stock_quantity,
                'stock_alert_threshold' => (int) $product->stock_alert_threshold,
                'total_sold' => $totalSold,
                'total_revenue' => round($totalSold * (float) $product->price, 2),
                'daily_sales_velocity' => round($dailyVelocity, 3),
                'weekly_demand_estimate' => round($weeklyDemand, 2),
                'projected_demand_30_days' => round($projectedDemand, 2),
                'days_until_stockout' => $daysUntilStockout !== null
                    ? round($daysUntilStockout, 1)
                    : null,
                'risk_level' => $riskLevel,
                'recommended_restock_quantity' => $recommendedRestockQuantity,
                'recommended_action' => $this->getRecommendedAction($riskLevel),
                'ml_model' => 'moving_average_fallback',
                'ml_confidence' => 'low',
                'trend' => 'stable',
                'r2_score' => null,
            ];
        })
            ->sortBy(function (array $item) {
                return match ($item['risk_level']) {
                    'critical' => 1,
                    'high' => 2,
                    'medium' => 3,
                    default => 4,
                };
            })
            ->values();

        return [
            'status' => $forecastProducts->isEmpty() ? 'empty' : 'ok',
            'provider' => 'laravel_baseline',
            'model_version' => 'moving-average-baseline-v1',
            'analysis_window_days' => $days,
            'forecast_horizon_days' => $forecastHorizonDays,
            'analysis_start_date' => $startDate->toDateTimeString(),
            'analysis_end_date' => $endDate->toDateTimeString(),
            'summary' => [
                'total_products_analyzed' => $forecastProducts->count(),
                'critical_count' => $forecastProducts->where('risk_level', 'critical')->count(),
                'high_count' => $forecastProducts->where('risk_level', 'high')->count(),
                'medium_count' => $forecastProducts->where('risk_level', 'medium')->count(),
                'low_count' => $forecastProducts->where('risk_level', 'low')->count(),
            ],
            'products' => $forecastProducts->toArray(),
        ];
    }

    private function calculateRiskLevel(
        int $currentStock,
        int $threshold,
        ?float $daysUntilStockout,
        float $projectedDemand
    ): string {
        if ($currentStock <= $threshold) {
            return 'critical';
        }

        if ($projectedDemand >= $currentStock) {
            return 'high';
        }

        if ($daysUntilStockout !== null && $daysUntilStockout <= 7) {
            return 'high';
        }

        if ($daysUntilStockout !== null && $daysUntilStockout <= 30) {
            return 'medium';
        }

        return 'low';
    }

    private function calculateRecommendedRestockQuantity(
        int $currentStock,
        int $threshold,
        float $projectedDemand,
        string $riskLevel
    ): int {
        if ($riskLevel === 'low') {
            return 0;
        }

        $targetStock = ceil($projectedDemand + $threshold);

        return max(0, (int) $targetStock - $currentStock);
    }

    private function getRecommendedAction(string $riskLevel): string
    {
        return match ($riskLevel) {
            'critical' => 'Réapprovisionner immédiatement.',
            'high' => 'Planifier un réapprovisionnement urgent.',
            'medium' => 'Surveiller le stock et préparer une commande fournisseur.',
            default => 'Stock stable, aucune action urgente.',
        };
    }
}