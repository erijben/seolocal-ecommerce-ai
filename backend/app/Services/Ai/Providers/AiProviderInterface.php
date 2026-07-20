<?php

namespace App\Services\Ai\Providers;

interface AiProviderInterface
{
    public function chat(array $messages, array $options = []): ?string;

    public function name(): string;
}