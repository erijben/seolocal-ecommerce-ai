<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AiController;
use App\Http\Middleware\RequestIdMiddleware;
use App\Models\User;
use App\Services\Ai\AiStockForecastService;
use App\Services\AiService;
use Illuminate\Http\Request;
use Mockery;
use Tests\TestCase;

class AiControllerRequestIdPropagationTest extends TestCase
{
    private const REQUEST_ID = '44444444-4444-4444-8444-444444444444';

    public function test_assistant_passes_laravel_request_id_to_service(): void
    {
        $service = Mockery::mock(AiService::class);
        $service->shouldReceive('answerQuestion')
            ->once()
            ->with('Question de test valide', 7, self::REQUEST_ID)
            ->andReturn($this->assistantError());

        $request = $this->request('/api/ai/ask', 'POST', [
            'question' => 'Question de test valide',
        ], withUser: true);

        (new AiController($service))->ask($request);
    }

    public function test_report_passes_laravel_request_id_to_service(): void
    {
        $service = Mockery::mock(AiService::class);
        $service->shouldReceive('generateReport')
            ->once()
            ->with('sales_report', 'monthly', self::REQUEST_ID)
            ->andReturn([
                'status' => 'error',
                'provider' => 'none',
                'content' => null,
                'error_code' => 'provider_timeout',
            ]);

        $request = $this->request('/api/ai/generate-report', 'POST', [
            'type' => 'sales_report',
            'period' => 'monthly',
        ]);

        (new AiController($service))->generateReport($request);
    }

    public function test_stock_forecast_passes_laravel_request_id_to_service(): void
    {
        $service = Mockery::mock(AiService::class);
        $forecast = Mockery::mock(AiStockForecastService::class);
        $forecast->shouldReceive('getStockForecast')
            ->once()
            ->with(90, self::REQUEST_ID)
            ->andReturn([
                'status' => 'empty',
                'provider' => 'laravel_baseline',
                'products' => [],
            ]);

        $request = $this->request('/api/ai/stock-forecast', 'GET');

        (new AiController($service))->stockForecast($request, $forecast);
    }

    private function request(
        string $uri,
        string $method,
        array $data = [],
        bool $withUser = false
    ): Request {
        $request = Request::create($uri, $method, $data);
        $request->attributes->set(
            RequestIdMiddleware::ATTRIBUTE,
            self::REQUEST_ID
        );

        if ($withUser) {
            $request->setUserResolver(function (): User {
                $user = new User(['name' => 'Test']);
                $user->id = 7;

                return $user;
            });
        }

        return $request;
    }

    private function assistantError(): array
    {
        return [
            'status' => 'error',
            'answer' => null,
            'intent' => 'business_analysis',
            'provider' => 'none',
            'used_data' => [],
            'error_code' => 'provider_timeout',
            'message' => 'Service indisponible.',
        ];
    }
}
