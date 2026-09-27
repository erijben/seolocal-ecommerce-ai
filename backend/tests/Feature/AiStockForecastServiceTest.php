<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Services\Ai\AiStockForecastService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class AiStockForecastServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set([
            'services.ml_service.url' => 'http://ml.test',
            'services.ml_service.forecast_horizon_days' => 30,
            'services.ml_service.timeout' => 9,
        ]);

        Carbon::setTestNow('2026-01-10 12:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_payload_contains_exact_window_and_excludes_cancelled_sales(): void
    {
        $category = $this->category();
        $product = $this->product($category, [
            'name' => 'Produit actif',
            'price' => 12.50,
            'stock_quantity' => 8,
            'stock_alert_threshold' => 3,
        ]);
        $this->product($category, [
            'name' => 'Produit inactif',
            'status' => 'inactive',
        ]);

        $this->sale($product, '2026-01-10 08:00:00', 2);
        $this->sale($product, '2026-01-10 18:00:00', 3);
        $this->sale(
            $product,
            '2026-01-10 20:00:00',
            100,
            'cancelled'
        );

        Http::fake([
            'http://ml.test/forecast/stock' => Http::response(
                $this->validMlResponse([])
            ),
        ]);

        $result = $this->service()->getStockForecast(2, 'payload-test');

        $this->assertSame('empty', $result['status']);
        Http::assertSent(function (Request $request) use ($product): bool {
            $payload = $request->data();
            $products = $payload['products'];

            return $request->method() === 'POST'
                && $request->url() === 'http://ml.test/forecast/stock'
                && $request->hasHeader('X-Request-ID', 'payload-test')
                && $payload['analysis_window_days'] === 2
                && $payload['forecast_horizon_days'] === 30
                && count($products) === 1
                && $products[0]['product_id'] === $product->id
                && $products[0]['product_name'] === 'Produit actif'
                && $products[0]['category'] === 'Test'
                && $products[0]['price'] === 12.5
                && $products[0]['current_stock'] === 8
                && $products[0]['stock_alert_threshold'] === 3
                && $products[0]['daily_sales'] === [
                    ['date' => '2026-01-09', 'quantity' => 0],
                    ['date' => '2026-01-10', 'quantity' => 5],
                ];
        });
    }

    public function test_valid_ml_response_is_used(): void
    {
        $this->product($this->category());
        $mlProduct = [
            'product_id' => 1,
            'risk_level' => 'high',
        ];

        Http::fake([
            '*' => Http::response(
                $this->validMlResponse([$mlProduct])
            ),
        ]);

        $result = $this->service()->getStockForecast(2);

        $this->assertSame('ok', $result['status']);
        $this->assertSame('python_scikit_learn', $result['provider']);
        $this->assertSame([$mlProduct], $result['products']);
    }

    public function test_valid_ml_response_with_empty_products_is_accepted(): void
    {
        Http::fake([
            '*' => Http::response($this->validMlResponse([])),
        ]);

        $result = $this->service()->getStockForecast(2);

        $this->assertSame('empty', $result['status']);
        $this->assertSame('python_scikit_learn', $result['provider']);
        $this->assertSame([], $result['products']);
    }

    public function test_http_500_uses_laravel_fallback(): void
    {
        $this->product($this->category());
        Http::fake(['*' => Http::response([], 500)]);

        $this->assertFallback($this->service()->getStockForecast(2));
    }

    public function test_connection_failure_uses_laravel_fallback(): void
    {
        $this->product($this->category());
        Http::fake(fn () => Http::failedConnection());
        Log::spy();

        $requestId = '33333333-3333-4333-8333-333333333333';
        $this->assertFallback(
            $this->service()->getStockForecast(2, $requestId)
        );

        Http::assertSent(fn (Request $request): bool => $request->hasHeader(
            'X-Request-ID',
            $requestId
        ));
        Log::shouldHaveReceived('warning')->withArgs(
            fn (string $message, array $context): bool =>
                $message === 'AI stock forecast using Laravel baseline'
                && ($context['request_id'] ?? null) === $requestId
        );
    }

    public function test_empty_response_uses_laravel_fallback(): void
    {
        $this->product($this->category());
        Http::fake(['*' => Http::response('', 200)]);

        $this->assertFallback($this->service()->getStockForecast(2));
    }

    public function test_non_json_response_uses_laravel_fallback(): void
    {
        $this->product($this->category());
        Http::fake([
            '*' => Http::response(
                'not-json',
                200,
                ['Content-Type' => 'application/json']
            ),
        ]);

        $this->assertFallback($this->service()->getStockForecast(2));
    }

    public function test_structurally_invalid_json_uses_laravel_fallback(): void
    {
        $invalidPayloads = [
            [],
            ['unexpected' => 'value'],
            [
                'provider' => 'python_scikit_learn',
                'model_version' => 'linear-regression-v1',
                'summary' => [],
            ],
            [
                'provider' => '',
                'model_version' => 'linear-regression-v1',
                'summary' => [],
                'products' => [],
            ],
            [
                'provider' => 'python_scikit_learn',
                'model_version' => '   ',
                'summary' => [],
                'products' => [],
            ],
        ];

        foreach ($invalidPayloads as $invalidPayload) {
            Http::fake([
                '*' => Http::response($invalidPayload),
            ]);

            $result = $this->service()->getStockForecast(2);

            $this->assertFallback($result);
        }
    }

    public function test_fallback_uses_same_two_day_window_for_velocity_and_restock(): void
    {
        config()->set(
            'services.ml_service.forecast_horizon_days',
            3
        );
        $product = $this->product($this->category(), [
            'stock_quantity' => 0,
            'stock_alert_threshold' => 1,
        ]);
        $this->sale($product, '2026-01-10 10:00:00', 4);
        Http::fake(['*' => Http::response([], 500)]);

        $result = $this->service()->getStockForecast(2);
        $forecast = $result['products'][0];

        $this->assertSame('laravel_baseline', $result['provider']);
        $this->assertSame('2026-01-09 00:00:00', $result['analysis_start_date']);
        $this->assertSame('2026-01-10 23:59:59', $result['analysis_end_date']);
        $this->assertSame(4, $forecast['total_sold']);
        $this->assertSame(2.0, $forecast['daily_sales_velocity']);
        $this->assertSame(6.0, $forecast['projected_demand_30_days']);
        $this->assertSame('critical', $forecast['risk_level']);
        $this->assertSame(7, $forecast['recommended_restock_quantity']);
    }

    public function test_fallback_handles_no_sales_without_negative_restock(): void
    {
        $this->product($this->category(), [
            'stock_quantity' => 10,
            'stock_alert_threshold' => 2,
        ]);
        Http::fake(['*' => Http::response([], 500)]);

        $forecast = $this->service()
            ->getStockForecast(2)['products'][0];

        $this->assertSame(0, $forecast['total_sold']);
        $this->assertSame(0.0, $forecast['projected_demand_30_days']);
        $this->assertSame('low', $forecast['risk_level']);
        $this->assertSame(0, $forecast['recommended_restock_quantity']);
    }

    public function test_fallback_sorts_products_by_risk(): void
    {
        config()->set(
            'services.ml_service.forecast_horizon_days',
            2
        );
        $category = $this->category();
        $low = $this->product($category, [
            'name' => 'Low',
            'stock_quantity' => 100,
            'stock_alert_threshold' => 0,
        ]);
        $critical = $this->product($category, [
            'name' => 'Critical',
            'stock_quantity' => 0,
            'stock_alert_threshold' => 0,
        ]);
        $medium = $this->product($category, [
            'name' => 'Medium',
            'stock_quantity' => 5,
            'stock_alert_threshold' => 0,
        ]);
        $high = $this->product($category, [
            'name' => 'High',
            'stock_quantity' => 1,
            'stock_alert_threshold' => 0,
        ]);
        $this->sale($low, '2026-01-10 10:00:00', 1);
        $this->sale($medium, '2026-01-10 10:00:00', 1);
        $this->sale($high, '2026-01-10 10:00:00', 2);
        Http::fake(['*' => Http::response([], 500)]);

        $products = $this->service()->getStockForecast(2)['products'];

        $this->assertSame(
            ['critical', 'high', 'medium', 'low'],
            array_column($products, 'risk_level')
        );
    }

    private function validMlResponse(array $products): array
    {
        return [
            'provider' => 'python_scikit_learn',
            'model_version' => 'linear-regression-v1',
            'summary' => [
                'total_products_analyzed' => count($products),
            ],
            'products' => $products,
        ];
    }

    private function assertFallback(array $result): void
    {
        $this->assertSame('laravel_baseline', $result['provider']);
        $this->assertSame(
            'moving-average-baseline-v1',
            $result['model_version']
        );
    }

    private function service(): AiStockForecastService
    {
        return new AiStockForecastService();
    }

    private function category(): Category
    {
        return Category::create([
            'name' => 'Test',
            'description' => null,
        ]);
    }

    private function product(
        Category $category,
        array $attributes = []
    ): Product {
        return Product::create(array_merge([
            'category_id' => $category->id,
            'name' => 'Produit',
            'description' => null,
            'price' => 10,
            'stock_quantity' => 10,
            'stock_alert_threshold' => 2,
            'status' => 'active',
        ], $attributes));
    }

    private function sale(
        Product $product,
        string $orderDate,
        int $quantity,
        string $status = 'delivered'
    ): void {
        $customer = Customer::create([
            'first_name' => 'Client',
            'last_name' => 'Test',
            'email' => uniqid('client-', true).'@example.test',
            'phone' => null,
            'address' => null,
            'city' => null,
            'postal_code' => null,
        ]);
        $order = Order::create([
            'customer_id' => $customer->id,
            'order_number' => uniqid('ORDER-', true),
            'status' => $status,
            'total_amount' => $quantity * (float) $product->price,
            'order_date' => $orderDate,
        ]);
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => $quantity,
            'unit_price' => $product->price,
            'subtotal' => $quantity * (float) $product->price,
        ]);
    }
}
