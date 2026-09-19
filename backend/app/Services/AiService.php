<?php

namespace App\Services;

use App\Services\Ai\AiRouterService;
use App\Services\Ai\AiToolExecutorService;
use App\Services\Ai\Providers\AiProviderManager;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use App\Services\Ai\Microservice\AiMicroserviceClient;


class AiService
{
    public function __construct(
    private DashboardService $dashboardService,
    private AiRouterService $routerService,
    private AiToolExecutorService $toolExecutorService,
    private AiProviderManager $providerManager,
    private AiMicroserviceClient $aiMicroserviceClient,
) {
}

    public function answerQuestion(string $question, ?int $userId = null): array
    {
        $requestId = (string) Str::uuid();
        $startedAt = microtime(true);

        Log::info('AI ask started', [
            'request_id' => $requestId,
            'user_id' => $userId,
            'question_preview' => mb_substr($question, 0, 200),
            'question_length' => mb_strlen($question),
        ]);

        if (config('services.ai.provider') === 'ollama') {
            @set_time_limit(120);
        }

        $route = $this->routerService->route($question);

        Log::info('AI route selected', [
            'request_id' => $requestId,
            'provider' => $route['provider'] ?? null,
            'confidence' => $route['confidence'] ?? null,
            'tools' => collect($route['tools'] ?? [])
                ->pluck('name')
                ->values()
                ->toArray(),
        ]);

        $toolResults = $this->toolExecutorService->execute(
            tools: $route['tools'] ?? [],
            question: $question,
            requestId: $requestId
        );

        $forceLegacyProvider = false;

        if (
            $this->isKnowledgeOnlyRoute($route)
            && $this->aiMicroserviceClient->isEnabled()
        ) {
            $microserviceResponse = $this->askKnowledgeMicroservice(
                question: $question,
                requestId: $requestId,
            );

            $knowledgeAnswer = $this->formatKnowledgeMicroserviceAnswer(
                response: $microserviceResponse,
                route: $route,
            );

            if ($knowledgeAnswer !== null) {
                Log::info('AI knowledge question handled by microservice', [
                    'request_id' => $requestId,
                    'provider' => $knowledgeAnswer['provider'],
                    'rag_chunks_count' => data_get(
                        $knowledgeAnswer,
                        'used_data.rag_chunks_count',
                        0
                    ),
                    'duration_ms' => (int) round(
                        (microtime(true) - $startedAt) * 1000
                    ),
                ]);

                return $knowledgeAnswer;
            }

            $microserviceErrorCode = $this->microserviceErrorCode(
                $microserviceResponse,
                'ai_microservice_knowledge_failed'
            );

            Log::warning('AI knowledge microservice response unusable', [
                'request_id' => $requestId,
                'http_status' => $microserviceResponse['http_status'] ?? null,
                'error_code' => $microserviceErrorCode,
                'legacy_fallback_enabled' => (
                    $this->legacyFallbackEnabled()
                ),
            ]);

            if (! $this->legacyFallbackEnabled()) {
                return $this->assistantErrorResult(
                    route: $route,
                    toolResults: $toolResults,
                    errorCode: $microserviceErrorCode,
                );
            }

            $forceLegacyProvider = true;
        }

        Log::info('AI tools executed', [
            'request_id' => $requestId,
            'rag_chunks_count' => data_get(
                $toolResults,
                'knowledge_base.chunks_count',
                0
            ),
            'stock_forecast_products_count' => count(
                data_get($toolResults, 'stock_forecast.products', [])
            ),
            'has_business_snapshot' => ! empty(
                data_get($toolResults, 'business_snapshot.stats')
            ),
        ]);

        if (! $this->hasUsableToolData($toolResults)) {
            return $this->assistantErrorResult(
                route: $route,
                toolResults: $toolResults,
                errorCode: 'assistant_context_unavailable',
                message: (
                    'Les données nécessaires à la réponse sont '
                    . 'temporairement indisponibles.'
                ),
            );
        }

        if (
            $this->aiMicroserviceClient->isEnabled()
            && ! $forceLegacyProvider
        ) {
            $finalResponse = $this->generateFinalAnswerWithMicroservice(
                question: $question,
                route: $route,
                toolResults: $toolResults,
                requestId: $requestId,
            );

            if (($finalResponse['status'] ?? 'error') !== 'ok') {
                if (! $this->legacyFallbackEnabled()) {
                    return $this->assistantErrorResult(
                        route: $route,
                        toolResults: $toolResults,
                        errorCode: (string) (
                            $finalResponse['error_code']
                            ?? 'ai_microservice_generation_failed'
                        ),
                        message: $finalResponse['message'] ?? null,
                    );
                }

                Log::warning(
                    'AI microservice failed; explicit Laravel fallback used',
                    [
                        'request_id' => $requestId,
                        'error_code' => (
                            $finalResponse['error_code'] ?? null
                        ),
                    ]
                );

                $finalResponse = $this->generateFinalAnswerWithLegacyProvider(
                    question: $question,
                    route: $route,
                    toolResults: $toolResults,
                    requestId: $requestId,
                );
            }
        } else {
            $finalResponse = $this->generateFinalAnswerWithLegacyProvider(
                question: $question,
                route: $route,
                toolResults: $toolResults,
                requestId: $requestId,
            );
        }

        $answer = $finalResponse['answer'] ?? null;

        if (
            ($finalResponse['status'] ?? 'error') !== 'ok'
            || ! is_string($answer)
            || trim($answer) === ''
        ) {
            return $this->assistantErrorResult(
                route: $route,
                toolResults: $toolResults,
                errorCode: (string) (
                    $finalResponse['error_code']
                    ?? 'ai_provider_unavailable'
                ),
                message: $finalResponse['message'] ?? null,
            );
        }

        Log::info('AI ask finished', [
            'request_id' => $requestId,
            'provider' => $finalResponse['provider'] ?? 'none',
            'answer_empty' => false,
            'duration_ms' => (int) round(
                (microtime(true) - $startedAt) * 1000
            ),
        ]);

        return [
            'status' => 'ok',
            'answer' => $this->cleanAssistantAnswerText($answer),
            'intent' => $this->intentFromTools($route['tools'] ?? []),
            'provider' => $finalResponse['provider'] ?? 'none',
            'used_data' => $this->summarizeUsedData(
                $route,
                $toolResults
            ),
            'error_code' => null,
            'message' => null,
        ];
    }
  /**
 * @return array{status: 'ok'|'error', provider: string, content: ?string}
 */
public function generateReport(
    string $type,
    string $period = 'monthly'
): array {
    $requestId = (string) Str::uuid();
    $provider = 'none';

    if (config('services.ai.provider') === 'ollama') {
        $reportTimeout = (int) config(
            'services.ollama.report_timeout',
            120
        );

        @set_time_limit(($reportTimeout * 3) + 30);
    }

    Log::info('AI report generation started', [
        'request_id' => $requestId,
        'type' => $type,
        'period' => $period,
    ]);

    $businessData = [
        'stats' => $this->dashboardService->getStats(),
        'sales_by_period' => $this->dashboardService->getSalesByPeriod($period),
        'top_products' => $this->dashboardService->getTopProducts(5),
        'top_customers' => $this->dashboardService->getTopCustomers(5),
        'orders_by_status' => $this->dashboardService->getOrdersByStatus(),
        'low_stock_products' => $this->dashboardService->getLowStockProducts(),
    ];

    $reportData = $this->buildReportTemplate(
        $businessData,
        $type,
        $period
    );

    $summary = [
        'content' => $reportData['summary_content'],
    ];

    $salesAnalysis = [
        'content' => $reportData['sales_analysis_content'],
    ];

    $recommendationSelection = $this
        ->selectReportRecommendationActions(
            reportType: $type,
            period: $period,
            context: $reportData['recommendations_context'],
            requestId: $requestId,
        );

    if (
        ($recommendationSelection['status'] ?? 'error')
        !== 'ok'
    ) {
        Log::warning('AI report recommendation selection failed', [
            'request_id' => $requestId,
            'reason' => (
                $recommendationSelection['error_code']
                ?? 'report_recommendation_failed'
            ),
            'provider' => (
                $recommendationSelection['provider']
                ?? 'none'
            ),
        ]);

        return [
            'status' => 'error',
            'provider' => (
                $recommendationSelection['provider']
                ?? 'none'
            ),
            'content' => null,
            'error_code' => (
                $recommendationSelection['error_code']
                ?? 'report_recommendation_failed'
            ),
        ];
    }

    $recommendationsContent = $this
        ->renderReportRecommendations(
            $recommendationSelection['action_codes'] ?? []
        );

    if ($recommendationsContent === null) {
        Log::warning('AI report recommendation rendering failed', [
            'request_id' => $requestId,
            'reason' => 'invalid_action_codes',
            'provider' => (
                $recommendationSelection['provider']
                ?? 'none'
            ),
        ]);

        return [
            'status' => 'error',
            'provider' => (
                $recommendationSelection['provider']
                ?? 'none'
            ),
            'content' => null,
            'error_code' => 'invalid_report_action_codes',
        ];
    }

    $provider = (string) (
        $recommendationSelection['provider'] ?? 'none'
    );

    $content = str_replace(
        [
            '{{SUMMARY}}',
            '{{SALES_ANALYSIS}}',
            '{{RECOMMENDATIONS}}',
        ],
        [
            $summary['content'],
            $salesAnalysis['content'],
            $recommendationsContent,
        ],
        $reportData['template']
    );

    $content = $this->cleanAssistantAnswerText($content);

    if ($content === '' || str_contains($content, '{{')) {
        Log::warning('AI report assembly failed', [
            'request_id' => $requestId,
            'provider' => $provider,
        ]);

        return [
            'status' => 'error',
            'provider' => $provider,
            'content' => null,
        ];
    }

    Log::info('AI report generation finished', [
        'request_id' => $requestId,
        'provider' => $provider,
        'content_length' => mb_strlen($content),
    ]);

    return [
        'status' => 'ok',
        'provider' => $provider,
        'content' => $content,
    ];
}
/**
 * @return array{
 *     template: string,
 *     summary_content: string,
 *     sales_analysis_content: string,
 *     recommendations_context: string
 * }
 */
private function buildReportTemplate(
    array $businessData,
    string $type,
    string $period
): array {
    $reportLabels = [
        'sales_report' => 'Rapport de ventes',
        'stock_recommendation' => 'Recommandations de stock',
        'customer_analysis' => 'Analyse des clients',
        'marketing_recommendation' => 'Recommandations marketing',
    ];

    $reportFocus = [
        'sales_report' => 'Évolution du chiffre d’affaires et activité commerciale',
        'stock_recommendation' => 'Produits à surveiller et priorités de réapprovisionnement',
        'customer_analysis' => 'Clients les plus importants et concentration des ventes',
        'marketing_recommendation' => 'Produits et segments clients à valoriser',
    ];

    $periodLabels = [
        'daily' => 'journalière',
        'weekly' => 'hebdomadaire',
        'monthly' => 'mensuelle',
        'yearly' => 'annuelle',
    ];

    $formatAmount = static function ($value): string {
        return is_numeric($value)
            ? number_format((float) $value, 2, ',', ' ') . ' €'
            : 'Donnée non disponible';
    };

    $formatNumber = static function ($value): string {
        return is_numeric($value)
            ? number_format((float) $value, 0, ',', ' ')
            : 'Donnée non disponible';
    };

    $stats = $businessData['stats'] ?? [];

    $salesRecords = collect($businessData['sales_by_period'] ?? [])->values();

$salesByPeriod = $salesRecords
    ->take(-12)
    ->map(function ($sale) use ($formatAmount, $formatNumber) {
        $label = data_get($sale, 'period', 'Donnée non disponible');
        $revenue = $formatAmount(data_get($sale, 'total_sales'));
        $orders = $formatNumber(data_get($sale, 'orders_count'));

        return "- {$label} : {$revenue}, {$orders} commande(s)";
    })
    ->implode("\n");

$recentSalesTrend = 'Donnée non disponible';

if ($salesRecords->count() >= 2) {
    $previousSale = $salesRecords->get($salesRecords->count() - 2);
    $latestSale = $salesRecords->last();

    $previousRevenue = data_get($previousSale, 'total_sales');
    $latestRevenue = data_get($latestSale, 'total_sales');

    if (is_numeric($previousRevenue) && is_numeric($latestRevenue)) {
        $previousRevenue = (float) $previousRevenue;
        $latestRevenue = (float) $latestRevenue;
        $difference = $latestRevenue - $previousRevenue;

        $direction = match (true) {
            $difference > 0 => 'hausse',
            $difference < 0 => 'baisse',
            default => 'stabilité',
        };

        $percentage = $previousRevenue != 0.0
            ? abs(($difference / $previousRevenue) * 100)
            : null;

        $percentageLabel = $percentage !== null
            ? ' (' . number_format($percentage, 1, ',', ' ') . ' %)'
            : '';

        $latestPeriod = data_get(
            $latestSale,
            'period',
            'dernière période disponible'
        );

        $previousPeriod = data_get(
            $previousSale,
            'period',
            'période précédente'
        );

       $comparisonFrequency = $periodLabels[$period] ?? 'périodique';
       $recentSalesTrend = "Comparaison {$comparisonFrequency} entre "
    . "{$latestPeriod} et {$previousPeriod} : "
    . $formatAmount($latestRevenue)
    . " sur {$latestPeriod}, soit une {$direction} de "
    . $formatAmount(abs($difference))
    . $percentageLabel
    . " par rapport à {$previousPeriod}.";
    }
}

    $topProducts = collect($businessData['top_products'] ?? [])
        ->take(5)
        ->map(function ($product) use ($formatAmount, $formatNumber) {
            $name = data_get($product, 'product_name', 'Donnée non disponible');
            $quantity = $formatNumber(data_get($product, 'total_sold'));
            $revenue = $formatAmount(data_get($product, 'total_revenue'));

            return "- {$name} : {$quantity} unité(s) vendue(s), {$revenue} de chiffre d’affaires";
        })
        ->implode("\n");

    $topCustomers = collect($businessData['top_customers'] ?? [])
        ->take(5)
        ->map(function ($customer) use ($formatAmount, $formatNumber) {
            $name = trim(
                (string) data_get($customer, 'first_name', '')
                . ' '
                . (string) data_get($customer, 'last_name', '')
            );

            if ($name === '') {
                $name = 'Donnée non disponible';
            }

            $orders = $formatNumber(data_get($customer, 'orders_count'));
            $spent = $formatAmount(data_get($customer, 'total_spent'));

            return "- {$name} : {$orders} commande(s), {$spent} dépensés";
        })
        ->implode("\n");

    $ordersByStatus = collect($businessData['orders_by_status'] ?? [])
        ->map(function ($item) use ($formatNumber) {
            $status = strtolower((string) data_get($item, 'status', ''));

            $statusLabel = match ($status) {
                'pending' => 'En attente',
                'confirmed' => 'Confirmées',
                'shipped' => 'Expédiées',
                'delivered' => 'Livrées',
                'cancelled' => 'Annulées',
                default => $status !== '' ? ucfirst($status) : 'Donnée non disponible',
            };

            return "- {$statusLabel} : "
                . $formatNumber(data_get($item, 'count'))
                . " commande(s)";
        })
        ->implode("\n");

    $lowStockProducts = collect($businessData['low_stock_products'] ?? [])
        ->take(8)
        ->map(function ($product) use ($formatNumber) {
            $name = data_get($product, 'name', 'Donnée non disponible');
            $stock = $formatNumber(data_get($product, 'stock_quantity'));
            $threshold = $formatNumber(data_get($product, 'stock_alert_threshold'));
            $category = data_get($product, 'category.name');

            $categoryLabel = is_string($category) && $category !== ''
                ? ", catégorie {$category}"
                : '';

            return "- {$name}{$categoryLabel} : stock actuel {$stock}, seuil d’alerte {$threshold}";
        })
        ->implode("\n");

        $restockRecommendations = collect($businessData['low_stock_products'] ?? [])
    ->take(8)
    ->map(function ($product) use ($formatNumber) {
        $name = data_get($product, 'name', 'Produit non renseigné');
        $stock = data_get($product, 'stock_quantity');
        $threshold = data_get($product, 'stock_alert_threshold');

        if (! is_numeric($stock) || ! is_numeric($threshold)) {
            return "- Vérifier le besoin de réapprovisionnement de {$name}.";
        }

        $minimumRestock = max(
            0,
            (int) ceil((float) $threshold - (float) $stock)
        );

        if ($minimumRestock === 0) {
            return null;
        }

        return "- Réapprovisionner {$name} d’au moins "
            . $formatNumber($minimumRestock)
            . " unité(s) pour revenir au seuil d’alerte.";
    })
    ->filter()
    ->implode("\n");



    $template = implode("\n", [
        '# ' . ($reportLabels[$type] ?? 'Rapport commercial'),
        '',
        '_Objectif : '
            . ($reportFocus[$type] ?? 'Analyse de l’activité commerciale')
            . '_',
        '_Regroupement des ventes : '
            . ($periodLabels[$period] ?? 'Donnée non disponible')
            . '_',
        '',
        '## 1. Résumé exécutif',
        '',
        '{{SUMMARY}}',
        '',
        '## 2. Chiffres clés',
        '',
        '- **Chiffre d’affaires cumulé hors commandes annulées :** '
            . $formatAmount(data_get($stats, 'total_revenue')),
        '- **Nombre total de commandes :** '
            . $formatNumber(data_get($stats, 'orders_count')),
        '- **Nombre de clients :** '
            . $formatNumber(data_get($stats, 'customers_count')),
        '- **Nombre de produits :** '
            . $formatNumber(data_get($stats, 'products_count')),
        '- **Produits en stock faible :** '
            . $formatNumber(data_get($stats, 'low_stock_count')),
        '',
        '## 3. Analyse des ventes',
        '',
        '{{SALES_ANALYSIS}}',
        '',
        '### Données de ventes par période',
        '',
        $salesByPeriod !== '' ? $salesByPeriod : 'Donnée non disponible',
        '',
        '## 4. Produits les plus performants',
        '',
        $topProducts !== '' ? $topProducts : 'Donnée non disponible',
        '',
        '## 5. Clients importants',
        '',
        $topCustomers !== '' ? $topCustomers : 'Donnée non disponible',
        '',
        '## 6. Points d’attention',
        '',
        '### Commandes par statut',
        '',
        $ordersByStatus !== '' ? $ordersByStatus : 'Donnée non disponible',
        '',
        '### Produits sous leur seuil d’alerte',
        '',
        $lowStockProducts !== '' ? $lowStockProducts : 'Donnée non disponible',
        '',
        '## 7. Recommandations concrètes',
        '',
        '{{RECOMMENDATIONS}}',
        '',
        '### Réapprovisionnements minimaux calculés',
        '',
        $restockRecommendations !== ''
            ? $restockRecommendations
            : '- Aucun réapprovisionnement immédiat calculable.',
    ]);
$recommendationsContext = implode("\n", [
    'Réapprovisionnements calculés :',
    $restockRecommendations !== ''
        ? $restockRecommendations
        : 'Aucun réapprovisionnement immédiat calculable.',
    '',
    'Commandes par statut :',
    $ordersByStatus !== ''
        ? $ordersByStatus
        : 'Donnée non disponible.',
    '',
    'Clients importants :',
    $topCustomers !== ''
        ? $topCustomers
        : 'Donnée non disponible.',
]);


$summaryContent = implode("\n\n", [
    'Le chiffre d’affaires cumulé hors commandes annulées s’élève à '
        . $formatAmount(data_get($stats, 'total_revenue'))
        . ' pour '
        . $formatNumber(data_get($stats, 'orders_count'))
        . ' commande(s) enregistrée(s).',
    'Tendance récente vérifiée : ' . $recentSalesTrend,
]);

$salesAnalysisContent = implode("\n\n", [
    $recentSalesTrend,
    'Les montants et volumes détaillés par période sont présentés ci-dessous.',
]);
return [
    'template' => $template,
    'summary_content' => $summaryContent,
    'sales_analysis_content' => $salesAnalysisContent,
    'recommendations_context' => $recommendationsContext,
];
}

    private function finalAnswerSystemPrompt(): string
    {
        return "
Tu es un assistant IA professionnel intégré à une plateforme e-commerce.

Règles strictes :
- Réponds uniquement à partir des résultats d'outils fournis.
- N'invente aucune information.
- N'invente aucun chiffre.
- Si les résultats ne contiennent pas l'information, dis clairement que l'information n'est pas disponible dans les données ou documents fournis.
- Si des sources documentaires sont fournies, cite les titres des documents utilisés.
- Réponds en français.
- Sois clair, court, professionnel et directement utile.
- Ne mentionne jamais les mots : démo, fallback, quota, erreur technique.
- Ne dis pas que tu es OpenAI ou Ollama.
- Ne fais pas de réponse générique si les données ne suffisent pas.
- Corrige l’orthographe et les accents en français.

Structure recommandée :
1. Réponse directe
2. Éléments utilisés
3. Recommandation concrète si possible
";
    }

    private function buildFinalAnswerPrompt(string $question, array $route, array $toolResults): string
    {
        $context = $this->compactToolResultsForPrompt($toolResults);

        return trim("
Tu es l'Assistant IA d'une plateforme e-commerce.

Tu dois répondre en français, de manière claire, utile et professionnelle.

Règles importantes :
- Utilise uniquement le contexte fourni.
- Ne cite pas d'informations inventées.
- Si le contexte ne contient pas la réponse, dis simplement que l'information n'est pas disponible dans les données internes.
- Ne parle jamais de fallback, d'erreur technique, d'Ollama, d'OpenAI ou de provider.
- Réponds comme un assistant métier, pas comme un développeur.
- Ne commence pas par \"Voici la réponse\".
- Ne termine pas par \"Réponse concise et professionnelle\".
- Donne une seule réponse structurée.
- Ne confonds jamais stock actuel, seuil d’alerte, demande prévue et quantité recommandée.
- Pour les prévisions de stock, conserve les libellés fournis par les outils.
- Pour une question de réapprovisionnement, classe les produits par niveau de risque et quantité recommandée.
- Ne transforme pas une demande prévue en stock actuel.
- Réponds en 4 points maximum si la question demande un résumé.

Question utilisateur :
{$question}

Contexte disponible :
{$context}

Réponse :
");
    }

    private function compactToolResultsForPrompt(array $toolResults): string
    {
        $parts = [];

        $chunks = collect(data_get($toolResults, 'knowledge_base.chunks', []))
            ->take(2)
            ->map(function ($chunk) {
                $title = data_get($chunk, 'document_title', 'Document interne');
                $content = $this->cleanTextForPrompt(data_get($chunk, 'content', ''));

                if (mb_strlen($content) > 400) {
                    $content = mb_substr($content, 0, 400) . '...';
                }

                return "Source : {$title}\nExtrait : {$content}";
            })
            ->filter()
            ->implode("\n\n");

        if ($chunks !== '') {
            $parts[] = "Documents internes :\n" . $chunks;
        }

        $forecastProducts = collect(data_get($toolResults, 'stock_forecast.products', []))
            ->take(5)
            ->map(function ($product) {
                $name = data_get($product, 'product_name', data_get($product, 'name', 'Produit'));
                $risk = data_get($product, 'risk_level', 'non précisé');
                $stock = data_get($product, 'current_stock', data_get($product, 'stock', 'non précisé'));
                $demand = data_get($product, 'projected_demand_30_days', 'non précisée');
                $restock = data_get($product, 'recommended_restock_quantity', 'non précisé');

                return "{$name} : risque {$risk}, stock actuel {$stock}, demande prévue sur 30 jours {$demand}, réassort recommandé {$restock}.";
            })
            ->implode("\n");

        if ($forecastProducts !== '') {
            $parts[] = "Prévisions de stock :\n" . $forecastProducts;
        }

        $topProducts = collect(data_get($toolResults, 'business_snapshot.top_products', []))
            ->take(5)
            ->map(function ($product) {
                $name = data_get($product, 'name', data_get($product, 'product_name', 'Produit'));
                $quantity = data_get($product, 'total_quantity', data_get($product, 'total_sold', 0));
                $revenue = data_get($product, 'total_revenue', data_get($product, 'revenue', 0));

                return "{$name} : {$quantity} vente(s), chiffre d'affaires {$revenue}.";
            })
            ->implode("\n");

        if ($topProducts !== '') {
            $parts[] = "Produits les plus vendus :\n" . $topProducts;
        }

        if (empty($parts)) {
            return "Aucun contexte interne disponible.";
        }

        return implode("\n\n---\n\n", $parts);
    }



    private function selectReportRecommendationActions(
        string $reportType,
        string $period,
        string $context,
        string $requestId
    ): array {
        if ($this->aiMicroserviceClient->isEnabled()) {
            $selection = $this
                ->selectReportActionsWithMicroservice(
                    reportType: $reportType,
                    period: $period,
                    context: $context,
                    requestId: $requestId,
                );

            if (($selection['status'] ?? 'error') === 'ok') {
                return $selection;
            }

            if (! $this->legacyFallbackEnabled()) {
                return $selection;
            }

            Log::warning(
                'AI report microservice failed; explicit Laravel fallback used',
                [
                    'request_id' => $requestId,
                    'error_code' => (
                        $selection['error_code'] ?? null
                    ),
                ]
            );
        }

        return $this->selectReportActionsWithLegacyProvider(
            context: $context,
            requestId: $requestId,
        );
    }

    private function selectReportActionsWithMicroservice(
        string $reportType,
        string $period,
        string $context,
        string $requestId
    ): array {
        if (! $this->aiMicroserviceClient->isConfigured()) {
            return [
                'status' => 'error',
                'provider' => 'none',
                'model' => null,
                'action_codes' => [],
                'error_code' => 'ai_microservice_not_configured',
            ];
        }

        $response = $this->aiMicroserviceClient
            ->selectReportActions(
                reportType: $reportType,
                period: $period,
                context: $context,
                requestId: $requestId,
            );

        if (
            ($response['status'] ?? 'error') !== 'ok'
            || data_get($response, 'data.status') !== 'ok'
        ) {
            return [
                'status' => 'error',
                'provider' => data_get(
                    $response,
                    'data.llm_provider',
                    'none'
                ),
                'model' => data_get(
                    $response,
                    'data.llm_model'
                ),
                'action_codes' => [],
                'error_code' => $this->microserviceErrorCode(
                    $response,
                    'report_recommendation_failed'
                ),
            ];
        }

        $actionCodes = $this->validateReportActionCodes(
            data_get($response, 'data.action_codes', [])
        );

        if ($actionCodes === null) {
            return [
                'status' => 'error',
                'provider' => data_get(
                    $response,
                    'data.llm_provider',
                    'none'
                ),
                'model' => data_get(
                    $response,
                    'data.llm_model'
                ),
                'action_codes' => [],
                'error_code' => 'invalid_report_action_codes',
            ];
        }

        return [
            'status' => 'ok',
            'provider' => data_get(
                $response,
                'data.llm_provider',
                'none'
            ),
            'model' => data_get(
                $response,
                'data.llm_model'
            ),
            'action_codes' => $actionCodes,
            'error_code' => null,
        ];
    }

    private function selectReportActionsWithLegacyProvider(
        string $context,
        string $requestId
    ): array {
        $narrative = $this->generateReportNarrative(
            'Choisis les trois actions prioritaires à partir des données fournies.',
            $context,
            $requestId
        );

        if ($narrative === null) {
            return [
                'status' => 'error',
                'provider' => 'none',
                'model' => null,
                'action_codes' => [],
                'error_code' => 'ai_provider_unavailable',
            ];
        }

        $actionCodes = $this->extractReportActionCodes(
            $narrative['content']
        );

        if ($actionCodes === null) {
            return [
                'status' => 'error',
                'provider' => $narrative['provider'],
                'model' => null,
                'action_codes' => [],
                'error_code' => 'invalid_report_action_codes',
            ];
        }

        return [
            'status' => 'ok',
            'provider' => $narrative['provider'],
            'model' => null,
            'action_codes' => $actionCodes,
            'error_code' => null,
        ];
    }

    private function extractReportActionCodes(
        string $response
    ): ?array {
        $normalizedResponse = preg_replace(
            '/[^A-Z]+/',
            '_',
            strtoupper($response)
        ) ?? '';

        $codePositions = [];

        foreach (
            array_keys($this->reportRecommendationLabels())
            as $code
        ) {
            $position = strpos($normalizedResponse, $code);

            if ($position !== false) {
                $codePositions[$code] = $position;
            }
        }

        asort($codePositions);

        return $this->validateReportActionCodes(
            array_keys($codePositions)
        );
    }

    private function validateReportActionCodes(
        mixed $actionCodes
    ): ?array {
        if (! is_array($actionCodes) || count($actionCodes) !== 3) {
            return null;
        }

        $labels = $this->reportRecommendationLabels();
        $validatedCodes = [];

        foreach (array_values($actionCodes) as $code) {
            if (
                ! is_string($code)
                || ! array_key_exists($code, $labels)
                || in_array($code, $validatedCodes, true)
            ) {
                return null;
            }

            $validatedCodes[] = $code;
        }

        return $validatedCodes;
    }

    private function renderReportRecommendations(
        array $actionCodes
    ): ?string {
        $validatedCodes = $this->validateReportActionCodes(
            $actionCodes
        );

        if ($validatedCodes === null) {
            return null;
        }

        $labels = $this->reportRecommendationLabels();

        return implode(
            "\n",
            array_map(
                static fn (string $code): string => $labels[$code],
                $validatedCodes
            )
        );
    }

    private function reportRecommendationLabels(): array
    {
        return [
            'PRIORITIZE_RESTOCK' =>
                '- Prioriser le réapprovisionnement des produits actuellement sous leur seuil d’alerte.',
            'FOLLOW_ORDER_STATUSES' =>
                '- Assurer un suivi opérationnel des commandes selon leur statut et traiter en priorité celles qui nécessitent une action.',
            'ANALYZE_CANCELLATIONS' =>
                '- Examiner les commandes annulées afin d’identifier les points opérationnels à corriger.',
            'RETAIN_IMPORTANT_CUSTOMERS' =>
                '- Préparer une action de fidélisation ciblée pour les clients importants identifiés.',
        ];
    }

private function reportSystemPrompt(): string
{
   return <<<'PROMPT'
Tu es un moteur de priorisation pour un rapport e-commerce.

Choisis exactement trois codes distincts parmi les codes suivants :

PRIORITIZE_RESTOCK
- Priorité au suivi et au réapprovisionnement du stock.

FOLLOW_ORDER_STATUSES
- Priorité au traitement opérationnel des commandes selon leur statut.

ANALYZE_CANCELLATIONS
- Priorité à l’examen des commandes annulées.

RETAIN_IMPORTANT_CUSTOMERS
- Priorité à la fidélisation des clients importants.

Règles obligatoires :
- Utilise uniquement les situations indiquées dans le contexte.
- Classe les trois actions choisies de la plus prioritaire à la moins prioritaire.
- Retourne uniquement les trois codes.
- Écris un seul code par ligne.
- N’ajoute aucun titre, phrase, puce, chiffre, commentaire ou explication.
PROMPT;
}

/**
 * @return array{
 *     summary: string,
 *     sales_analysis: string,
 *     recommendations: string
 * }|null
 */

/**
 * @return array{provider: string, content: string}|null
 */
private function generateReportNarrative(
    string $task,
    string $context,
    string $requestId
): ?array {
    $response = $this->providerManager->chat([
        [
            'role' => 'system',
            'content' => $this->reportSystemPrompt(),
        ],
        [
            'role' => 'user',
            'content' => implode("\n", [
                'Tâche : ' . $task,
                '',
                'Contexte autorisé :',
                $context,
            ]),
        ],
    ], [
        'purpose' => 'report',
        'request_id' => $requestId,
    ]);

    $provider = (string) ($response['provider'] ?? 'none');
    $answer = $response['answer'] ?? null;

    if (
        $provider === 'none'
        || ! is_string($answer)
        || trim($answer) === ''
    ) {
        return null;
    }

    $content = $this->cleanAssistantAnswerText($answer);

    if ($content === '') {
        return null;
    }

    return [
        'provider' => $provider,
        'content' => $content,
    ];
}

    private function hasUsableToolData(array $toolResults): bool
    {
        $knowledgeUsable =
            data_get($toolResults, 'knowledge_base.status') !== 'error'
            && data_get($toolResults, 'knowledge_base.chunks_count', 0) > 0;

        $forecastUsable =
            data_get($toolResults, 'stock_forecast.status') !== 'error'
            && count(data_get($toolResults, 'stock_forecast.products', [])) > 0;

        $businessUsable =
            data_get($toolResults, 'business_snapshot.status') !== 'error'
            && ! empty(data_get($toolResults, 'business_snapshot.stats'));

        return $knowledgeUsable || $forecastUsable || $businessUsable;
    }

    private function cleanTextForPrompt(?string $text): string
    {
        $text = (string) $text;

        $text = preg_replace('/SmartCommerce AI Platform.*?Page \d+/iu', '', $text);
        $text = preg_replace('/Document interne de démonstration/iu', '', $text);
        $text = preg_replace('/Version demo client.*?2026/iu', '', $text);
        $text = preg_replace('/Objectif du document/iu', '', $text);
        $text = preg_replace('/Type RAG conseillé\s*:\s*[a-zA-Z0-9_-]+/iu', '', $text);

        $text = preg_replace('/Ce document sert.*?(?=R[eè]gle|Politique|Proc[eé]dure|FAQ|Les clients|Le client|Avant|En cas|$)/iu', '', $text);
        $text = preg_replace('/Il contient des r[eè]gles internes.*?(?=R[eè]gle|Politique|Proc[eé]dure|FAQ|Les clients|Le client|Avant|En cas|$)/iu', '', $text);

        $text = preg_replace('/\s+/', ' ', $text);

        return trim($text);
    }


    private function isKnowledgeOnlyRoute(array $route): bool
{
    $toolNames = collect($route['tools'] ?? [])
        ->pluck('name')
        ->filter()
        ->unique()
        ->values()
        ->all();

    return $toolNames === ['search_knowledge_base'];
}

private function legacyFallbackEnabled(): bool
{
    return (bool) config(
        'services.ai_microservice.legacy_fallback_enabled',
        false
    );
}

private function generateFinalAnswerWithMicroservice(
    string $question,
    array $route,
    array $toolResults,
    string $requestId
): array {
    if (! $this->aiMicroserviceClient->isConfigured()) {
        return [
            'status' => 'error',
            'provider' => 'none',
            'model' => null,
            'answer' => null,
            'error_code' => 'ai_microservice_not_configured',
            'message' => (
                'Le microservice IA est activé mais sa configuration '
                . 'est incomplète.'
            ),
        ];
    }

    $context = $this->compactToolResultsForPrompt(
        $toolResults
    );

    if (trim($context) === '') {
        return [
            'status' => 'error',
            'provider' => 'none',
            'model' => null,
            'answer' => null,
            'error_code' => 'assistant_context_unavailable',
            'message' => (
                'Les données nécessaires à la réponse sont '
                . 'temporairement indisponibles.'
            ),
        ];
    }

    $response = $this->aiMicroserviceClient->generateAnswer(
        question: $question,
        context: $context,
        intent: $this->intentFromTools(
            $route['tools'] ?? []
        ),
        requestId: $requestId,
    );

    $answer = data_get($response, 'data.answer');

    if (
        ($response['status'] ?? 'error') !== 'ok'
        || data_get($response, 'data.status') !== 'ok'
        || ! is_string($answer)
        || trim($answer) === ''
    ) {
        $errorCode = $this->microserviceErrorCode(
            $response,
            'ai_microservice_generation_failed'
        );

        Log::warning(
            'AI microservice final generation failed',
            [
                'request_id' => $requestId,
                'http_status' => (
                    $response['http_status'] ?? null
                ),
                'error_code' => $errorCode,
            ]
        );

        return [
            'status' => 'error',
            'provider' => 'none',
            'model' => null,
            'answer' => null,
            'error_code' => $errorCode,
            'message' => (
                'Le microservice IA est temporairement indisponible.'
            ),
        ];
    }

    return [
        'status' => 'ok',
        'provider' => data_get(
            $response,
            'data.llm_provider',
            'none'
        ),
        'model' => data_get(
            $response,
            'data.llm_model'
        ),
        'answer' => trim($answer),
        'error_code' => null,
        'message' => null,
    ];
}

private function generateFinalAnswerWithLegacyProvider(
    string $question,
    array $route,
    array $toolResults,
    string $requestId
): array {
    $response = $this->providerManager->chat([
        [
            'role' => 'system',
            'content' => $this->finalAnswerSystemPrompt(),
        ],
        [
            'role' => 'user',
            'content' => $this->buildFinalAnswerPrompt(
                $question,
                $route,
                $toolResults
            ),
        ],
    ], [
        'purpose' => 'final_answer',
        'request_id' => $requestId,
    ]);

    $answer = $response['answer'] ?? null;
    $provider = (string) ($response['provider'] ?? 'none');

    if (
        $provider === 'none'
        || ! is_string($answer)
        || trim($answer) === ''
    ) {
        return [
            'status' => 'error',
            'provider' => 'none',
            'model' => null,
            'answer' => null,
            'error_code' => 'ai_provider_unavailable',
            'message' => (
                'Aucun fournisseur IA autorisé n’est actuellement '
                . 'disponible.'
            ),
        ];
    }

    return [
        'status' => 'ok',
        'provider' => $provider,
        'model' => $response['model'] ?? null,
        'answer' => trim($answer),
        'error_code' => null,
        'message' => null,
    ];
}

private function assistantErrorResult(
    array $route,
    array $toolResults,
    string $errorCode,
    ?string $message = null
): array {
    return [
        'status' => 'error',
        'answer' => null,
        'intent' => $this->intentFromTools(
            $route['tools'] ?? []
        ),
        'provider' => 'none',
        'used_data' => $this->summarizeUsedData(
            $route,
            $toolResults
        ),
        'error_code' => $errorCode,
        'message' => (
            $message
            ?? 'Le service IA est temporairement indisponible.'
        ),
    ];
}

private function microserviceErrorCode(
    array $response,
    string $default
): string {
    $errorCode = (
        $response['error_code']
        ?? data_get($response, 'data.error_code')
    );

    return is_string($errorCode) && trim($errorCode) !== ''
        ? $errorCode
        : $default;
}
private function askKnowledgeMicroservice(
    string $question,
    string $requestId
): array {
    if (! $this->aiMicroserviceClient->isConfigured()) {
        return [
            'status' => 'error',
            'http_status' => null,
            'error_code' => 'ai_microservice_not_configured',
            'message' => (
                'Le microservice IA est activé mais sa configuration '
                . 'est incomplète.'
            ),
            'data' => null,
        ];
    }

    return $this->aiMicroserviceClient->ask(
        question: $question,
        topK: 5,
        minScore: 0.4,
        requestId: $requestId,
    );
}
private function formatKnowledgeMicroserviceAnswer(
    array $response,
    array $route
): ?array {
    if (($response['status'] ?? 'error') !== 'ok') {
        return null;
    }

    $ragStatus = data_get($response, 'data.status');
    $citations = collect(data_get($response, 'data.citations', []))
        ->filter(fn ($citation) => is_array($citation))
        ->values();

    $ragSources = $citations
        ->pluck('document_title')
        ->filter()
        ->unique()
        ->values()
        ->all();

    $usedData = [
        'tools_used' => ['search_knowledge_base'],
        'router_provider' => $route['provider'] ?? null,
        'router_confidence' => $route['confidence'] ?? null,

        'has_stats' => false,
        'sales_periods_count' => 0,
        'top_products_count' => 0,
        'top_customers_count' => 0,
        'orders_status_count' => 0,
        'low_stock_products_count' => 0,

        'stock_forecast_products_count' => 0,
        'stock_forecast_provider' => null,

        'rag_chunks_count' => $citations->count(),
        'rag_sources' => $ragSources,
        'rag_retrieval_provider' => data_get(
            $response,
            'data.retrieval_provider'
        ),
        'rag_retrieval_model' => data_get(
            $response,
            'data.retrieval_model'
        ),
        'llm_model' => data_get($response, 'data.llm_model'),
        'citations' => $citations->all(),
    ];

    if ($ragStatus === 'empty') {
        return [
            'status' => 'ok',
            'answer' => (
                'Je n’ai trouvé aucun document interne suffisamment '
                . 'pertinent pour répondre avec fiabilité à cette question.'
            ),
            'intent' => 'knowledge_search',
            'provider' => 'none',
            'used_data' => $usedData,
            'error_code' => null,
            'message' => null,
        ];
    }

    $answer = data_get($response, 'data.answer');

    if (
        $ragStatus !== 'ok'
        || ! is_string($answer)
        || trim($answer) === ''
    ) {
        return null;
    }

    return [
        'status' => 'ok',
        'answer' => $this->cleanAssistantAnswerText($answer),
        'intent' => 'knowledge_search',
        'provider' => data_get(
            $response,
            'data.llm_provider',
            'none'
        ),
        'used_data' => $usedData,
        'error_code' => null,
        'message' => null,
    ];
}

    private function summarizeUsedData(array $route, array $toolResults): array
    {
        $ragSources = collect(data_get($toolResults, 'knowledge_base.chunks', []))
            ->pluck('document_title')
            ->filter()
            ->unique()
            ->values()
            ->toArray();

        return [
            'tools_used' => collect($route['tools'] ?? [])
                ->pluck('name')
                ->values()
                ->toArray(),

            'router_provider' => $route['provider'] ?? null,
            'router_confidence' => $route['confidence'] ?? null,

            'has_stats' => ! empty(data_get($toolResults, 'business_snapshot.stats')),
            'sales_periods_count' => count(data_get($toolResults, 'business_snapshot.sales_by_period', [])),
            'top_products_count' => count(data_get($toolResults, 'business_snapshot.top_products', [])),
            'top_customers_count' => count(data_get($toolResults, 'business_snapshot.top_customers', [])),
            'orders_status_count' => count(data_get($toolResults, 'business_snapshot.orders_by_status', [])),
            'low_stock_products_count' => count(data_get($toolResults, 'business_snapshot.low_stock_products', [])),

            'stock_forecast_products_count' => count(data_get($toolResults, 'stock_forecast.products', [])),
            'stock_forecast_provider' => data_get($toolResults, 'stock_forecast.provider'),

            'rag_chunks_count' => data_get($toolResults, 'knowledge_base.chunks_count', 0),
            'rag_sources' => $ragSources,
        ];
    }

    private function intentFromTools(array $tools): string
    {
        $toolNames = collect($tools)->pluck('name')->toArray();

        if (in_array('get_stock_forecast', $toolNames, true)) {
            return 'stock_forecast';
        }

        if (in_array('search_knowledge_base', $toolNames, true)) {
            return 'knowledge_search';
        }

        if (in_array('get_business_snapshot', $toolNames, true)) {
            return 'business_analysis';
        }

        return 'general_analysis';
    }

    private function cleanAssistantAnswerText(string $answer): string
    {
        $answer = str_replace(
            [
                'Réponse concise et professionnelle.',
                'Voici la réponse :',
            ],
            [
                '',
                '',
            ],
            $answer
        );

        $answer = preg_replace('/\n{3,}/', "\n\n", $answer);

        return trim($answer);
    }
}

