<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Ai\AiAgentAnalyticsService;
use Laravel\Sanctum\Sanctum;
use Mockery\MockInterface;
use Tests\TestCase;

class AdminRouteAuthorizationTest extends TestCase
{
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
