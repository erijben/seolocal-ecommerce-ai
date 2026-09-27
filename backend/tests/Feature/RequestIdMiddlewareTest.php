<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use RuntimeException;
use Tests\TestCase;

class RequestIdMiddlewareTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Route::get('/api/request-id-test/ok', fn () => response()->json([
            'success' => true,
            'resolved_request_id' => request()->attributes->get(
                'request_id'
            ),
        ]));

        Route::get('/api/request-id-test/error', function (): never {
            throw new RuntimeException('Expected request ID test failure.');
        });
    }

    public function test_valid_client_uuid_is_preserved_on_success(): void
    {
        $requestId = (string) Str::uuid();

        $this->withHeader('X-Request-ID', $requestId)
            ->getJson('/api/request-id-test/ok')
            ->assertOk()
            ->assertHeader('X-Request-ID', $requestId)
            ->assertJsonPath('resolved_request_id', $requestId);
    }

    public function test_missing_header_generates_a_canonical_uuid(): void
    {
        $response = $this->getJson('/api/request-id-test/ok');

        $response->assertOk();
        $this->assertCanonicalUuid(
            $response->headers->get('X-Request-ID')
        );
    }

    public function test_invalid_or_oversized_values_are_replaced(): void
    {
        foreach (['not-a-uuid', str_repeat('a', 500)] as $invalidId) {
            $response = $this->withHeader('X-Request-ID', $invalidId)
                ->getJson('/api/request-id-test/ok');

            $generatedId = $response->headers->get('X-Request-ID');

            $response->assertOk();
            $this->assertCanonicalUuid($generatedId);
            $this->assertNotSame($invalidId, $generatedId);
        }
    }

    public function test_requests_without_a_header_receive_distinct_ids(): void
    {
        $firstId = $this->getJson('/api/request-id-test/ok')
            ->headers->get('X-Request-ID');
        $secondId = $this->getJson('/api/request-id-test/ok')
            ->headers->get('X-Request-ID');

        $this->assertCanonicalUuid($firstId);
        $this->assertCanonicalUuid($secondId);
        $this->assertNotSame($firstId, $secondId);
    }

    public function test_header_is_present_on_401_403_404_422_and_500(): void
    {
        $this->assertResponseHasRequestId(
            $this->getJson('/api/me')->assertUnauthorized()
        );

        Sanctum::actingAs($this->userWithRole('manager'));
        $this->assertResponseHasRequestId(
            $this->getJson('/api/ai/agent-insights')->assertForbidden()
        );

        $this->assertResponseHasRequestId(
            $this->getJson('/api/route-that-does-not-exist')->assertNotFound()
        );

        $validationResponse = $this->postJson('/api/login', []);
        $validationResponse
            ->assertUnprocessable()
            ->assertJsonStructure(['message', 'errors'])
            ->assertJsonMissing(['request_id']);
        $this->assertResponseHasRequestId($validationResponse);

        $this->assertResponseHasRequestId(
            $this->getJson('/api/request-id-test/error')
                ->assertInternalServerError()
        );
    }

    private function assertResponseHasRequestId($response): void
    {
        $this->assertCanonicalUuid(
            $response->headers->get('X-Request-ID')
        );
    }

    private function assertCanonicalUuid(mixed $requestId): void
    {
        $this->assertIsString($requestId);
        $this->assertSame(36, strlen($requestId));
        $this->assertTrue(Str::isUuid($requestId));
    }

    private function userWithRole(string $role): User
    {
        $user = new User([
            'name' => ucfirst($role),
            'email' => $role.'@request-id.test',
            'role' => $role,
        ]);

        $user->id = 2;
        $user->exists = true;

        return $user;
    }
}
