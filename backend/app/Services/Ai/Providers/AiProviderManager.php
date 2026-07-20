<?php

namespace App\Services\Ai\Providers;

use Illuminate\Support\Facades\Log;
use Throwable;

class AiProviderManager
{
    public function __construct(
        private OpenAiProvider $openAiProvider,
        private OllamaProvider $ollamaProvider,
    ) {
    }

    public function chat(array $messages, array $options = []): array
    {
        $requestId = $options['request_id'] ?? null;
        $purpose = $options['purpose'] ?? 'final_answer';
        $startedAt = microtime(true);

        $promptLength = collect($messages)
            ->sum(fn ($message) => mb_strlen((string) ($message['content'] ?? '')));

        $preferredProvider = strtolower((string) config('services.ai.provider', 'ollama'));
        $allowFallback = (bool) config('services.ai.allow_provider_fallback', false);

        $providers = match ($preferredProvider) {
            'ollama' => [$this->ollamaProvider],
            'openai' => [$this->openAiProvider],
            default => [],
        };

        if ($allowFallback) {
            if ($preferredProvider === 'ollama') {
                $providers[] = $this->openAiProvider;
            }

            if ($preferredProvider === 'openai') {
                $providers[] = $this->ollamaProvider;
            }
        }

        if (empty($providers)) {
            Log::warning('AI provider manager: invalid provider configured', [
                'request_id' => $requestId,
                'configured_provider' => $preferredProvider,
                'purpose' => $purpose,
                'prompt_length' => $promptLength,
                'fallback_enabled' => $allowFallback,
                'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
            ]);

            return [
                'provider' => 'none',
                'answer' => null,
            ];
        }

        foreach ($providers as $provider) {
            $providerStartedAt = microtime(true);

            try {
                Log::info('AI provider call started', [
                    'request_id' => $requestId,
                    'provider' => $provider->name(),
                    'purpose' => $purpose,
                    'prompt_length' => $promptLength,
                    'fallback_enabled' => $allowFallback,
                ]);

                $answer = $provider->chat($messages, $options);

                $durationMs = (int) round((microtime(true) - $providerStartedAt) * 1000);

                if (is_string($answer) && trim($answer) !== '') {
                    Log::info('AI provider call succeeded', [
                        'request_id' => $requestId,
                        'provider' => $provider->name(),
                        'purpose' => $purpose,
                        'prompt_length' => $promptLength,
                        'duration_ms' => $durationMs,
                    ]);

                    return [
                        'provider' => $provider->name(),
                        'answer' => trim($answer),
                    ];
                }

                Log::warning('AI provider returned empty answer', [
                    'request_id' => $requestId,
                    'provider' => $provider->name(),
                    'purpose' => $purpose,
                    'prompt_length' => $promptLength,
                    'fallback_enabled' => $allowFallback,
                    'duration_ms' => $durationMs,
                ]);
            } catch (Throwable $exception) {
                Log::warning('AI provider failed', [
                    'request_id' => $requestId,
                    'provider' => $provider->name(),
                    'purpose' => $purpose,
                    'prompt_length' => $promptLength,
                    'fallback_enabled' => $allowFallback,
                    'exception' => $exception::class,
                    'message' => $exception->getMessage(),
                    'duration_ms' => (int) round((microtime(true) - $providerStartedAt) * 1000),
                ]);
            }
        }

        Log::warning('AI provider manager: no provider produced an answer', [
            'request_id' => $requestId,
            'configured_provider' => $preferredProvider,
            'purpose' => $purpose,
            'prompt_length' => $promptLength,
            'fallback_enabled' => $allowFallback,
            'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
        ]);

        return [
            'provider' => 'none',
            'answer' => null,
        ];
    }
}