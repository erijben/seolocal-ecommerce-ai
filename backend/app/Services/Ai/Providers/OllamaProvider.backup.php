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
        $baseUrl = rtrim((string) config('services.ollama.url'), '/');
        $model = (string) config('services.ollama.model', 'llama3.2:1b');

        if ($baseUrl === '') {
            Log::warning('Ollama skipped: empty base URL');
            return null;
        }

        $purpose = $options['purpose'] ?? 'final_answer';

        $timeout = $purpose === 'tool_routing'
            ? 5
            : (int) config('services.ollama.timeout', 120);

        $numPredict = $purpose === 'tool_routing'
            ? 80
            : 160;

        $totalMessageLength = collect($messages)
            ->sum(fn ($message) => mb_strlen((string) ($message['content'] ?? '')));

        $startedAt = microtime(true);

        try {
            Log::info('Ollama request started', [
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
                        'num_ctx' => 1024,
                    ],
                ]);

            $duration = round(microtime(true) - $startedAt, 2);

            Log::info('Ollama response received', [
                'purpose' => $purpose,
                'model' => $model,
                'status' => $response->status(),
                'duration_seconds' => $duration,
            ]);

            if (! $response->successful()) {
                Log::warning('Ollama returned non-success status', [
                    'status' => $response->status(),
                    'duration_seconds' => $duration,
                    'body' => mb_substr($response->body(), 0, 1000),
                ]);

                return null;
            }

            $content = data_get($response->json(), 'message.content');

            if (! is_string($content) || trim($content) === '') {
                Log::warning('Ollama returned empty content', [
                    'duration_seconds' => $duration,
                    'status' => $response->status(),
                ]);

                return null;
            }

            return trim($content);
        } catch (Throwable $exception) {
            Log::warning('Ollama request failed', [
                'purpose' => $purpose,
                'model' => $model,
                'message' => $exception->getMessage(),
                'duration_seconds' => round(microtime(true) - $startedAt, 2),
            ]);

            return null;
        }
    }
}