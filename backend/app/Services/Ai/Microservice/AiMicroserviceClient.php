<?php

namespace App\Services\Ai\Microservice;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

final class AiMicroserviceClient
{
    private string $baseUrl;

    private ?string $apiKey;

    private int $connectTimeout;

    private int $timeout;

    public function __construct()
    {
        $this->baseUrl = rtrim(
            (string) config(
                'services.ai_microservice.base_url'
            ),
            '/'
        );

        $configuredApiKey = config(
            'services.ai_microservice.api_key'
        );

        $this->apiKey = is_string($configuredApiKey)
            && $configuredApiKey !== ''
                ? $configuredApiKey
                : null;

        $this->connectTimeout = (int) config(
            'services.ai_microservice.connect_timeout',
            3
        );

        $this->timeout = (int) config(
            'services.ai_microservice.timeout',
            180
        );
    }

    public function isEnabled(): bool
    {
        return (bool) config(
            'services.ai_microservice.enabled',
            false
        );
    }

    public function isConfigured(): bool
    {
        return $this->baseUrl !== ''
            && $this->apiKey !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function health(): array
    {
        return $this->request(
            method: 'GET',
            path: '/api/v1/health',
            authenticated: false,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function tenantContext(): array
    {
        return $this->request(
            method: 'GET',
            path: '/api/v1/auth/context',
            authenticated: true,
        );
    }

    // ajouter l’appel Assistant au client Laravel

    /**
     * @return array<string, mixed>
     */
    public function ask(
        string $question,
        ?int $topK = null,
        ?float $minScore = null,
        ?string $requestId = null
    ): array {
        $payload = [
            'question' => $question,
        ];

        if ($topK !== null) {
            $payload['top_k'] = $topK;
        }

        if ($minScore !== null) {
            $payload['min_score'] = $minScore;
        }

        return $this->request(
            method: 'POST',
            path: '/api/v1/assistant/ask',
            authenticated: true,
            options: [
                'json' => $payload,
            ],
            requestId: $requestId,
        );
    }

    /**
 * @return array<string, mixed>
 */
public function generateAnswer(
    string $question,
    string $context,
    ?string $intent = null,
    ?string $requestId = null
): array {
    $payload = [
        'question' => $question,
        'context' => $context,
    ];

    if ($intent !== null && trim($intent) !== '') {
        $payload['intent'] = $intent;
    }

    return $this->request(
        method: 'POST',
        path: '/api/v1/assistant/generate',
        authenticated: true,
        options: [
            'json' => $payload,
        ],
        requestId: $requestId,
    );
}


/**
 * Sélectionne les actions métier d'un rapport via le microservice IA.
 *
 * @return array<string, mixed>
 */
public function selectReportActions(
    string $reportType,
    string $period,
    string $context,
    ?string $requestId = null
): array {
    return $this->request(
        method: 'POST',
        path: '/api/v1/reports/recommendations',
        authenticated: true,
        options: [
            'json' => [
                'report_type' => $reportType,
                'period' => $period,
                'context' => $context,
            ],
        ],
        requestId: $requestId,
    );
}


    #appelle la liste PostgreSQL du tenant authentifié ;envoie automatiquement X-API-Key ;interdit une limite supérieure à 100 ;
    #conserve le request_id pour le diagnostic ;
    #ne modifie pas encore le contrôleur ni le frontend.
    /**
 * @return array<string, mixed>
 */
public function listKnowledgeDocuments(
    int $limit = 50,
    int $offset = 0,
    ?string $requestId = null
): array {
    $limit = max(1, min($limit, 100));
    $offset = max(0, $offset);

    return $this->request(
        method: 'GET',
        path: '/api/v1/knowledge/documents',
        authenticated: true,
        options: [
            'query' => [
                'limit' => $limit,
                'offset' => $offset,
            ],
        ],
        requestId: $requestId,
    );
}

#retourne les passages sémantiques bruts, sans appeler le LLM. Elle servira à remplacer la recherche lexicale Laravel tout en conservant la route frontend /knowledge-search.
/**
 * @return array<string, mixed>
 */
public function searchKnowledge(
    string $query,
    ?int $topK = null,
    ?float $minScore = null,
    ?string $requestId = null
): array {
    $payload = [
        'query' => $query,
    ];

    if ($topK !== null) {
        $payload['top_k'] = max(1, min($topK, 20));
    }

    if ($minScore !== null) {
        $payload['min_score'] = max(
            0.0,
            min($minScore, 1.0)
        );
    }

    return $this->request(
        method: 'POST',
        path: '/api/v1/knowledge/search',
        authenticated: true,
        options: [
            'json' => $payload,
        ],
        requestId: $requestId,
    );
}


/**
 * @return array<string, mixed>
 */
public function uploadKnowledgeDocument(
    UploadedFile $file,
    string $title,
    ?string $externalId = null,  #il permettra d’associer un document Laravel à son document vectoriel, par exemple laravel-knowledge-document-12, sans dépendre du titre du PDF.
    ?string $requestId = null
): array {
    $realPath = $file->getRealPath();

    if ($realPath === false || ! is_file($realPath)) {
        return [
            'status' => 'error',
            'http_status' => null,
            'error_code' => 'uploaded_file_unavailable',
            'message' => 'The uploaded PDF is unavailable.',
            'request_id' => null,
            'data' => null,
        ];
    }

    $stream = fopen($realPath, 'rb');

    if ($stream === false) {
        return [
            'status' => 'error',
            'http_status' => null,
            'error_code' => 'uploaded_file_unreadable',
            'message' => 'The uploaded PDF cannot be read.',
            'request_id' => null,
            'data' => null,
        ];
    }

    $multipart = [
        [
            'name' => 'title',
            'contents' => $title,
        ],
        [
            'name' => 'file',
            'contents' => $stream,
            'filename' => $file->getClientOriginalName(),
            'headers' => [
                'Content-Type' => 'application/pdf',
            ],
        ],
    ];

    $normalizedExternalId = $externalId !== null
        ? trim($externalId)  
        : null;

    if ($normalizedExternalId !== null
        && $normalizedExternalId !== '') {
        $multipart[] = [
            'name' => 'external_id',
            'contents' => $normalizedExternalId,
        ];
    }

    try {
        return $this->request(
            method: 'POST',
            path: '/api/v1/knowledge/documents',
            authenticated: true,
            options: [
                'multipart' => $multipart,
            ],
            requestId: $requestId,
            multipart: true,
        );
    } finally {
        fclose($stream);
    }
}



/**
 * @return array<string, mixed>
 */
public function deleteKnowledgeDocument(
    string $documentId,
    ?string $requestId = null
): array {
    if (! Str::isUuid($documentId)) {
        return [
            'status' => 'error',
            'http_status' => null,
            'error_code' => 'invalid_document_id',
            'message' => 'The knowledge document ID is invalid.',
            'request_id' => null,
            'data' => null,
        ];
    }

    return $this->request(
        method: 'DELETE',
        path: '/api/v1/knowledge/documents/'.$documentId,
        authenticated: true,
        requestId: $requestId,
    );
}



    private function pendingRequest(
    bool $authenticated,
    ?string $requestId = null,
    bool $multipart = false
): PendingRequest {
         $request = Http::baseUrl($this->baseUrl)
    ->acceptJson()
    ->connectTimeout($this->connectTimeout)
    ->timeout($this->timeout);

$request = $multipart
    ? $request->asMultipart()
    : $request->asJson();

        if ($authenticated && $this->apiKey !== null) {
            $request = $request->withHeaders([
                'X-API-Key' => $this->apiKey,
            ]);
        }

        if ($requestId !== null && $requestId !== '') {
            $request = $request->withHeaders([
                'X-Request-ID' => $requestId,
            ]);
        }

        return $request;
    }

    /**
     * @return array<string, mixed>
     */
    private function request(
        string $method,
        string $path,
        bool $authenticated,
        array $options = [],
        ?string $requestId = null,
        bool $multipart = false
    ): array {
        if ($this->baseUrl === '') {
            return [
                'status' => 'error',
                'http_status' => null,
                'error_code' => 'base_url_missing',
                'message' => (
                    'AI microservice base URL is missing.'
                ),
                'request_id' => null,
                'data' => null,
                
            ];
        }

        if ($authenticated && $this->apiKey === null) {
            return [
                'status' => 'error',
                'http_status' => null,
                'error_code' => 'api_key_missing',
                'message' => (
                    'AI microservice API key is missing.'
                ),
                'request_id' => null,
                'data' => null,
            ];
        }

        $startedAt = microtime(true);

        try {
          $response = $this->pendingRequest(
           $authenticated,
           $requestId,
           $multipart
        )->send(
                $method,
                $path,
                $options
            );

            $durationMs = (int) round(
                (microtime(true) - $startedAt) * 1000
            );

            $responseData = $response->json();

            if (! is_array($responseData)) {
                $responseData = [];
            }

            if (! $response->successful()) {
                return [
                    'status' => 'error',
                    'http_status' => $response->status(),
                    'error_code' => data_get(
                        $responseData,
                        'detail.code',
                        'ai_microservice_http_error'
                    ),
                    'message' => data_get(
                        $responseData,
                        'detail.message',
                        'AI microservice request failed.'
                    ),
                    'request_id' => $response->header(
                        'X-Request-ID'
                    ),
                    'duration_ms' => $durationMs,
                    'data' => null,
                ];
            }

            return [
                'status' => 'ok',
                'http_status' => $response->status(),
                'error_code' => null,
                'message' => null,
                'request_id' => $response->header(
                    'X-Request-ID'
                ),
                'duration_ms' => $durationMs,
                'data' => $responseData,
            ];

        } catch (ConnectionException $exception) {
            Log::warning(
                'AI microservice connection failed',
                [
                    'path' => $path,
                    'exception' => $exception::class,
                ]
            );

            return [
                'status' => 'error',
                'http_status' => null,
                'error_code' => (
                    'ai_microservice_unavailable'
                ),
                'message' => (
                    'AI microservice is unavailable.'
                ),
                'request_id' => null,
                'data' => null,
            ];

        } catch (Throwable $exception) {
            Log::error(
                'AI microservice unexpected error',
                [
                    'path' => $path,
                    'exception' => $exception::class,
                ]
            );

            return [
                'status' => 'error',
                'http_status' => null,
                'error_code' => (
                    'ai_microservice_request_failed'
                ),
                'message' => (
                    'AI microservice request failed.'
                ),
                'request_id' => null,
                'data' => null,
            ];
        }
    }
}
