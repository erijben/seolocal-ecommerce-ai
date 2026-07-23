<?php

namespace App\Services\Ai\Providers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class OllamaProvider implements AiProviderInterface
{
    public function name(): string
    {
        return 'ollama';
    }

    public function chat(array $messages, array $options = []): ?string
    {
        $requestId = $options['request_id'] ?? null;
        $purpose = $options['purpose'] ?? 'final_answer';

        $baseUrl = rtrim((string) config('services.ollama.url'), '/');
        $model = (string) config('services.ollama.model', 'llama3.2:1b');

        if ($baseUrl === '') {
            Log::warning('Ollama skipped: empty base URL', [
                'request_id' => $requestId,
                'purpose' => $purpose,
            ]);

            return null;
        }

        $timeout = match ($purpose) {
    'tool_routing' => 5,
    'report' => (int) config('services.ollama.report_timeout', 240),
    default => (int) config('services.ollama.timeout', 120),
};

             $numPredict = match ($purpose) {
            'tool_routing' => 80,
            'report' => (int) config('services.ollama.report_num_predict', 700),
            default => (int) config('services.ollama.num_predict', 240),
        };

        $numContext = $purpose === 'report'
            ? (int) config('services.ollama.report_num_ctx', 4096)
            : (int) config('services.ollama.num_ctx', 1024);
        $totalMessageLength = collect($messages)
            ->sum(fn ($message) => mb_strlen((string) ($message['content'] ?? '')));

        $startedAt = microtime(true);

        try {
            Log::info('Ollama request started', [
                'request_id' => $requestId,
                'purpose' => $purpose,
                'model' => $model,
                'timeout' => $timeout,
                'message_length' => $totalMessageLength,
            ]);

            $response = Http::connectTimeout(3)
                ->timeout($timeout)
                ->post($baseUrl . '/api/chat', [
                    'model' => $model,
                    'messages' => $messages,
                    'stream' => false,
                    'keep_alive' => config('services.ollama.keep_alive', '30m'),
                    'options' => [
                        'temperature' => (float) config('services.ollama.temperature', 0.2),
                        'num_predict' => $numPredict,
                        'num_ctx' => $numContext,
                    ],
                ]);

            $durationSeconds = round(microtime(true) - $startedAt, 2);

            Log::info('Ollama response received', [
                'request_id' => $requestId,
                'purpose' => $purpose,
                'model' => $model,
                'status' => $response->status(),
                'duration_seconds' => $durationSeconds,
            ]);

            if (! $response->successful()) {
                Log::warning('Ollama returned non-success status', [
                    'request_id' => $requestId,
                    'purpose' => $purpose,
                    'model' => $model,
                    'status' => $response->status(),
                    'duration_seconds' => $durationSeconds,
                ]);

                return null;
            }

            $content = data_get($response->json(), 'message.content');

            if (! is_string($content) || trim($content) === '') {
                Log::warning('Ollama returned empty content', [
                    'request_id' => $requestId,
                    'purpose' => $purpose,
                    'model' => $model,
                    'status' => $response->status(),
                    'duration_seconds' => $durationSeconds,
                ]);

                return null;
            }

            return trim($content);
        } catch (Throwable $exception) {
            Log::warning('Ollama request failed', [
                'request_id' => $requestId,
                'purpose' => $purpose,
                'model' => $model,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
                'duration_seconds' => round(microtime(true) - $startedAt, 2),
            ]);

            return null;
        }
    }
}