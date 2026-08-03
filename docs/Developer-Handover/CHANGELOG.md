# Changelog

Format inspiré de Keep a Changelog ; versions selon SemVer documentaire.

## [2.0.36] — 2026-08-03

### Added

- **VHS-122** : Prompt Director persistant déterministe — migration `20260803160000_vhs_122_prompt_director_runs.sql` ; artifact canonique `scene_package_set` (lot atomique) ; RPC `begin_or_get_prompt_director_run` / `persist_scene_package_set` ; service `BuildScenePackagesForProject` ; API `GET|POST …/prompts` ; UI `PromptSection`.
- Aucun adaptateur IA : reconstruction domaine + analyzer déterministe vide ; `providerCalled: false` ; zéro réservation budget.
- Idempotence `prm:…` ; gate `expectedStoryboardRevision` ; couverture 1:1 scènes.

### Validation

- Checkpoint Phase 2 : `db reset` vert (12 mig.) ; pgTAP **176/176** ; intégration DB **26/26** ; unitaires **672/672** ; typecheck / lint (0 erreur) / build verts.
- Page `app/storyboard/page.tsx` inchangée ; **0** OpenAI / provider / distant / déploiement.

## [2.0.35] — 2026-08-03

### Fixed

- Checkpoint Phase 1 local validé : UUID pgTAP VHS-121B corrigé, correlation IDs d'intégration VHS-120B/VHS-121B rendus valides, et runner Windows `test:integration:db` rendu autonome pour la configuration Supabase locale avec refus strict des hôtes distants.

### Validation

- `supabase db reset` : vert ; pgTAP **160/160** ; intégration DB **25/25** ; unitaires **670/670** ; typecheck vert ; lint 0 erreur (14 warnings préexistants) ; build vert.
- Aucun appel provider réel, aucune opération Supabase distante, aucun déploiement.

## [2.0.34] — 2026-08-03

### Added

- **VHS-121B** : Storyboard persistant dans `/director` — migration `20260803150000_vhs_121b_storyboard_director_runs.sql` ; RPC `begin_or_get_storyboard_director_run` / `persist_storyboard_project` (+ projection `storyboard_scenes`) ; service `AnalyzeStoryboardForProject` ; API `GET|POST …/storyboard` ; UI `StoryboardSection`.

### Notes (checkpoint Phase 1)

- Unitaires **670** + typecheck + lint (0 erreur) + build — verts.
- **STOP checkpoint SQL/intégration** : Docker non installé sur la machine agent → `npx supabase db reset` / `supabase test db` / `test:integration:db` non exécutables. Relancer dès Docker disponible avant Phase 2.
- Gate : brief + Marketing Plan + Creative Concept + Script + Direction art actifs + readiness.
- Idempotence : clé `stb:…` ; gate optimiste `expectedVisualDirectionRevision`.
- Page historique `app/storyboard/page.tsx` **inchangée**.

### Notes

- Aucun appel OpenAI réel ; flags AI off par défaut ; aucune opération Supabase distante.

## [2.0.33] — 2026-08-03

### Added

- **VHS-121A** : adaptateur OpenAI `StoryboardAnalyzerPort` — Responses API + Structured Outputs `storyboard-analysis-candidate-v1`, prompt `storyboard-analyzer-v1`, mapping délimité incluant `visualDirection`, dry-run sans réseau.
- Flags : `DIRECTOR_V2_STORYBOARD_AI_ENABLED` + `canExecuteStoryboardAi` ; config `OPENAI_STORYBOARD_*`.
- StoryboardDirector : `provider_failed` pour erreurs provider (taxonomie VHS-117D).

### Notes

- Le domaine Storyboard reste seul autorité de timing ; aucun appel OpenAI réel.

## [2.0.32] — 2026-08-03

### Added

- **VHS-120B** : Art persistant dans `/director` — migration `20260803140000_vhs_120b_art_director_runs.sql` ; RPC `begin_or_get_art_director_run` / `persist_visual_direction` ; service `AnalyzeArtForProject` ; API `GET|POST …/art` ; UI `ArtSection`.
- Gate : brief + Marketing Plan + Creative Concept + Script actifs + readiness.
- Idempotence : clé `art:…` ; gate optimiste `expectedVideoScriptRevision`.

### Notes

- Aucun appel OpenAI réel ; flags AI off par défaut.

## [2.0.31] — 2026-08-03

### Added

- **VHS-120A** : adaptateur OpenAI `ArtAnalyzerPort` — Responses API + Structured Outputs `art-analysis-candidate-v1`, prompt `art-analyzer-v1`, mapping délimité Brief/Marketing/Creative/Script (+ characterCapabilities IDs/labels), dry-run sans réseau.
- Flags : `DIRECTOR_V2_ART_AI_ENABLED` + `canExecuteArtAi` ; config `OPENAI_ART_*` (modèle défaut `gpt-5.6-terra`, effort `low`, ~2800 tokens).
- ArtDirector : `provider_failed` pour erreurs provider (taxonomie VHS-117D).

### Notes

- Aucun appel OpenAI réel ; aucun branchement persistance dans 120A seul.

## [2.0.30] — 2026-08-03

### Added

- **VHS-119B** : Script persistant dans `/director` — migration `20260803130000_vhs_119b_script_director_runs.sql` ; RPC `begin_or_get_script_director_run` / `persist_video_script` ; service `WriteScriptForProject` ; API `GET|POST …/script` ; UI `ScriptSection`.
- Gate : brief + Marketing Plan + Creative Concept actifs + readiness (pas d’approval humaine en schéma).
- Idempotence : clé `scr:…` incluant `SPEECH_TIMING_ENGINE_VERSION` ; fingerprint SHA-256 des révisions sources.
- Timing : moteur VHS-103 seule autorité ; durée cible / calculée / tolérance exposées en view model.

### Notes

- Checkpoint final lot : `db reset` (9 migrations) + `test db` (**137**) + integration DB (**23**) + unitaires (**648**) + typecheck/lint/build — verts.
- Aucun appel OpenAI réel ; aucun smoke ; aucune opération Supabase distante ; flags AI toujours off.

## [2.0.29] — 2026-08-03

### Added

- **VHS-119A** : adaptateur OpenAI `ScriptAnalyzerPort` — Responses API + Structured Outputs `script-analysis-candidate-v1`, prompt `script-analyzer-v1`, mapping délimité Brief/Marketing/Creative et dry-run sans réseau.
- Flags serveur désactivés par défaut : `DIRECTOR_V2_SCRIPT_AI_ENABLED` + `DIRECTOR_V2_PAID_AI_ENABLED`; config Script dédiée (modèle, effort, tokens).

### Notes

- ScriptWriter préserve les erreurs provider en `provider_failed`; le moteur déterministe VHS-103 reste seul autorité de timing.
- Checkpoint : unitaires **643** + typecheck/lint/build — verts ; aucun réseau.
- Aucun branchement `/director`, route, persistance, migration ou appel OpenAI réel.

## [2.0.28] — 2026-08-03

### Added

- **VHS-118B** : Creative persistant dans `/director` — migration `20260803120000_vhs_118b_creative_director_runs.sql` ; RPC `begin_or_get_creative_director_run` / `persist_creative_concept` ; service `AnalyzeCreativeForProject` ; API `GET|POST …/creative` ; UI `CreativeSection`.
- Gate : brief actif + Marketing Plan actif + readiness (pas de champ approval Marketing dans le schéma).
- Idempotence : clé `cre:{projectId}:{briefArtId}:{briefRev}:{mktArtId}:{mktRev}:{model}:{prompt}:{schema}` ; fingerprint SHA-256 des révisions sources.
- Tests : pgTAP `vhs_118b_creative_director.sql` ; intégration `director-creative.integration.test.ts` ; unitaires service.

### Notes

- Checkpoint : `db reset` + `test db` (126) + integration DB (22) + unitaires (637) + typecheck/lint/build — verts.
- Aucun appel OpenAI réel ; aucun smoke ; aucune opération Supabase distante ; flags AI toujours off.

## [2.0.27] — 2026-08-03

### Added

- **VHS-118A** : adaptateur OpenAI `CreativeAnalyzerPort` — Responses API + Structured Outputs `creative-analysis-candidate-v1` ; prompt `creative-analyzer-v1` ; dry-run infra ; flags `DIRECTOR_V2_CREATIVE_AI_ENABLED` (off).
- Config : `OPENAI_CREATIVE_MODEL` (défaut `gpt-5.6-terra`), effort `low`, max tokens défaut 1600.
- Mapping OpenAI partagé remonté en `infrastructure/ai/openai/map-to-analyzer-failure.ts` ; Creative Director gère `provider_failed`.

### Notes

- Aucun branchement `/director` / route / persistance Creative ; aucun appel OpenAI réel ; aucun smoke.
- Suite unitaire : **629** pass.

## [2.0.26] — 2026-08-03

### Fixed

- **VHS-117D** : préservation de la taxonomie provider Marketing — `rate_limited` (et autres échecs OpenAI) ne deviennent plus `invalid_candidate`.
- Frontière : `MarketingAnalyzerError` → Director `provider_failed` ; candidat métier invalide reste `invalid` / `invalid_candidate`.
- HTTP : 429 + `Retry-After` borné ; timeout 504 ; indisponible 503 ; mapping via `mapMarketingFailureToHttp`.
- UI : messages publics sûrs ; dry-run conservé ; aucun retry automatique.

### Notes

- Aucun appel OpenAI réel ; aucun second smoke ; aucune migration.
- Persistance sans migration : seul `error_code` canonique dans `director_runs` (`retryable`/HTTP non stockés).
- Suite unitaire : **615** pass.

## [2.0.25] — 2026-08-03

### Added

- **VHS-117C** : runner smoke Marketing OpenAI local `scripts/smoke-marketing-openai.mjs` (`npm run smoke:marketing-openai`) — confirmation exacte, Supabase local only, compteur 1 appel, plafond 0,10 USD, flags process-local.

### Notes

- Smoke exécuté : **1** appel OpenAI réel via `AnalyzeMarketingForProject` ; réponse provider `rate_limited` ; budget réservé puis **libéré** ; aucun `marketing_plan` ; aucun retry.
- Conclusion : `VHS-117C échoué — aucun second appel autorisé`.
- Écart : mapping `rate_limited` → `invalid_candidate` côté Director — **corrigé en VHS-117D**.

## [2.0.24] — 2026-08-02

### Added

- **VHS-117B** : Marketing sur `/director/[projectId]` — dry-run UI ; table `director_runs` ; budget `scope_type=director_run` ; RPC `begin_or_get_marketing_director_run` / `reserve_director_budget` / `persist_marketing_plan` / `fail_director_run` ; API `GET|POST …/marketing` ; service `AnalyzeMarketingForProject`.
- Migration locale `20260802180600_vhs_117b_director_runs.sql`.
- Tests : SQL **113** ; integration **21** ; unitaires **599**.

### Notes

- Execute réel derrière flags AI (off) ; validations manuelles = dry-run uniquement.
- Aucun appel OpenAI payant ; aucune opération distante.
- Risque documenté : crash après OpenAI avant persist → replay idempotent côté run, pas d’idempotence provider confirmée.

## [2.0.23] — 2026-08-02

### Added

- **VHS-117A** : adaptateur OpenAI pour `MarketingAnalyzerPort` — client Responses injectable (`fetch`, pas de SDK) ; Structured Outputs strict ; prompt `marketing-analyzer-v1` ; schema candidat v1.0.0 ; dry-run ; pricing injecté (aucun prix marché en dur) ; `safety_identifier` HMAC.
- Flags serveur : `DIRECTOR_V2_MARKETING_AI_ENABLED`, `DIRECTOR_V2_PAID_AI_ENABLED` (défaut off ; séparés de `PAID_GENERATION`).
- Config : `OPENAI_MARKETING_MODEL` (défaut `gpt-5.6-terra`), `OPENAI_MARKETING_REASONING_EFFORT`, `OPENAI_MARKETING_MAX_OUTPUT_TOKENS`.

### Notes

- Aucun branchement `/director` / route Marketing / persistance `MarketingPlan`.
- Aucun appel OpenAI réel dans les tests ; aucun SDK `openai` ajouté.
- Suite `npm test` : **593** pass.

## [2.0.22] — 2026-08-02

### Added

- **VHS-116** : persistance brief `/director` — RPC atomique `create_director_project_with_brief` ; services create/get/list ; routes API + pages `/director/[projectId]` ; flag `DIRECTOR_V2_PERSISTENCE_ENABLED` (défaut off) ; seed local workspace (`npm run supabase:seed-workspace`).
- Migration locale `20260802180500_vhs_116_create_project_with_brief.sql`.
- Tests : SQL **100** assertions (dont 18 VHS-116) ; integration **20** ; unitaires **574** ; typecheck / lint (11 warnings préexistants) / build OK.

### Notes

- Autosave reste **local** (pas d’autosave serveur à chaque frappe).
- Aucun Directeur métier, provider, génération, endpoint worker.
- **Aucune** opération distante.

## [2.0.21] — 2026-08-02

### Added

- **VHS-115** : validation locale réelle — `npx supabase db reset` ×2 ; `supabase test db` **82** assertions ; `npm run test:integration:db` **15** tests (repositories + concurrence `Promise.allSettled`) ; types générés `database.types.ts` depuis `--local`.
- Tests SQL : `vhs_115_schema_rls.sql`, `vhs_115_behavior.sql`.
- Gate locale sans fallback distant ; `supabase/.temp/` ignoré (gitignore + eslint).

### Fixed

- **GRANT** manquant sur tables V2 pour `service_role` (erreur 42501) — corrigé dans `20260802180300_vhs_113_v2_rls_grants.sql` (non déployée distante).

### Notes

- CLI `npx supabase` **2.111.0** ; Docker **29.6.2** ; PG major 17 local.
- **Aucune** opération distante.
- Application distante des migrations : **toujours soumise à autorisation écrite séparée**.

## [2.0.20] — 2026-08-02

### Added

- **VHS-115 (préparation)** : inventaire prérequis ; `scripts/check-local-supabase.mjs` ; `npm run test:integration:db` (gate Docker) ; `local-integration.gate.ts`.

## [2.0.19] — 2026-08-02

### Added

- **VHS-114** : worker de production borné `studio/src/application/worker` (`ProductionWorker.runOnce`) ; policy / lease-guard / dispatcher / dry-run ; factory `infrastructure/worker` (pas d’auto-start).
- Production Director : `planEnqueueCommands` + `processClaimedJob` (scheduling/budget/fallback restent dans le PD).
- Feature flags serveur : `DIRECTOR_V2_WORKER_ENABLED`, `DIRECTOR_V2_PAID_GENERATION_ENABLED` (défaut off ; lectures centralisées).
- Migration locale `20260802180400_vhs_114_reschedule_payload.sql` — RPC `reschedule_production_job` (payload mode poll).
- Suite `npm test` à 558 tests.

### Notes

- Worker **désactivé par défaut** ; aucun endpoint HTTP ni cron.
- Garantie documentée : **at-least-once** + idempotence durable — pas exactly-once.
- Migrations V2 / RPC reschedule **non appliquées** distant.
- Aucune activation provider ; `/director` et routes historiques inchangés.

## [2.0.18] — 2026-08-02

### Added

- **VHS-113** : persistance Supabase V2 additive — migrations locales `studio/supabase/migrations/20260802*` (workspaces, artifacts, runs, queue/leases, ledger, idempotence, outbox, assets, audit) ; adapters injectables `studio/src/infrastructure/db` ; ports `application/projects` ; plan `SUPABASE_V2_MIGRATION_PLAN.md`.
- `DIRECTOR_V2_WORKSPACE_ID` documenté dans `.env.example`.
- Suite `npm test` à 536 tests (checks SQL statiques + fakes repositories).

### Notes

- **Aucune** application sur le projet Supabase distant.
- `vh_spend` / `vh_products` / `vh_scenes` inchangés ; ledger V2 en parallèle.
- Aucun worker / génération payante / modification `/director` ou routes historiques.
- CLI Supabase absent de l’environnement agent → `supabase test db` non exécuté (bloquant avant apply distant).

## [2.0.17] — 2026-08-02

### Added

- **VHS-111C** : pipeline AICCOS partagé `studio/src/infrastructure/export/aiccos` (download → import → PUT → complete) ; ports injectables ; mapping HTTP historique ; adapter `createAiccosExportAdapter` ; `mapExportPackageToAiccosRequest` ; dry-run AICCOS optionnel.
- Suite `npm test` à 528 tests.

### Changed

- Route historique `/api/aiccos/send` délègue au pipeline partagé — contrat HTTP, messages et auth inchangés.

### Notes

- Adapter AICCOS V2 **non** branché au Production Director ni à `/director` ; composant `SendToAiccos` inchangé.
- Aucun réseau en tests ; token uniquement dans la fabrique infra.

## [2.0.16] — 2026-08-02

### Added

- **VHS-111B** : helper pur partagé `studio/src/infrastructure/postproduction/fal-compose` (`buildFalComposePayload`, durées historiques, normalisation résultat/erreurs, port `FalComposeClientPort`) ; tests de caractérisation du mapping historique.
- Adapter injectable `createFalComposeMergeEngine` + `mapMergePlanToFalComposeInput` ; dry-run distingue stub / adapter configuré / polling / plan mappable (`providerCalled: false`).
- Suite `npm test` à 516 tests.

### Changed

- Route historique `/api/generate/merge` consomme le helper partagé pour `tracks/keyframes` — contrat HTTP, budget, modèle et submit inchangés.

### Notes

- Adapter V2 **non** branché au Production Director ni à `/director`.
- merge-audio / carousel / AICCOS hors périmètre (VHS-111C pour AICCOS).

## [2.0.15] — 2026-08-02

### Added

- **VHS-111** : Postproduction — domaine `studio/src/domain/postproduction` (qualité finale technique/contractuelle/éditoriale, revue humaine, `MergePlan`, capacités merge déclarées, export package/manifeste) ; application `studio/src/application/postproduction` (`PostProductionDirector`, dry-run, stubs Merge/AICCOS).
- **ProductionResult 1.1.0** : champ additif `delivery` (statuts `not_started`…`delivered`) ; migration pure `1.0.0` → `1.1.0` ; même `artifactType: production_result`.
- Backlog **VHS-111B** (extraction fal compose tracks/keyframes) et **VHS-111C** (extraction pipeline AICCOS).
- Suite `npm test` à 502 tests.

### Notes

- Merge/AICCOS = stubs `merge_adapter_not_configured` / `destination_not_configured` — aucun faux asset, aucun réseau.
- Routes historiques merge/merge-audio/carousel/aiccos **inchangées**.

## [2.0.14] — 2026-08-02

### Added

- **VHS-110** : Production Director — domaine `studio/src/domain/production` (états run/step, tentatives, scheduling, fallbacks du plan, qualité structurée, manifeste `ProductionResult`) ; application `studio/src/application/production` (`start` / `advance` / `requestCancellation`, ports budget/idempotence/qualité/events/run-store, dry-run `providerCalled: false`).
- Fallbacks uniquement ceux du `GenerationPlan` ; budget réservé par tentative ; idempotence PD (engine sans double-begin) ; fakes mémoire **tests uniquement**.
- Suite `npm test` à 486 tests.

### Notes

- Aucune queue durable, Supabase, merge/export, UI, route payante ni store mémoire en runtime prod.
- Reprise après crash non garantie sans store durable.

## [2.0.13] — 2026-08-02

### Added

- **VHS-109** : Generation Engine — domaine `studio/src/domain/generation` (commande, entrées canoniques, résultats, erreurs, idempotence/empreinte, ports) ; application `studio/src/application/generation` (`GenerationEngine`, Adapter Registry, dry-run `providerCalled: false`) ; infrastructure `studio/src/infrastructure/providers` (wrappers fal / OpenAI image / ElevenLabs voice via ports injectables).
- Cancel/webhook explicitement **unsupported** (absents des helpers existants).
- Suite `npm test` à 466 tests.

### Notes

- Aucun appel réseau réel ; routes historiques et `lib/providers/*` non modifiés.
- Idempotence validée/transmise sans store durable ; pas de Production Director / queue / UI / persistance.

## [2.0.12] — 2026-08-02

### Added

- **VHS-108** : Model Router — domaine `studio/src/domain/routing/router` (`GenerationPlan`, bibliothèque de stratégies provider-agnostic, scoring explicite, estimation `Money`/`CostEstimate`, fallbacks ≤2, explications, validation, moteur pur) et application `studio/src/application/routing/model-router` (`createModelRouter`, dry-run `providerCalled: false`).
- Politique versionnée `routing-policy-v1` (poids normalisés, tie-break lexical, inconnus non inventés).
- Suite `npm test` à 450 tests.

### Notes

- Snapshot legacy partiel : nombreuses scènes `no_eligible_strategy` (dialogue/identité) — attendu ; tests happy-path sur registre synthétique vérifié.
- Aucun appel réseau, aucune exécution, aucune réservation budget, aucune route/UI/persistance.
- Generation Engine / Production Director non démarrés.

## [2.0.11] — 2026-08-02

### Added

- **VHS-107** : Capability Registry versionné — domaine `studio/src/domain/routing/capabilities` (`ProviderDefinition`, `ModelCapabilities`, `CapabilityRegistrySnapshot`, pricing `Money`, éligibilité pure, requirements depuis `ScenePackage`, dry-run `providerCalled: false`) et application `studio/src/application/routing` (adaptateur legacy depuis catalogue `pricing.ts` sans le modifier, builder déterministe).
- Inventaire factuel des modèles/providers réellement référencés ; capacités absentes laissées `unknown` ; aucun score/classement/Router.
- Suite `npm test` à 430 tests.

### Notes

- Snapshot partiel valide depuis le catalogue legacy ; dialogue natif / multi-personnage / régions **non déduits** des labels.
- Aucun appel réseau, aucune route API, aucune modification `/director` ni `pricing.ts` / adapters providers.
- Model Router / Generation Engine non démarrés.

## [2.0.10] — 2026-08-02

### Added

- **VHS-106** : Prompt Director — domaine `studio/src/domain/prompt` (`ScenePackage` par scène, blocs sémantiques provider-agnostic, profils de capacités abstraits, contraintes, références, renderers déterministes `prompt-renderer-v1`, protection injection FR/EN, Zod, finalize) et orchestration `studio/src/application/directors/prompt` (`PromptDirector`, `PromptAnalyzerPort`, dry-run `providerCalled: false`).
- Enveloppe applicative `PromptDirectorOutput` ; candidat analyzer non autoritaire ; reconstruction depuis Storyboard + chaîne amont.
- Suite `npm test` à 390 tests.

### Notes

- Dry-run = readiness chaîne brief→…→Storyboard — **aucun ScenePackage inventé**.
- Aucun adaptateur IA, aucun composer modèle-spécifique, aucune route/API, aucune modification des prompts historiques ni de `/director`, aucune persistance.
- Model Router / Generation Engine non démarrés.

## [2.0.9] — 2026-08-02

### Added

- **VHS-105** : Storyboard Director — domaine `studio/src/domain/storyboard` (`StoryboardProject`, scènes de production, couverture segment→scènes, timing déterministe, continuité projetée, transitions, Zod, finalize) et orchestration `studio/src/application/directors/storyboard` (`StoryboardDirector`, `StoryboardAnalyzerPort`, dry-run `providerCalled: false`).
- Note de coexistence `historical-mapping.ts` : page `app/storyboard/page.tsx` reste le seul moteur UI ; domaine = cible d’extraction ; interdiction `/storyboard-v2`.
- Suite `npm test` à 356 tests.

### Notes

- Dry-run = readiness chaîne brief→…→VisualDirection — **aucun storyboard inventé**.
- Aucun adaptateur IA, aucune route/API, aucune modification de la page Storyboard historique ni de `/director`, aucune persistance.
- Prompt Director / Model Router non démarrés.

## [2.0.8] — 2026-08-02

### Added

- **VHS-104** : Art Director — domaine `studio/src/domain/art` (`VisualDirection`, palette, continuité, direction par segment script, accessibilité couleurs, Zod, finalize) et orchestration `studio/src/application/directors/art` (`ArtDirector`, `ArtAnalyzerPort`, dry-run `providerCalled: false`).
- Snapshot Runtime domaine-safe `CharacterCapabilitiesSnapshot` + adaptateur pur `application/runtime/character-capabilities.ts` (pas d’I/O, pas de chemins).
- Conservation Marketing/Creative/Script ; frontières anti prompt/provider/modèle/découpage technique.
- Suite `npm test` à 309 tests.

### Notes

- Dry-run = readiness brief/plan/concept/script (+ snapshot si personnage) — **aucune VisualDirection inventée**.
- Aucun adaptateur IA, aucune route/API, aucune modification `/director`, aucune persistance, Runtime SDK inchangé.
- Storyboard Director et Prompt Director non démarrés.

## [2.0.7] — 2026-08-02

### Added

- **VHS-103** : Script Writer — domaine `studio/src/domain/script` (`VideoScript`, segments, hook/CTA, moteur de timing déterministe `timing.ts`, Zod, finalize) et orchestration `studio/src/application/directors/script` (`ScriptWriter`, `ScriptAnalyzerPort`, dry-run `providerCalled: false`).
- Profils linguistiques versionnés FR/EN + fallback ; tolérance ±10 % ; rapport de timing toujours recalculé (jamais confié au candidat).
- Conservation MarketingPlan + CreativeConcept ; frontières anti décor/caméra/prompt/provider.
- Suite `npm test` à 256 tests.

### Notes

- Dry-run = readiness brief/plan/concept uniquement — **aucun script inventé**.
- Aucun adaptateur IA, aucune route/API, aucune modification `/director`, aucune persistance.
- `emotion` = intention vocale uniquement.

## [2.0.6] — 2026-08-02

### Added

- **VHS-102** : Creative Director — domaine `studio/src/domain/creative` (`CreativeConcept`, schémas Zod, arc émotionnel, dispositifs, références génériques, conservation du `MarketingPlan`, finalize) et orchestration `studio/src/application/directors/creative` (`CreativeDirector`, `CreativeAnalyzerPort`, dry-run `providerCalled: false`).
- Réutilisation de `DirectorRunContext` marketing ; fake analyzer uniquement dans les tests.
- Helpers `toCreativeConceptViewModel` ; suite `npm test` à 217 tests.

### Notes

- Dry-run vérifie readiness plan+brief — **ne fabrique pas** de `CreativeConcept`.
- Aucun adaptateur IA, aucune route/API, aucune modification `/director`, aucune persistance.
- Frontières : pas de dialogue, découpage, caméra, prompt, provider ni coût de génération.

## [2.0.5] — 2026-08-02

### Added

- **VHS-101** : Marketing Director — domaine `studio/src/domain/marketing` (`MarketingPlan`, schémas Zod, invariants, normalisation, traçabilité, readiness) et orchestration `studio/src/application/directors/marketing` (interface `MarketingDirector`, port `MarketingAnalyzerPort`, dry-run local `providerCalled: false`).
- Objectif marketing aligné sur le vocabulaire brief (`mapBriefObjectiveToMarketing` identité) ; métrique structurée ; preuves / hypothèses / rationale sans brief complet.
- Fake analyzer **uniquement** dans les tests ; aucun adaptateur provider, aucune route API, aucune intégration `/director`.
- Helpers de présentation purs `toMarketingPlanViewModel` (préparation UI future).
- Tests schémas / invariants / dry-run / director / compatibilité ; suite `npm test` à 177 tests.

### Notes

- Dry-run valide la préparation du brief uniquement — **ne fabrique pas** de `MarketingPlan`.
- Mode `execute` exige un port injectable ; **aucune implémentation IA en production** dans cet incrément.
- Pas de persistance Supabase ; bouton « Analyse marketing — prochainement » inchangé.

## [2.0.4] — 2026-08-02

### Added

- **VHS-112 (stub)** : parcours `/director` et `/director/new` derrière le feature flag serveur `DIRECTOR_V2_ENABLED` (désactivé par défaut).
- Domaine brief `studio/src/domain/brief` — `VideoProjectBrief` / brouillon distinct / `finalizeBrief`, schemas Zod, erreurs exploitables.
- Couche application `studio/src/application/director` — autosave local versionné (`virtual-humans:director:v2:brief-draft`), debounce, quarantine des brouillons corrompus.
- Config centralisée `studio/src/infrastructure/config/feature-flags.ts` ; exposition lecture seule via `GET /api/settings` → `features.directorV2` (pas de `NEXT_PUBLIC_*`, pas de toggle Settings).
- Lien nav « Réalisateur IA » uniquement si le flag est actif ; layout `/director` → `notFound()` si désactivé.
- Variable documentée dans `studio/.env.example` : `DIRECTOR_V2_ENABLED=0`.
- Tests flag / brief / draft ; suite `npm test` à 139 tests.

### Notes

- Autosave **local uniquement** (navigateur) ; aucune persistance Supabase ; aucun Directeur métier ; aucune production / provider ; studios historiques inchangés.
- Activation preview locale : `DIRECTOR_V2_ENABLED=1` (ou `true`) dans l’env serveur, redémarrer Next.

## [2.0.3] — 2026-08-02

### Added

- **VHS-004** : fondation domaine `studio/src/domain/project` — machines d’état projet/scène (transitions explicites + préconditions), `Revision<T>` immuables, pointeur `ActiveRevision`, verrouillage optimiste, `Approval` + `checkProductionReadiness`, schemas Zod, taxonomie d’erreurs.
- Tests associés (project-state, scene-state, revision, concurrency, approval, schemas) ; suite `npm test` à 121 tests.

### Notes

- Aucune persistance Supabase ; aucune page `/director` ; `vh_scenes` et storyboard historique inchangés.

## [2.0.2] — 2026-08-02

### Added

- **VHS-006 (partiel)** : fondation domaine `studio/src/domain/cost` — `Money` (`amountMinor`), `CostEstimate`, budget pur (`BudgetPolicy` / `BudgetSnapshot` / `BudgetDecision`), dry-run (`providerCalled: false`), erreurs de domaine, schemas Zod.
- Adapter legacy pur `fromLegacyUsdEstimate` / `toLegacyEstimateResponse` (prépare la migration depuis `pricing.ts` / `/api/estimate` sans bascule production).
- Tests domaine coût (money, estimate, budget, dry-run, legacy) ; suite `npm test` à 92 tests.

### Notes

- Aucune table `cost_ledger` ; `vh_spend` inchangé ; aucune route generate modifiée ; décision Q3 (coexistence ledger / `vh_spend`) toujours ouverte.

## [2.0.1] — 2026-08-02

### Added

- **VHS-003** : fondation domaine `studio/src/domain/shared` (`ArtifactMetadata`, unités `costCents` / `durationMs`).
- **VHS-005 (partiel)** : observabilité serveur `studio/src/infrastructure/observability` — correlation ID (`x-correlation-id`), redaction, logger JSON structuré, helper `startObservedRoute`.
- Intégration limitée sur `GET /api/settings`, `POST /api/estimate`, `POST /api/generate/image`.
- Tests unitaires associés (correlation, redact, logger, http) ; suite `npm test` à 61 tests.

### Changed

- Script `npm test` : glob `src/**/__tests__/**/*.test.ts`.
- Script `npm run typecheck` ajouté.

## [2.0.0] — 2026-08-02

### Added

- Developer Handover Pack complet de 25 documents.
- Contrats, règles, tests, données, déploiement et audit final.
- Objets métier versionnés et chaîne d'approbation.
- Budget guard, idempotence, reprise, observabilité et dry-run.

### Changed

- Architecture figée en pipeline découplé.
- `Production Director` remplace définitivement l'ancien concept `Quality Director` comme orchestration de production et de qualité.
- `AI Video Director` est défini comme expérience `/director`, non comme Directeur métier supplémentaire.
- Prompt Director produit des `ScenePackage`; Model Router produit un `GenerationPlan` ; Production Director l'exécute.

### Removed

- appels directs entre Directeurs ;
- choix utilisateur obligatoire d'un modèle/provider ;
- noms de personnages codés en dur ;
- retry non borné et appels payants sans estimation.

## Politique

Toute modification de contrat ou responsabilité est inscrite ici. Une rupture de pipeline exige une version majeure et une décision explicite d'architecture.
