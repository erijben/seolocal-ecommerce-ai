<?php

namespace App\Services;

use App\Services\Ai\AiRouterService;
use App\Services\Ai\AiToolExecutorService;
use App\Services\Ai\Providers\AiProviderManager;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AiService
{
    public function __construct(
        private DashboardService $dashboardService,
        private AiRouterService $routerService,
        private AiToolExecutorService $toolExecutorService,
        private AiProviderManager $providerManager,
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
            'tools' => collect($route['tools'] ?? [])->pluck('name')->values()->toArray(),
        ]);

        $toolResults = $this->toolExecutorService->execute(
            tools: $route['tools'] ?? [],
            question: $question,
            requestId: $requestId
        );

        Log::info('AI tools executed', [
            'request_id' => $requestId,
            'rag_chunks_count' => data_get($toolResults, 'knowledge_base.chunks_count', 0),
            'stock_forecast_products_count' => count(data_get($toolResults, 'stock_forecast.products', [])),
            'has_business_snapshot' => ! empty(data_get($toolResults, 'business_snapshot.stats')),
        ]);

        if (! $this->hasUsableToolData($toolResults)) {
            $finalResponse = ['provider' => 'none', 'answer' => null];
        } else {
            $finalResponse = $this->providerManager->chat([
                [
                    'role' => 'system',
                    'content' => $this->finalAnswerSystemPrompt(),
                ],
                [
                    'role' => 'user',
                    'content' => $this->buildFinalAnswerPrompt($question, $route, $toolResults),
                ],
            ], [
                'purpose' => 'final_answer',
                'request_id' => $requestId,
            ]);
        }

        $answer = $finalResponse['answer'] ?? null;

        if (! is_string($answer) || trim($answer) === '') {
            $answer = $this->safeNoAnswer($toolResults);
        }

        Log::info('AI ask finished', [
            'request_id' => $requestId,
            'provider' => $finalResponse['provider'] ?? 'none',
            'answer_empty' => ! is_string($answer) || trim($answer) === '',
            'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
        ]);

        return [
            'answer' => $this->cleanAssistantAnswerText($answer),
            'intent' => $this->intentFromTools($route['tools'] ?? []),
            'provider' => $finalResponse['provider'] ?? 'none',
            'used_data' => $this->summarizeUsedData($route, $toolResults),
        ];
    }

    public function generateReport(string $type, string $period = 'monthly'): string
    {
        $businessData = [
            'stats' => $this->dashboardService->getStats(),
            'sales_by_period' => $this->dashboardService->getSalesByPeriod($period),
            'top_products' => $this->dashboardService->getTopProducts(5),
            'top_customers' => $this->dashboardService->getTopCustomers(5),
            'orders_by_status' => $this->dashboardService->getOrdersByStatus(),
            'low_stock_products' => $this->dashboardService->getLowStockProducts(),
        ];

        $response = $this->providerManager->chat([
            [
                'role' => 'system',
                'content' => $this->reportSystemPrompt(),
            ],
            [
                'role' => 'user',
                'content' => "
Type de rapport demandé : {$type}
Période : {$period}

Données disponibles :
" . json_encode($businessData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
            ],
        ], [
            'purpose' => 'report',
        ]);

        if (! is_string($response['answer'] ?? null)) {
            return "Le rapport n'a pas pu être généré pour le moment.";
        }

        return $this->cleanAssistantAnswerText($response['answer']);
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

    private function reportSystemPrompt(): string
    {
        return "
Tu es un assistant IA spécialisé dans l'analyse commerciale e-commerce.

Tu dois générer un rapport professionnel à partir des données fournies.
N'invente aucun chiffre.
Réponds en français.
Donne des recommandations concrètes.
";
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

    private function safeNoAnswer(array $toolResults): string
    {
        return "Le moteur IA local n’a pas répondu dans le délai disponible. Merci de réessayer dans quelques secondes.";
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

