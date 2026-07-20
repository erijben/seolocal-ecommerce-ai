<?php

namespace App\Services\Ai\Providers;

use Illuminate\Support\Facades\Http;
use Throwable;

class OpenAiProvider implements AiProviderInterface
{
    public function name(): string
    {
        return 'openai';
    }

    public function chat(array $messages, array $options = []): ?string
    {
        $apiKey = config('services.openai.key');

        if (! is_string($apiKey) || trim($apiKey) === '') {
            return null;
        }

        try {
            $input = collect($messages)
                ->map(function (array $message) {
                    $role = $message['role'] ?? 'user';
                    $content = $message['content'] ?? '';

                    return strtoupper($role) . ":\n" . $content;
                })
                ->implode("\n\n");

            $response = Http::withToken($apiKey)
                ->timeout((int) config('services.openai.timeout', 60))
                ->post('https://api.openai.com/v1/responses', [
                    'model' => config('services.openai.model', 'gpt-4.1-mini'),
                    'input' => $input,
                    'temperature' => (float) config('services.openai.temperature', 0.2),
                    'max_output_tokens' => (int) config('services.openai.max_output_tokens', 900),
                ]);

            if (! $response->successful()) {
                return null;
            }

            return $this->extractText($response->json());
        } catch (Throwable) {
            return null;
        }
    }

    private function extractText(array $json): ?string
    {
        if (isset($json['output_text']) && is_string($json['output_text'])) {
            return trim($json['output_text']);
        }

        $texts = [];

        foreach (($json['output'] ?? []) as $outputItem) {
            foreach (($outputItem['content'] ?? []) as $contentItem) {
                if (isset($contentItem['text'])) {
                    $texts[] = $contentItem['text'];
                }
            }
        }

        $text = trim(implode("\n", $texts));

        return $text !== '' ? $text : null;
    }
}