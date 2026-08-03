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

- **VHS-101** 🟡 Marketing Director. *(domaine + orchestration dry-run + port injectable ; adaptateur OpenAI VHS-117A présent mais non branché UI)*
- **VHS-102** 🟡 Creative Director. *(VHS-118B : persistance locale, API/UI et fakeable run ajoutés ; activation IA et opérations distantes restent désactivées.)*
- **VHS-103** 🟡 Script Writer avec calcul de durée. *(VHS-119B : persistance locale, API/UI et fakeable run ; activation IA et ops distantes restent off.)*
- **VHS-104** 🟡 Art Director et validation des assets Runtime SDK. *(domaine VisualDirection + snapshot Runtime + dry-run ; pas d’adaptateur IA ni UI)*
- **VHS-105** 🟡 Storyboard Director et approbation de révision. *(domaine StoryboardProject + timing/couverture/continuité + dry-run ; page historique inchangée ; pas d’UI ni adaptateur IA)*
- **VHS-106** 🟡 Prompt Director, ScenePackages et renderers abstraits. *(domaine + dry-run ; VHS-122 : persistance `scene_package_set` déterministe branchée `/director` ; pas de Model Router ni adaptateur IA)*
- **VHS-107** 🟡 Capability Registry versionné. *(contrats + éligibilité + adaptateur legacy + dry-run ; pas de Model Router, scoring final, UI ni appels réseau)*
- **VHS-108** 🟡 Strategy Library et Model Router explicable. *(GenerationPlan + stratégies + scoring + budget + fallbacks + dry-run ; pas d’exécution, UI ni appels réseau)*
- **VHS-109** 🟡 Generation Engine et contrats d’adapters. *(engine + ports + wrappers fal/OpenAI/ElevenLabs ; cancel/webhook unsupported ; dry-run ; pas de Production Director, queue, UI ni réseau réel)*
- **VHS-110** 🟡 Production Director, orchestration multi-étapes et fallbacks. *(domaine + director borné start/advance/cancel + ports + dry-run ; pas de queue durable, Supabase, merge/export, UI ni réseau réel)*
- **VHS-111** 🟡 Contrôle qualité étendu, MergePlan, export. *(contrats + dry-run + stubs merge/AICCOS ; ProductionResult 1.1.0 ; pas d’exécution merge réelle ni UI)*
- **VHS-111B** ✅ Extraire le mapping fal compose `tracks/keyframes` dans un helper partagé, caractériser le comportement historique, route `/api/generate/merge` + adapter `createFalComposeMergeEngine` injectable — **sans** basculer Production Director / `/director`.
- **VHS-111C** ✅ Extraire le pipeline AICCOS (fetch → import signé → PUT → complete) hors du Route Handler vers un helper/adapter partagé ; `createAiccosExportAdapter` injectable — **sans** publication réelle dans les tests ni branchement PD.
- **VHS-112** 🟡 Parcours `/director` accessible avec autosave. *(stub : brief Zod + autosave local + flag `DIRECTOR_V2_ENABLED` ; pas de Marketing Director)*
- **VHS-113** ✅ Persistance Supabase V2 additive, ledger parallèle, queue durable (fondations + adapters) — **sans** apply distant, worker ni génération payante. *(voir `SUPABASE_V2_MIGRATION_PLAN.md`)*
- **VHS-114** ✅ Worker de production borné (`runOnce`) + double kill switch + délégation PD (`planEnqueueCommands` / `processClaimedJob`) + RPC locale `reschedule_production_job` — **sans** endpoint/cron, apply distant ni activation provider.
- **VHS-115** ✅ Validation locale réelle migrations Supabase — reset ×2, 82 SQL + 15 integration (concurrence réelle), types générés `--local`, GRANT service_role corrigé ; **aucune** opération distante. *(voir `studio/supabase/README.md`)*
- **VHS-116** ✅ Persistance brief `/director` — création atomique projet + `video_project_brief` rev 1 + reprise `/director/[projectId]` ; flag `DIRECTOR_V2_PERSISTENCE_ENABLED` (off) ; **aucun** Directeur / provider / apply distant.
- **VHS-117A** ✅ Adaptateur OpenAI `MarketingAnalyzerPort` — Responses API + Structured Outputs + flags off ; **aucun** branchement `/director`, route, persistance ni appel réel en tests.
- **VHS-117B** ✅ Marketing dans `/director` — dry-run UI + `director_runs` + budget scoped + persist `marketing_plan` ; execute testé avec fake ; flags AI off ; **aucun** appel OpenAI réel ni apply distant.
- **VHS-117C** ⚠️ Smoke Marketing OpenAI local contrôlé — runner + 1 appel réel ; provider `rate_limited` ; budget released ; **aucun** second appel ; conclusion échouée (nouvelle autorisation requise pour rejouer).
- **VHS-117D** ✅ Taxonomie erreurs OpenAI Marketing — `rate_limited` préservé jusqu’API/UI ; Director `provider_failed` ≠ `invalid_candidate` ; mapping HTTP + Retry-After borné ; tests fakes ; **aucun** appel réseau ni smoke.
- **VHS-118A** ✅ Adaptateur OpenAI `CreativeAnalyzerPort` — Responses + Structured Outputs + flags off ; taxonomie VHS-117D ; **aucun** branchement `/director`, route, persistance ni appel réel.
- **VHS-118B** ✅ Creative dans `/director` — dry-run UI + `director_runs` creative + budget scoped + persist `creative_concept` ; execute testé avec fake ; flags AI off ; **aucun** appel OpenAI réel ni apply distant.
- **VHS-119A** ✅ Adaptateur OpenAI `ScriptAnalyzerPort` — Responses + Structured Outputs + flags off ; conservation Marketing/Creative, timing VHS-103 déterministe ; **aucun** branchement `/director`, route, persistance, migration ou appel réel.
- **VHS-119B** ✅ Script dans `/director` — dry-run UI + `director_runs` script + budget scoped + persist `video_script` ; timing VHS-103 ; execute testé avec fake ; flags AI off ; **aucun** appel OpenAI réel ni apply distant.
- **VHS-120A** ✅ Adaptateur OpenAI `ArtAnalyzerPort` — `infrastructure/ai/openai/art/` ; tests fakes ; flags off.
- **VHS-120B** ✅ Art persistant `/director` — migration `vhs_120b`, RPC, API `…/art`, UI `ArtSection` ; checkpoint local complet vert (pgTAP + intégration DB + unitaires + build).
- **VHS-121A** ✅ Adaptateur OpenAI `StoryboardAnalyzerPort` — `infrastructure/ai/openai/storyboard/` ; tests fakes ; flags off.
- **VHS-121B** ✅ Storyboard persistant `/director` — migration `vhs_121b`, projection `storyboard_scenes`, API/UI ; page historique inchangée ; checkpoint local complet vert.
- **VHS-122** ✅ Prompt Director persistant déterministe — `scene_package_set` atomique, RPC, `BuildScenePackagesForProject`, API `…/prompts`, UI `PromptSection` ; **aucun** adapter IA ni budget ; checkpoint local complet vert (pgTAP 176, integration 26, unitaires 672).

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
