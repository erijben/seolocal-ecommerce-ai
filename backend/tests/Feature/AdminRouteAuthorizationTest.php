<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Ai\AiAgentAnalyticsService;
use App\Services\Ai\AiStockForecastService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Mockery\MockInterface;
use Tests\TestCase;

class AdminRouteAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_authenticated_or_admin_endpoints(): void
    {
        foreach ([
            '/api/me',
            '/api/categories',
            '/api/products',
            '/api/customers',
            '/api/orders',
            '/api/dashboard/stats',
            '/api/ai/stock-forecast',
            '/api/ai/questions',
            '/api/ai/reports',
            '/api/ai/agent-insights',
            '/api/knowledge-documents',
        ] as $endpoint) {
            $this->getJson($endpoint)->assertUnauthorized();
        }

        $this->postJson('/api/ai/ask', [
            'question' => 'Question suffisamment longue',
        ])->assertUnauthorized();

        $this->postJson('/api/ai/generate-report', [
            'type' => 'sales_report',
        ])->assertUnauthorized();

        $this->postJson('/api/knowledge-search', [
            'query' => 'politique de retour',
        ])->assertUnauthorized();
    }

    public function test_me_endpoint_exposes_the_authenticated_manager_role(): void
    {
        Sanctum::actingAs($this->userWithRole('manager'));

        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.role', 'manager');
    }

    public function test_manager_cannot_access_admin_only_endpoints(): void
    {
        Sanctum::actingAs($this->userWithRole('manager'));

        $this->getJson('/api/ai/agent-insights')->assertForbidden();
        $this->getJson('/api/knowledge-documents')->assertForbidden();
        $this->postJson('/api/knowledge-search', [
            'query' => 'politique de retour',
        ])->assertForbidden();
    }

    public function test_manager_can_access_shared_business_endpoints(): void
    {
        $this->mock(
            AiStockForecastService::class,
            function (MockInterface $mock): void {
                $mock->shouldReceive('getStockForecast')
                    ->once()
                    ->andReturn([
                        'provider' => 'test',
                        'model_version' => 'test',
                        'summary' => [],
                        'products' => [],
                    ]);
            }
        );

        Sanctum::actingAs($this->userWithRole('manager'));

        foreach ([
            '/api/categories',
            '/api/products',
            '/api/customers',
            '/api/orders',
            '/api/dashboard/stats',
            '/api/ai/stock-forecast',
            '/api/ai/questions',
            '/api/ai/reports',
        ] as $endpoint) {
            $this->getJson($endpoint)->assertOk();
        }

        // A validation response proves that authentication/authorization
        // allowed the request to reach each shared AI controller action.
        $this->postJson('/api/ai/ask', [])->assertUnprocessable();
        $this->postJson('/api/ai/generate-report', [
            'type' => 'unknown',
        ])->assertUnprocessable();
    }

    public function test_admin_can_access_an_admin_only_endpoint(): void
    {
        $this->mock(
            AiAgentAnalyticsService::class,
            function (MockInterface $mock): void {
                $mock->shouldReceive('getInsights')
                    ->once()
                    ->andReturn([
                        'overview' => [],
                        'intent_distribution' => [],
                        'provider_distribution' => [],
                        'recent_questions' => [],
                    ]);
            }
        );

        Sanctum::actingAs($this->userWithRole('admin'));

        $this->getJson('/api/ai/agent-insights')->assertOk();
        $this->getJson('/api/knowledge-documents')->assertOk();
    }

    private function userWithRole(string $role): User
    {
        $user = new User([
            'name' => ucfirst($role),
            'email' => $role.'@example.test',
            'role' => $role,
        ]);

        $user->id = $role === 'admin' ? 1 : 2;
        $user->exists = true;

        return $user;
    }
}
