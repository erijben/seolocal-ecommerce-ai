<?php

namespace App\Services\Ai;

use App\Services\Ai\Providers\AiProviderManager;

class AiRouterService
{
    public function __construct(
        private AiProviderManager $providerManager,
    ) {
    }

    public function route(string $question): array
    {
        if (config('services.ai.provider') === 'ollama') {
    return $this->routeLocally($question);
}
    $messages = [
        [
            'role' => 'system',
            'content' => $this->systemPrompt(),
        ],
        [
            'role' => 'user',
            'content' => $question,
        ],
    ];


        $result = $this->providerManager->chat($messages, [
            'purpose' => 'tool_routing',
        ]);

       $json = $this->extractJson($result['answer'] ?? '');

if (! is_array($json)) {
    return $this->routeLocally($question);
}

        $tools = collect($json['tools'] ?? [])
            ->map(function ($tool) {
                return [
                    'name' => $tool['name'] ?? '',
                    'reason' => $tool['reason'] ?? '',
                ];
            })
            ->filter(fn ($tool) => in_array($tool['name'], $this->allowedTools(), true))
            ->unique('name')
            ->values()
            ->toArray();

        if (empty($tools)) {
            $tools = [
                [
                    'name' => 'search_knowledge_base',
                    'reason' => 'Recherche générique dans les documents internes disponibles.',
                ],
            ];
        }
        $confidence = is_numeric($json['confidence'] ?? null)
    ? max(0.0, min(1.0, (float) $json['confidence']))
    : 0.5;

return [
    'provider' => $result['provider'] ?? 'none',
    'tools' => $tools,
    'confidence' => $confidence,
];

    }

    //elle fonctionne comme un catalogue d’outils : C’est une sélection d’outils
    
   

    // Le RAG est toujours disponible comme mémoire documentaire interne.
    // Ce n'est pas une réponse codée : c'est un outil de recherche.
 private function routeLocally(string $question): array
{
    $normalizedQuestion = str($question)->lower()->ascii()->toString();

    $toolCatalog = [
        'get_stock_forecast' => [
            'reason' => 'La question peut nécessiter une prévision ML de stock ou une analyse de risque de rupture.',
            'signals' => [
                'prevision',
                'forecast',
                'predire',
                'prediction',
                'futur',
                'future',
                '30 prochains jours',
                'rupture',
                'rupture stock',
                'rupture de stock',
                'risque de rupture',
                'demande prevue',
                'reassort',
                'stock forecast',
                'reapprovision',
                'reapprovisionnement',
                'approvisionnement',
                'stock',
                'stocks',
                'stock faible',
                'faible stock',
                'priorite stock',
            ],
        ],

        'get_business_snapshot' => [
            'reason' => 'La question peut nécessiter les données e-commerce : ventes, produits, clients, commandes ou performance.',
            'signals' => [
                'vente',
                'ventes',
                'vend',
                'produit',
                'produits',
                'client',
                'clients',
                'commande',
                'commandes',
                'chiffre',
                'ca',
                'dashboard',
                'statistique',
                'statistiques',
                'meilleur',
                'meilleurs',
                'top',
                'performance',
                'marketing',
                'promotion',
                'actions marketing',
            ],
        ],

        'search_knowledge_base' => [
            'reason' => 'La question peut nécessiter les règles, politiques, procédures, FAQ ou documents internes.',
            'signals' => [
                'politique',
                'regle',
                'regles',
                'procedure',
                'procedures',
                'faq',
                'document',
                'documents',
                'interne',
                'internes',
                'condition',
                'conditions',
                'retour',
                'remboursement',
                'livraison',
                'expedition',
                'fournisseur',
                'fournisseurs',
                'achat',
                'commande achat',
                'promotion',
                'marketing',
                'avant une promotion',
                'reapprovision',
                'reapprovisionnement',
                'litige',
                'garantie',
            ],
        ],
    ];

    $tools = collect($toolCatalog)
        ->map(function (array $definition, string $toolName) use ($normalizedQuestion) {
            return [
                'name' => $toolName,
                'reason' => $definition['reason'],
                'score' => $this->scoreToolSignals($normalizedQuestion, $definition['signals']),
            ];
        })
        ->filter(fn (array $tool) => $tool['score'] > 0)
        ->sortByDesc('score')
        ->map(fn (array $tool) => [
            'name' => $tool['name'],
            'reason' => $tool['reason'],
        ])
        ->values();

    if ($tools->isEmpty()) {
        $tools = collect([
            [
                'name' => 'get_business_snapshot',
                'reason' => 'Analyse générale des données e-commerce disponibles.',
            ],
            [
                'name' => 'search_knowledge_base',
                'reason' => 'Recherche complémentaire dans les documents internes.',
            ],
        ]);
    }

    return [
        'provider' => 'local_router',
        'tools' => $tools
            ->unique('name')
            ->values()
            ->toArray(),
        'confidence' => 0.75,
    ];
}
    private function systemPrompt(): string
    {
        return "
Tu es un routeur d'outils pour un assistant e-commerce.

Tu ne dois PAS répondre à la question finale.
Tu dois seulement choisir les outils utiles.

Outils disponibles :
1. search_knowledge_base : chercher dans les PDF et documents internes uploadés.
2. get_stock_forecast : récupérer les prévisions de stock depuis le microservice ML Python.
3. get_business_snapshot : récupérer les statistiques e-commerce actuelles.

Réponds uniquement en JSON valide.
Aucun markdown.

Format :
{
  \"tools\": [
    {
      \"name\": \"search_knowledge_base\",
      \"reason\": \"raison courte\"
    }
  ],
  \"confidence\": 0.0
}
";
    }

    private function allowedTools(): array
    {
        return [
            'search_knowledge_base',
            'get_stock_forecast',
            'get_business_snapshot',
        ];
    }

   private function scoreToolSignals(string $question, array $signals): int
{
    $score = 0;

    foreach ($signals as $signal) {
        $normalizedSignal = str($signal)->lower()->ascii()->toString();

        if (str_contains($question, $normalizedSignal)) {
            $score++;
        }
    }

    return $score;
}


    private function extractJson(?string $text): ?array
    {
        if (! is_string($text) || trim($text) === '') {
            return null;
        }

        $text = trim($text);
        $text = preg_replace('/^```json\s*/i', '', $text);
        $text = preg_replace('/^```\s*/', '', $text);
        $text = preg_replace('/\s*```$/', '', $text);

        $decoded = json_decode($text, true);

        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return $decoded;
        }

        if (preg_match('/\{.*\}/s', $text, $matches)) {
            $decoded = json_decode($matches[0], true);

            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                return $decoded;
            }
        }

        return null;
    }
}