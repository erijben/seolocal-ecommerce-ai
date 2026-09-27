<?php

namespace Tests\Feature;

use App\Services\Ai\Microservice\AiMicroserviceClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AiMicroserviceRequestIdTest extends TestCase
{
    private const REQUEST_ID = '55555555-5555-4555-8555-555555555555';

    protected function setUp(): void
    {
        parent::setUp();

        config()->set([
            'services.ai_microservice.base_url' => 'http://ai.test',
            'services.ai_microservice.api_key' => 'test-key',
            'services.ai_microservice.connect_timeout' => 1,
            'services.ai_microservice.timeout' => 1,
        ]);
    }

    public function test_success_without_remote_header_keeps_laravel_id(): void
    {
        Http::fake(['*' => Http::response(['status' => 'ok'])]);

        $result = $this->client()->ask(
            question: 'Question',
            requestId: self::REQUEST_ID,
        );

        $this->assertSame(self::REQUEST_ID, $result['request_id']);
        Http::assertSent(fn (Request $request): bool => $request->hasHeader(
            'X-Request-ID', self::REQUEST_ID
        ));
    }

    public function test_http_error_keeps_laravel_id(): void
    {
        Http::fake(['*' => Http::response([
            'detail' => ['code' => 'provider_timeout'],
        ], 503)]);

        $result = $this->client()->ask('Question', requestId: self::REQUEST_ID);

        $this->assertSame('error', $result['status']);
        $this->assertSame(self::REQUEST_ID, $result['request_id']);
    }

    public function test_connection_error_keeps_laravel_id(): void
    {
        Http::fake(fn () => Http::failedConnection());

        $result = $this->client()->ask('Question', requestId: self::REQUEST_ID);

        $this->assertSame('ai_microservice_unavailable', $result['error_code']);
        $this->assertSame(self::REQUEST_ID, $result['request_id']);
    }

    public function test_timeout_keeps_laravel_id(): void
    {
        Http::fake(function (): never {
            throw new ConnectionException('Simulated timeout.');
        });

        $result = $this->client()->ask('Question', requestId: self::REQUEST_ID);

        $this->assertSame('ai_microservice_unavailable', $result['error_code']);
        $this->assertSame(self::REQUEST_ID, $result['request_id']);
    }

    public function test_missing_configuration_keeps_laravel_id(): void
    {
        config()->set('services.ai_microservice.base_url', '');

        $result = $this->client()->ask('Question', requestId: self::REQUEST_ID);

        $this->assertSame('base_url_missing', $result['error_code']);
        $this->assertSame(self::REQUEST_ID, $result['request_id']);
        Http::assertNothingSent();
    }

    public function test_different_remote_header_cannot_replace_laravel_id(): void
    {
        Http::fake(['*' => Http::response(
            ['status' => 'ok'],
            200,
            ['X-Request-ID' => '66666666-6666-4666-8666-666666666666']
        )]);

        $result = $this->client()->ask('Question', requestId: self::REQUEST_ID);

        $this->assertSame(self::REQUEST_ID, $result['request_id']);
    }

    private function client(): AiMicroserviceClient
    {
        return new AiMicroserviceClient();
    }
}
