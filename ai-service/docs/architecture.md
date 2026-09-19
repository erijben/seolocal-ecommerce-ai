# SmartCommerce AI Service
le produit IA n’est pas lié à Laravel ;
la sécurité multi-client est prévue dès le départ ;
Ollama Cloud reste configurable ;
les données d’un client ne peuvent pas se mélanger avec celles d’un autre ;
le RAG, le ML et les rapports gardent des responsabilités distinctes.
## Objectif

SmartCommerce AI Service est un service IA indépendant destiné à être intégré à différentes plateformes e-commerce par API HTTP.

Le service ne dépend pas directement de Laravel, React ou des tables de la plateforme SmartCommerce actuelle.

## Responsabilités

Le service prend en charge :

- l’assistant IA e-commerce ;
- l’orchestration des outils métier ;
- la recherche documentaire RAG ;
- les embeddings et la recherche vectorielle ;
- les prévisions de stock ;
- la génération contrôlée des rapports ;
- la gestion des providers LLM locaux ou cloud ;
- la traçabilité des traitements IA.

## Non-responsabilités

Le service ne prend pas en charge :

- l’interface utilisateur du client ;
- la gestion des commandes ;
- le paiement ;
- l’authentification des utilisateurs finaux de la plateforme cliente ;
- la modification directe de la base e-commerce du client.

## Architecture

Le service est développé avec FastAPI et organisé en modules internes :

- assistant ;
- documents et RAG ;
- embeddings ;
- prévisions ML ;
- rapports ;
- providers LLM ;
- sécurité et multi-tenant.

Il s’agit initialement d’un seul service déployable, et non de plusieurs microservices physiques.

## Multi-client

Chaque client est représenté par un tenant.

Toutes les données doivent être isolées par tenant :

- documents ;
- passages documentaires ;
- produits ;
- ventes ;
- prévisions ;
- conversations ;
- rapports.

Une clé API est associée à un tenant et à des permissions.

Le tenant ne doit jamais être déterminé uniquement depuis une valeur envoyée librement par le client. Il doit être retrouvé à partir de la clé API authentifiée.

## Données e-commerce

Les plateformes clientes transmettent des données normalisées par API :

- produits ;
- stocks ;
- commandes ;
- ventes ;
- clients ou segments clients ;
- événements de stock.

Le service ne doit pas accéder directement aux tables spécifiques d’une plateforme cliente.

## Providers IA

Le service doit supporter au minimum :

- Ollama local ;
- Ollama Cloud.

Le provider et le modèle sont configurables.

Aucun fallback vers un provider externe ne doit être activé automatiquement sans configuration et consentement explicites.

## RAG

Le RAG cible utilise :

- extraction et nettoyage des documents ;
- découpage sémantique ;
- embeddings ;
- PostgreSQL avec pgvector ;
- recherche vectorielle ;
- recherche lexicale complémentaire ;
- filtres par tenant ;
- reranking ;
- citations structurées.

## Prévisions ML

Le module de prévision doit :

- conserver une baseline simple ;
- tester plusieurs modèles selon le profil du produit ;
- effectuer une validation temporelle ;
- retourner MAE, RMSE et R² lorsque ces mesures sont pertinentes ;
- produire un intervalle d’incertitude ;
- expliquer le modèle choisi ;
- séparer prévision de demande et recommandation de réapprovisionnement.

## Rapports

Les rapports restent hybrides :

- les calculs sont réalisés par le code ;
- les données sont validées avant génération ;
- le LLM rédige ou priorise uniquement à partir des faits autorisés ;
- aucun rapport invalide ou message d’indisponibilité ne doit être enregistré comme succès.

## Migration

La migration est progressive.

Laravel conserve temporairement les routes utilisées par React et délègue progressivement au nouveau service :

1. appels LLM ;
2. assistant ;
3. RAG ;
4. prévisions ;
5. rapports.

L’application actuelle doit rester fonctionnelle pendant toute la migration.