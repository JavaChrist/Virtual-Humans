# Changelog

Format inspiré de Keep a Changelog ; versions selon SemVer documentaire.

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

