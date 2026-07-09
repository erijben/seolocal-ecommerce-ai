<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class AiService
{
    public function __construct(private DashboardService $dashboardService)
    {
    }

    public function generateReport(string $type, string $period = 'monthly'): string
    {
        $businessData = $this->getBusinessData($period);

        $prompt = $this->buildReportPrompt($type, $period, $businessData);

        return $this->askAi($prompt);
    }

    public function answerQuestion(string $question): string
    {
        $businessData = $this->getBusinessData('monthly');

        $prompt = "
Tu es un assistant intelligent intégré dans une plateforme e-commerce.

Tu dois répondre à la question de l'administrateur uniquement à partir des données fournies.
Tu ne dois pas inventer de chiffres.
Tu dois donner une réponse claire, professionnelle et utile.

Question de l'administrateur :
{$question}

Données commerciales disponibles :
" . json_encode($businessData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "

Réponds en français avec une analyse simple et des recommandations concrètes.
";

        return $this->askAi($prompt);
    }

    private function getBusinessData(string $period): array
    {
        return [
            'stats' => $this->dashboardService->getStats(),
            'sales_by_period' => $this->dashboardService->getSalesByPeriod($period),
            'top_products' => $this->dashboardService->getTopProducts(5),
            'top_customers' => $this->dashboardService->getTopCustomers(5),
            'orders_by_status' => $this->dashboardService->getOrdersByStatus(),
            'low_stock_products' => $this->dashboardService->getLowStockProducts(),
        ];
    }

    private function buildReportPrompt(string $type, string $period, array $businessData): string
    {
        $reportTitle = match ($type) {
            'sales_report' => 'rapport de ventes',
            'stock_recommendation' => 'recommandations de réapprovisionnement',
            'customer_analysis' => 'analyse des clients',
            'marketing_recommendation' => 'recommandations marketing',
            default => 'analyse commerciale',
        };

        return "
Tu es un assistant IA spécialisé dans l'analyse commerciale e-commerce.

Ta mission est de générer un {$reportTitle}.
Période d'analyse : {$period}.

Règles importantes :
- Analyse uniquement les données fournies.
- N'invente aucun chiffre.
- Réponds en français.
- Structure la réponse avec des titres courts.
- Donne des recommandations concrètes.
- Mentionne les points forts, les points faibles et les actions conseillées.

Données commerciales :
" . json_encode($businessData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "
";
    }

    private function askAi(string $prompt): string
    {
        $apiKey = config('services.openai.key');

        if (! $apiKey) {
            return $this->fakeAiResponse();
        }

        $response = Http::withToken($apiKey)
            ->timeout(60)
            ->post('https://api.openai.com/v1/responses', [
                'model' => config('services.openai.model', 'gpt-4.1-mini'),
                'input' => $prompt,
            ]);

        if (! $response->successful()) {
            return "Erreur lors de l'appel à l'API IA : " . $response->body();
        }

        $json = $response->json();

        return $this->extractTextFromOpenAiResponse($json);
    }

    private function extractTextFromOpenAiResponse(array $json): string
    {
        if (isset($json['output_text'])) {
            return $json['output_text'];
        }

        if (isset($json['output']) && is_array($json['output'])) {
            $texts = [];

            foreach ($json['output'] as $outputItem) {
                if (! isset($outputItem['content']) || ! is_array($outputItem['content'])) {
                    continue;
                }

                foreach ($outputItem['content'] as $contentItem) {
                    if (isset($contentItem['text'])) {
                        $texts[] = $contentItem['text'];
                    }
                }
            }

            if (! empty($texts)) {
                return implode("\n", $texts);
            }
        }

        return "Réponse IA reçue, mais le format n'a pas pu être lu correctement.";
    }

    private function fakeAiResponse(): string
    {
        return "
## Analyse IA démo

L'assistant IA a bien reçu les données commerciales préparées par Laravel.

Comme aucune clé OpenAI n'est encore configurée dans le fichier `.env`, cette réponse est générée en mode démo.

### Observations

- Le système peut analyser le chiffre d'affaires, les commandes, les clients, les produits les plus vendus et les produits à stock faible.
- Les données sont préparées côté Laravel avant d'être envoyées à l'IA.
- Cette architecture protège la clé API et évite d'exposer les données depuis React.

### Recommandations

- Surveiller les produits dont le stock est inférieur ou égal au seuil d'alerte.
- Identifier les meilleurs clients pour proposer des offres de fidélité.
- Analyser les produits les plus vendus pour créer des offres groupées.
- Préparer des promotions pour les produits moins performants.

### Prochaine étape

Ajoute une vraie clé `OPENAI_API_KEY` pour obtenir une réponse générée par une IA réelle.
";
    }
}