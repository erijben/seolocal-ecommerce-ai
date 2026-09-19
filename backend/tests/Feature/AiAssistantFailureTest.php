<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AiController;
use App\Models\User;
use App\Services\AiService;
use Illuminate\Http\Request;
use Mockery\MockInterface;
use Tests\TestCase;

class AiAssistantFailureTest extends TestCase
{
    public function test_failed_ai_answer_returns_before_persistence(): void
    {
        $aiService = $this->mock(
            AiService::class,
            function (MockInterface $mock): void {
                $mock->shouldReceive('answerQuestion')
                    ->once()
                    ->andReturn([
                        'status' => 'error',
                        'answer' => null,
                        'intent' => 'business_analysis',
                        'provider' => 'none',
                        'used_data' => [],
                        'error_code' => 'ai_microservice_unavailable',
                        'message' => (
                            'Le microservice IA est temporairement '
                            .'indisponible.'
                        ),
                    ]);
            }
        );

        $request = Request::create(
            '/api/ai/ask',
            'POST',
            [
                'question' => (
                    'Quels produits faut-il réapprovisionner ?'
                ),
            ]
        );

        $request->setUserResolver(
            fn (): User => new User([
                'id' => 1,
            ])
        );

        $response = (new AiController($aiService))->ask(
            $request
        );

        $this->assertSame(503, $response->getStatusCode());
        $this->assertSame([
            'success' => false,
            'message' => (
                'Le microservice IA est temporairement '
                .'indisponible.'
            ),
            'error_code' => 'ai_microservice_unavailable',
        ], $response->getData(true));
    }

    public function test_failed_ai_report_returns_before_persistence(): void
    {
        $aiService = $this->mock(
            AiService::class,
            function (MockInterface $mock): void {
                $mock->shouldReceive('generateReport')
                    ->once()
                    ->andReturn([
                        'status' => 'error',
                        'provider' => 'none',
                        'content' => null,
                        'error_code' => 'provider_timeout',
                    ]);
            }
        );

        $request = Request::create(
            '/api/ai/generate-report',
            'POST',
            [
                'type' => 'sales_report',
                'period' => 'monthly',
            ]
        );

        $response = (new AiController($aiService))
            ->generateReport($request);

        $this->assertSame(503, $response->getStatusCode());
        $this->assertFalse($response->getData(true)['success']);
    }

    public function test_all_report_types_and_periods_are_accepted(): void
    {
        $types = [
            'sales_report',
            'stock_recommendation',
            'customer_analysis',
            'marketing_recommendation',
        ];
        $periods = [
            'daily',
            'weekly',
            'monthly',
            'yearly',
        ];

        $aiService = $this->mock(
            AiService::class,
            function (MockInterface $mock): void {
                $mock->shouldReceive('generateReport')
                    ->times(16)
                    ->andReturn([
                        'status' => 'error',
                        'provider' => 'none',
                        'content' => null,
                        'error_code' => 'provider_timeout',
                    ]);
            }
        );

        $controller = new AiController($aiService);

        foreach ($types as $type) {
            foreach ($periods as $period) {
                $request = Request::create(
                    '/api/ai/generate-report',
                    'POST',
                    compact('type', 'period')
                );

                $response = $controller->generateReport(
                    $request
                );

                $this->assertSame(
                    503,
                    $response->getStatusCode(),
                    "Combination {$type}/{$period} was rejected."
                );
            }
        }
    }
}
