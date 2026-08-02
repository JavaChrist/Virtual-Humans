# Backlog V2

Ce backlog est initial et doit être recalibré après `03_CURRENT_AUDIT.md`. Les identifiants sont stables ; chaque item exige critères d'acceptation, tests et documentation.

## P0 — fondations

- **VHS-001** ✅ Auditer dépôt, schéma et flux actuels. *(voir `CURRENT_CODEBASE_AUDIT.md`)*
- **VHS-002** Sécuriser secrets, routes critiques, RLS et buckets. *(bloqué : décision ops Q1 `APP_PASSWORD`)*
- **VHS-003** ✅ Créer types/schemas communs et métadonnées d'artifact.
- **VHS-004** ✅ Implémenter révisions, états et optimistic locking. *(domaine pur `studio/src/domain/project` ; pas de persistance ni UI)*
- **VHS-005** 🟡 Poser corrélation, logs redacted, métriques et traces. *(partiel : correlation + redaction + logger + 3 routes ; restent métriques/traces + généralisation)*
- **VHS-006** 🟡 Implémenter ledger, estimation, réservation et plafond dur. *(partiel : contrats domaine Money/CostEstimate/Budget/DryRun + adapter legacy ; pas de ledger persisté ni branchement routes generate ; Q3 ouverte)*

## P1 — parcours métier

- **VHS-101** 🟡 Marketing Director. *(domaine + orchestration dry-run + port injectable ; pas d’adaptateur IA ni UI `/director`)*
- **VHS-102** Creative Director.
- **VHS-103** Script Writer avec calcul de durée.
- **VHS-104** Art Director et validation des assets Runtime SDK.
- **VHS-105** Storyboard Director et approbation de révision.
- **VHS-106** Prompt builders, packages et composers.
- **VHS-107** Capability Registry versionné.
- **VHS-108** Strategy Library et Model Router explicable.
- **VHS-109** Generation Engine et suite de contrats adapters.
- **VHS-110** Production Director, queue, reprise et annulation.
- **VHS-111** Contrôle qualité, merge, manifeste et export.
- **VHS-112** 🟡 Parcours `/director` accessible avec autosave. *(stub : brief Zod + autosave local + flag `DIRECTOR_V2_ENABLED` ; pas de Marketing Director ni Supabase)*
- **VHS-113** Persistance Supabase et projections temps réel.

## P2 — durcissement

- **VHS-201** Matrice E2E multi-formats/plateformes.
- **VHS-202** Chaos tests providers et workers.
- **VHS-203** Dashboard coût, fiabilité et fallbacks.
- **VHS-204** Outils de support : replay sûr et inspection de manifest.
- **VHS-205** Baseline performance, SLO et alertes.
- **VHS-206** Rétention, export utilisateur et purge automatisée.

## P3 — après V2

- **VHS-301** Poids du Router proposés par données historiques.
- **VHS-302** Collaboration et rôles d'équipe avancés.
- **VHS-303** Publication sociale assistée.
- **VHS-304** Bibliothèque de styles et tendances gouvernées.

## Definition of Ready

Dépendances identifiées, maquette/contrat disponible, risque et données classifiés, métrique de succès définie, stratégie de test et rollback compris.

