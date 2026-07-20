<?php
/*Ce fichier joue le rôle de mini “cerveau d’orientation”.
Il comprend le sujet de la question avant même d’appeler OpenAI.*/
namespace App\Services\Ai;

class AiIntentClassifier
{
    public function classify(string $question): string
    {
        $question = mb_strtolower($question, 'UTF-8');
if ($this->contains($question, [
    'politique',
    'règle',
    'regle',
    'procédure',
    'procedure',
    'faq',
    'document',
    'connaissance',
    'retour',
    'remboursement',
    'livraison',
    'garantie',
    'fournisseur',
    'réapprovisionnement',
    'reapprovisionnement',
    'réapprovisionné',
    'reapprovisionne',
])) {
    return 'knowledge_search';
}
        if ($this->contains($question, ['stock', 'réapprovision', 'reapprovision', 'rupture', 'seuil'])) {
            return 'stock_analysis';
        }

        if ($this->contains($question, ['vente', 'ventes', 'chiffre', 'revenu', 'ca', 'période', 'periode'])) {
            return 'sales_analysis';
        }

        if ($this->contains($question, ['client', 'clients', 'fidélité', 'fidelite', 'acheteur'])) {
            return 'customer_analysis';
        }

        if ($this->contains($question, ['produit', 'produits', 'vendu', 'vendus', 'performance'])) {
            return 'product_analysis';
        }

        if ($this->contains($question, ['marketing', 'promotion', 'campagne', 'offre', 'recommandation'])) {
            return 'marketing_advice';
        }

        return 'general_analysis';
    }

public function label(string $intent): string
{
    return match ($intent) {
        'stock_forecast' => 'Prévision de stock',
        'knowledge_search' => 'Base de connaissances',
        'stock_analysis' => 'Analyse de stock',
        'sales_analysis' => 'Analyse des ventes',
        'customer_analysis' => 'Analyse clients',
        'product_analysis' => 'Analyse produits',
        'marketing_advice' => 'Conseil marketing',
        default => 'Analyse générale',
    };
}
    private function contains(string $text, array $keywords): bool
    {
        foreach ($keywords as $keyword) {
            if (str_contains($text, $keyword)) {
                return true;
            }
        }

        return false;
    }
}