<?php

namespace App\Services\Ai\Providers;

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
        $preferredProvider = config('services.ai.provider', 'openai');

        $providers = $preferredProvider === 'ollama'
            ? [$this->ollamaProvider, $this->openAiProvider]
            : [$this->openAiProvider, $this->ollamaProvider];

        foreach ($providers as $provider) {
            try {
                $answer = $provider->chat($messages, $options);
            } catch (Throwable) {
                $answer = null;
            }

            if (is_string($answer) && trim($answer) !== '') {
                return [
                    'provider' => $provider->name(),
                    'answer' => trim($answer),
                ];
            }
        }

        return [
            'provider' => 'none',
            'answer' => null,
        ];
    }
}