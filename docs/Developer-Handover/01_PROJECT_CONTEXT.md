# 01 — Contexte du projet

**Classe :** `CURRENT` (rafraîchi 11 août 2026)

> Le dépôt `studio/` est fourni et audité (`CURRENT_CODEBASE_AUDIT.md`, Phases 1–11A).
> Ce document décrit le **produit** ; l’état ops vit dans `BACKLOG_V2.md` + rapports `27`–`58`.
> Validé en Production : cinq Directeurs **texte** (Marketing→Storyboard).
> Non validé : média réel sur `/director` (Phase 11A `DECISION_REQUIRED`).

## Problème

Les outils de génération demandent à l'utilisateur de comprendre les modèles, les prompts, les paramètres, les formats et les compromis coût/qualité. Virtual Humans Studio transforme cette complexité en décisions assistées et traçables.

## Proposition de valeur

Le produit part d'une intention : produit ou service, objectif, plateforme, personnage, durée, ton et médias disponibles. Il livre un projet vidéo éditable, composé de scènes indépendantes, puis un export final.

## Utilisateurs

- créateurs et petites entreprises sans expertise vidéo ;
- équipes marketing souhaitant industrialiser des variantes ;
- opérateurs avancés utilisant les studios spécialisés ;
- développeurs intégrant de nouveaux personnages ou providers.

## Périmètre V2

- parcours guidé `/director` ;
- huit responsabilités métier clairement séparées ;
- routage multi-modèles et fallbacks bornés ;
- production asynchrone, reprise et régénération par scène ;
- estimation et journalisation des coûts ;
- projets persistants dans Supabase ;
- montage et export ;
- conservation des studios existants.

## Hors périmètre V2

- entraînement de modèles propriétaires ;
- marketplace publique de personnages ;
- collaboration temps réel multi-utilisateurs ;
- apprentissage automatique autonome du Router ;
- publication directe sur les réseaux sociaux.

## Contraintes héritées

Stack réelle (`studio/`) : Next.js App Router, React, TypeScript strict, Tailwind CSS, Supabase. Intégrations : OpenAI, ElevenLabs, fal.ai (et chemins legacy). L’audit Phase 0 et les Phases 1–10 ont confirmé structure, schéma V2 (29 migrations) et smokes texte ; ce pack n’est plus « dépôt absent ».

## Actifs existants à préserver

Dashboard, Characters, Image Studio, Voice Studio, Video Studio, LipSync Studio, Scene Studio, Storyboard Studio, Product Studio, Budget, Settings, export, PWA et Runtime SDK. Tom et Mei sont des données du Runtime SDK, jamais des branches métier.

## Mesures de succès

- un brief valide atteint un storyboard validable sans choix technique utilisateur ;
- 100 % des générations ont estimation, décision de routage et coût réel ;
- une scène échouée peut être reprise sans régénérer le projet ;
- aucun fournisseur n'est visible dans le parcours standard ;
- ajout d'un provider sans modification des Directeurs ni de l'UI métier ;
- respect des plafonds de budget et absence de retry infini.

## Hypothèses à confirmer pendant l'audit

- structure exacte du dépôt et versions des dépendances ;
- schéma Supabase existant et politique d'authentification ;
- contrats actuels du Runtime SDK ;
- formats d'assets, moteur de merge et infrastructure de jobs ;
- providers réellement activés et contraintes contractuelles.

