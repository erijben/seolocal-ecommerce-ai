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

    if (! $this->hasOpenAiKey()) {
        return $this->generateDemoReport($type, $period, $businessData);
    }

    $prompt = $this->buildReportPrompt($type, $period, $businessData);

    $aiResponse = $this->askAi($prompt);

    if ($aiResponse === null) {
        return "## Mode démo intelligent activé

OpenAI n'est pas disponible actuellement ou le quota API est insuffisant.

Le système utilise donc l'analyse locale basée sur les vraies données du dashboard.

" . $this->generateDemoReport($type, $period, $businessData);
    }

    return $aiResponse;
}

 public function answerQuestion(string $question): string
{
    $businessData = $this->getBusinessData('monthly');

    if (! $this->hasOpenAiKey()) {
        return $this->generateDemoAnswer($question, $businessData);
    }

    $prompt = $this->buildQuestionPrompt($question, $businessData);

    $aiResponse = $this->askAi($prompt);

    if ($aiResponse === null) {
        return "## Mode démo intelligent activé

OpenAI n'est pas disponible actuellement ou le quota API est insuffisant.

Le système utilise donc l'analyse locale basée sur les vraies données du dashboard.

" . $this->generateDemoAnswer($question, $businessData);
    }

    return $aiResponse;
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
        $reportTitle = $this->getReportTitle($type);

        return "
Tu es un assistant IA spécialisé dans l'analyse commerciale e-commerce.

Tu travailles dans une application appelée SmartCommerce AI Dashboard.
Ta mission est de générer : {$reportTitle}.
Période d'analyse : {$period}.

Règles importantes :
- Réponds uniquement à partir des données fournies.
- N'invente aucun chiffre.
- Ne donne pas de réponse vague.
- Réponds en français.
- Utilise un ton professionnel, clair et utile.
- Donne des recommandations concrètes et exploitables.
- Si une donnée manque, signale-le clairement.

Structure obligatoire :
1. Résumé rapide
2. Analyse des données
3. Points forts
4. Points faibles ou risques
5. Recommandations concrètes

Données commerciales disponibles :
" . json_encode($businessData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "
";
    }

    private function buildQuestionPrompt(string $question, array $businessData): string
    {
        return "
Tu es un assistant IA intégré dans une plateforme e-commerce.

L'administrateur pose une question sur son activité commerciale.
Tu dois répondre uniquement avec les données fournies.
Tu ne dois pas inventer de chiffres.
Tu dois donner une réponse courte, claire et directement utile.

Question :
{$question}

Données commerciales disponibles :
" . json_encode($businessData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "

Réponds en français avec :
- une réponse directe
- les données utilisées
- une recommandation concrète
";
    }

    private function askAi(string $prompt): ?string
{
    $apiKey = config('services.openai.key');

    if (! $apiKey) {
        return null;
    }

    $response = Http::withToken($apiKey)
        ->timeout(60)
        ->post('https://api.openai.com/v1/responses', [
            'model' => config('services.openai.model', 'gpt-4.1-mini'),
            'input' => $prompt,
        ]);

    if (! $response->successful()) {
        return null;
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

    private function hasOpenAiKey(): bool
    {
        $apiKey = config('services.openai.key');

        return is_string($apiKey) && trim($apiKey) !== '';
    }

    private function generateDemoReport(string $type, string $period, array $businessData): string
    {
        return match ($type) {
            'sales_report' => $this->generateSalesDemoReport($period, $businessData),
            'stock_recommendation' => $this->generateStockDemoReport($businessData),
            'customer_analysis' => $this->generateCustomerDemoReport($businessData),
            'marketing_recommendation' => $this->generateMarketingDemoReport($businessData),
            default => $this->generateGeneralDemoReport($businessData),
        };
    }

    private function generateDemoAnswer(string $question, array $businessData): string
    {
        $normalizedQuestion = mb_strtolower($question, 'UTF-8');

        if (
            str_contains($normalizedQuestion, 'stock') ||
            str_contains($normalizedQuestion, 'réapprovision') ||
            str_contains($normalizedQuestion, 'reapprovision')
        ) {
            return "
## Réponse IA démo — Réapprovisionnement

Les produits à surveiller en priorité sont :

" . $this->lowStockProductsText($businessData) . "

### Données utilisées

L'analyse se base sur les produits dont le stock actuel est inférieur ou égal au seuil d'alerte.

### Recommandation

Il faut réapprovisionner en priorité les produits listés ci-dessus, car ils risquent de bloquer les ventes si la demande continue.
";
        }

        if (
            str_contains($normalizedQuestion, 'client') ||
            str_contains($normalizedQuestion, 'clients')
        ) {
            return "
## Réponse IA démo — Clients

Les meilleurs clients actuellement sont :

" . $this->topCustomersText($businessData) . "

### Données utilisées

L'analyse se base sur le total dépensé et le nombre de commandes par client.

### Recommandation

Tu peux proposer une offre de fidélité ou une remise personnalisée aux meilleurs clients afin d'encourager de nouvelles commandes.
";
        }

        if (
            str_contains($normalizedQuestion, 'produit') ||
            str_contains($normalizedQuestion, 'produits') ||
            str_contains($normalizedQuestion, 'vend')
        ) {
            return "
## Réponse IA démo — Produits

Les produits les plus performants sont :

" . $this->topProductsText($businessData) . "

### Données utilisées

L'analyse se base sur les produits les plus vendus et leur contribution au chiffre d'affaires.

### Recommandation

Tu peux mettre ces produits en avant sur la page d'accueil ou créer des offres groupées avec des produits complémentaires.
";
        }

        if (
            str_contains($normalizedQuestion, 'marketing') ||
            str_contains($normalizedQuestion, 'promotion') ||
            str_contains($normalizedQuestion, 'recommand')
        ) {
            return "
## Réponse IA démo — Marketing

Voici les actions marketing les plus pertinentes :

- Mettre en avant les produits les plus vendus.
- Créer une offre spéciale pour les meilleurs clients.
- Réapprovisionner les produits à stock faible avant de lancer une promotion.
- Proposer des bundles avec les produits populaires.

### Produits à valoriser

" . $this->topProductsText($businessData) . "

### Recommandation

Commence par une campagne simple : promotion sur les produits populaires + message personnalisé aux meilleurs clients.
";
        }

        return "
## Réponse IA démo — Analyse générale

Voici un résumé de l'activité actuelle :

" . $this->statsText($businessData) . "

### Produits les plus vendus

" . $this->topProductsText($businessData) . "

### Produits à stock faible

" . $this->lowStockProductsText($businessData) . "

### Recommandation

Pour une meilleure analyse, pose une question plus précise, par exemple :
- Quels produits dois-je réapprovisionner ?
- Quels sont mes meilleurs clients ?
- Quelles actions marketing peux-tu recommander ?
";
    }

    private function generateSalesDemoReport(string $period, array $businessData): string
    {
        return "
## Rapport IA démo — Ventes

### 1. Résumé rapide

" . $this->statsText($businessData) . "

Période analysée : {$period}.

### 2. Analyse des ventes

" . $this->salesTrendText($businessData) . "

### 3. Produits les plus vendus

" . $this->topProductsText($businessData) . "

### 4. Meilleurs clients

" . $this->topCustomersText($businessData) . "

### 5. Recommandations

- Mettre en avant les produits les plus vendus.
- Surveiller les périodes où les ventes sont faibles.
- Proposer des offres ciblées aux meilleurs clients.
- Éviter de promouvoir les produits dont le stock est trop faible.
";
    }

    private function generateStockDemoReport(array $businessData): string
    {
        return "
## Rapport IA démo — Recommandations de stock

### 1. Résumé rapide

Les produits suivants nécessitent une attention particulière :

" . $this->lowStockProductsText($businessData) . "

### 2. Risque principal

Un produit avec un stock inférieur ou égal à son seuil d'alerte peut provoquer une rupture et donc une perte de ventes.

### 3. Recommandations

- Réapprovisionner d'abord les produits les plus vendus qui sont aussi en stock faible.
- Ne pas lancer de promotion sur un produit dont le stock est critique.
- Vérifier régulièrement les seuils d'alerte selon la vitesse de vente.
- Augmenter le stock minimum des produits populaires.
";
    }

    private function generateCustomerDemoReport(array $businessData): string
    {
        return "
## Rapport IA démo — Analyse clients

### 1. Résumé rapide

" . $this->statsText($businessData) . "

### 2. Meilleurs clients

" . $this->topCustomersText($businessData) . "

### 3. Analyse

Les meilleurs clients sont ceux qui génèrent le plus de chiffre d'affaires ou qui passent plusieurs commandes.

### 4. Recommandations

- Créer une offre de fidélité pour les clients les plus actifs.
- Envoyer une remise personnalisée aux meilleurs clients.
- Identifier les clients qui n'ont commandé qu'une seule fois pour les inciter à revenir.
- Mettre en place une segmentation simple : nouveaux clients, clients réguliers, meilleurs clients.
";
    }

    private function generateMarketingDemoReport(array $businessData): string
    {
        return "
## Rapport IA démo — Recommandations marketing

### 1. Produits à mettre en avant

" . $this->topProductsText($businessData) . "

### 2. Clients à cibler

" . $this->topCustomersText($businessData) . "

### 3. Produits à éviter en promotion

" . $this->lowStockProductsText($businessData) . "

### 4. Recommandations concrètes

- Mettre en avant les produits les plus vendus dans une campagne marketing.
- Créer une offre spéciale pour les meilleurs clients.
- Préparer un réapprovisionnement avant de promouvoir les produits à stock faible.
- Créer des packs : produit populaire + produit complémentaire.
- Utiliser les données du dashboard pour ajuster les promotions chaque mois.
";
    }

    private function generateGeneralDemoReport(array $businessData): string
    {
        return "
## Rapport IA démo — Analyse commerciale générale

### Résumé

" . $this->statsText($businessData) . "

### Produits importants

" . $this->topProductsText($businessData) . "

### Stock à surveiller

" . $this->lowStockProductsText($businessData) . "

### Recommandations

- Suivre les ventes par période.
- Réapprovisionner les produits en stock faible.
- Cibler les meilleurs clients.
- Mettre en avant les produits les plus vendus.
";
    }

    private function statsText(array $businessData): string
    {
        $stats = $businessData['stats'] ?? [];

        $revenue = data_get($stats, 'revenue', data_get($stats, 'total_revenue', 0));
        $ordersCount = data_get($stats, 'orders_count', 0);
        $customersCount = data_get($stats, 'customers_count', 0);
        $productsCount = data_get($stats, 'products_count', 0);
        $lowStockCount = data_get($stats, 'low_stock_count', 0);

        return "- Chiffre d'affaires : " . $this->money($revenue) . "
- Nombre de commandes : {$ordersCount}
- Nombre de clients : {$customersCount}
- Nombre de produits : {$productsCount}
- Produits à stock faible : {$lowStockCount}";
    }

    private function topProductsText(array $businessData): string
    {
        $products = collect($businessData['top_products'] ?? [])->take(5);

        if ($products->isEmpty()) {
            return "- Aucun produit vendu pour le moment.";
        }

        return $products->map(function ($product, $index) {
            $name = data_get($product, 'name', data_get($product, 'product_name', 'Produit'));
            $quantity = data_get($product, 'total_quantity', data_get($product, 'total_sold', data_get($product, 'quantity_sold', 0)));
            $revenue = data_get($product, 'total_revenue', data_get($product, 'revenue', data_get($product, 'total_sales', 0)));

            if ((float) $revenue > 0) {
                return ($index + 1) . ". {$name} — {$quantity} vente(s), CA : " . $this->money($revenue);
            }

            return ($index + 1) . ". {$name} — {$quantity} vente(s)";
        })->implode("\n");
    }

    private function topCustomersText(array $businessData): string
    {
        $customers = collect($businessData['top_customers'] ?? [])->take(5);

        if ($customers->isEmpty()) {
            return "- Aucun client avec commande pour le moment.";
        }

        return $customers->map(function ($customer, $index) {
            $name = data_get($customer, 'customer_name');

            if (! $name) {
                $firstName = data_get($customer, 'first_name', '');
                $lastName = data_get($customer, 'last_name', '');
                $name = trim($firstName . ' ' . $lastName);
            }

            if (! $name) {
                $name = data_get($customer, 'full_name', 'Client');
            }

            $ordersCount = data_get($customer, 'orders_count', data_get($customer, 'total_orders', 0));
            $totalSpent = data_get($customer, 'total_spent', data_get($customer, 'total_amount', data_get($customer, 'revenue', 0)));

            return ($index + 1) . ". {$name} — {$ordersCount} commande(s), total : " . $this->money($totalSpent);
        })->implode("\n");
    }

    private function lowStockProductsText(array $businessData): string
    {
        $products = collect($businessData['low_stock_products'] ?? [])->take(10);

        if ($products->isEmpty()) {
            return "- Aucun produit en stock faible actuellement.";
        }

        return $products->map(function ($product) {
            $name = data_get($product, 'name', data_get($product, 'product_name', 'Produit'));
            $stock = data_get($product, 'stock_quantity', data_get($product, 'stock', 0));
            $threshold = data_get($product, 'stock_alert_threshold', data_get($product, 'threshold', 0));
            $category = data_get($product, 'category.name', data_get($product, 'category_name', 'Catégorie non renseignée'));

            return "- {$name} ({$category}) — stock : {$stock}, seuil d'alerte : {$threshold}";
        })->implode("\n");
    }

    private function salesTrendText(array $businessData): string
    {
        $sales = collect($businessData['sales_by_period'] ?? [])->values();

        if ($sales->count() < 2) {
            return "Les données de ventes par période sont encore insuffisantes pour détecter une tendance claire.";
        }

        $previous = $sales->get($sales->count() - 2);
        $last = $sales->last();

        $previousValue = (float) data_get($previous, 'total_sales', data_get($previous, 'revenue', data_get($previous, 'total_revenue', 0)));
        $lastValue = (float) data_get($last, 'total_sales', data_get($last, 'revenue', data_get($last, 'total_revenue', 0)));

        $previousPeriod = data_get($previous, 'period', data_get($previous, 'date', 'période précédente'));
        $lastPeriod = data_get($last, 'period', data_get($last, 'date', 'dernière période'));

        if ($lastValue > $previousValue) {
            return "Les ventes sont en hausse entre {$previousPeriod} et {$lastPeriod}. Elles passent de "
                . $this->money($previousValue) . " à " . $this->money($lastValue) . ".";
        }

        if ($lastValue < $previousValue) {
            return "Les ventes sont en baisse entre {$previousPeriod} et {$lastPeriod}. Elles passent de "
                . $this->money($previousValue) . " à " . $this->money($lastValue) . ".";
        }

        return "Les ventes sont stables entre {$previousPeriod} et {$lastPeriod}, avec un total de "
            . $this->money($lastValue) . ".";
    }

    private function getReportTitle(string $type): string
    {
        return match ($type) {
            'sales_report' => 'rapport de ventes',
            'stock_recommendation' => 'recommandations de réapprovisionnement',
            'customer_analysis' => 'analyse des clients',
            'marketing_recommendation' => 'recommandations marketing',
            default => 'analyse commerciale',
        };
    }

    private function money($value): string
    {
        return number_format((float) $value, 2, ',', ' ') . ' €';
    }
}