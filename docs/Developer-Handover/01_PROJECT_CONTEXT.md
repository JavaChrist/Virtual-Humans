# 01 — Contexte du projet

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

Le dépôt attendu utilise Next.js, React, TypeScript strict, Tailwind CSS, App Router/API Routes et Supabase. Les intégrations incluent notamment OpenAI, ElevenLabs et des modèles servis directement ou via fal.ai. Le code réel doit être audité avant toute implémentation : ce pack définit la cible, pas l'état exact d'un dépôt non fourni.

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

