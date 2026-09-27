<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class RequestIdMiddleware
{
    public const ATTRIBUTE = 'request_id';

    public const HEADER = 'X-Request-ID';

    public function handle(Request $request, Closure $next): Response
    {
        $requestId = $this->resolveRequestId(
            $request->header(self::HEADER)
        );

        $request->attributes->set(self::ATTRIBUTE, $requestId);
        Log::withContext([self::ATTRIBUTE => $requestId]);

        try {
            $response = $next($request);
            $response->headers->set(self::HEADER, $requestId);

            return $response;
        } finally {
            Log::withoutContext([self::ATTRIBUTE]);
        }
    }

    private function resolveRequestId(mixed $candidate): string
    {
        if (
            is_string($candidate)
            && strlen($candidate) === 36
            && Str::isUuid($candidate)
        ) {
            return $candidate;
        }

        return (string) Str::uuid();
    }
}
