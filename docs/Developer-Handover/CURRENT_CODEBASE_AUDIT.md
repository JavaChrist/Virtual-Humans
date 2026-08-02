# CURRENT_CODEBASE_AUDIT — Phase 0

**Date :** 2 août 2026  
**Périmètre :** dépôt `virtual-humans` (application `studio/` + packages `characters/` + Supabase projet `ejdbksxaswhdtsudnmvi`)  
**Protocole :** `03_CURRENT_AUDIT.md` + Phase 0 de `06_ROADMAP_V2.md` (VHS-001)  
**Statut :** audit terminé — aucune modification d’architecture applicative pendant cet audit

> Légende : **[Fait]** = vérifié dans le dépôt / par exécution / via Supabase MCP.  
> **[Hypothèse]** = non confirmé ou dépendant d’un environnement externe.  
> Aucun appel payant provider n’a été effectué.

---

## 1. État réel du dépôt

### 1.1 Stack vérifiée

| Élément | Valeur | Source |
|---|---|---|
| Next.js | 16.2.10 (Turbopack build) | `studio/package.json` + build |
| React / React DOM | 19.2.4 | `studio/package.json` |
| TypeScript | ^5 (strict) | `studio/tsconfig.json` |
| Tailwind | ^4 (`@tailwindcss/postcss`) | `studio/package.json` + `globals.css` |
| Zod | ^4.4.3 | `studio/package.json` |
| Supabase JS | ^2.110.8 | `studio/package.json` |
| fal.ai client | ^1.10.1 | `studio/package.json` |
| Auth app | cookie `vh_auth` + `APP_PASSWORD` optionnel | `proxy.ts`, `auth.ts` |
| Middleware | `src/proxy.ts` (convention Next 16) | **[Fait]** — pas de `middleware.ts` |

### 1.2 Baseline de vérifications (exécutée le 2 août 2026)

| Commande | Résultat |
|---|---|
| `npm test` (cwd `studio/`) | **26/26 pass** (exit 0) |
| `npx tsc --noEmit` | **exit 0** |
| `npm run lint` | **exit 0** — 0 erreur, **11 warnings** `react-hooks/set-state-in-effect` |
| `npm run build` | **exit 0** — 1 warning NFT/tracing Turbopack sur `registry.ts` |

Scripts absents du `package.json` : pas de script `typecheck` dédié (la commande `tsc` fonctionne néanmoins).

### 1.3 Instructions locales

| Fichier | Contenu |
|---|---|
| `studio/AGENTS.md` | Règle Next.js 16 : lire `node_modules/next/dist/docs/` avant de coder ; conventions potentiellement différentes du training. |
| `studio/CLAUDE.md` | Pointe vers `AGENTS.md`. |
| `.cursor/rules/ui-conventions.mdc` | `select` chevron custom ; interdiction `alert`/`confirm`/`prompt` natifs. |
| `docs/Developer-Handover/` | Source de vérité architecture V2 (pack lu intégralement 00→GLOSSARY). |

### 1.4 Personnages sur disque

**[Fait]** Deux packages sous `characters/` :

- `Mei SDK v1.0.0`
- `Tom SDK v1.0.0`

Chargés via Runtime SDK (`studio/src/runtime/character/*`). Tests d’intégration confirment résolution distincte et absence de collision d’ids.

**[Fait]** Défaut env : `CHARACTER_DIR_NAME ?? "Mei SDK v1.0.0"` dans `sdk.ts` — fallback dossier, pas une branche métier Tom/Mei.

### 1.5 Absences structurelles V2

**[Fait]** Les dossiers cibles suivants **n’existent pas** :

- `studio/src/domain/`
- `studio/src/application/`
- `studio/src/infrastructure/` (providers sont dans `lib/providers/`)
- `studio/src/app/director/`

**[Fait]** Aucune occurrence dans le code de : `MarketingDirector`, `ProductionDirector`, `GenerationPlan`, `ScenePackage`, `idempoten*`, `dryRun` / `dry-run`, `correlationId`, `schemaVersion`.

---

## 2. Cartographie du code

### 2.1 Pages / écrans (14)

| Route | Fichier | Rôle | Complexité |
|---|---|---|---|
| `/` | `app/page.tsx` | Dashboard | Faible |
| `/characters` | `app/characters/page.tsx` | Liste + diagnostic runtime | Moyenne |
| `/characters/[id]` | `app/characters/[id]/page.tsx` | Détail package | Élevée |
| `/image` | `app/image/page.tsx` | Studio Image | Moyenne |
| `/voice` | `app/voice/page.tsx` | Studio Voix | Moyenne |
| `/video` | `app/video/page.tsx` | Studio Vidéo | Élevée |
| `/lipsync` | `app/lipsync/page.tsx` | Studio Lip-sync | Élevée |
| `/scene` | `app/scene/page.tsx` (~652 l) | Studio Scène | Très élevée |
| `/storyboard` | `app/storyboard/page.tsx` (**~2053 l**) | Storyboard multi-plans | **Critique** |
| `/products` | `app/products/page.tsx` | CRUD produits | Élevée |
| `/budget` | `app/budget/page.tsx` | Dépenses | Faible |
| `/settings` | `app/settings/page.tsx` | Clés / sécurité | Faible |
| `/login` | `app/login/page.tsx` | Auth mot de passe | Faible |
| `/offline` | `app/offline/page.tsx` | PWA offline | Minimale |

Layout : `CharacterProvider` → `ConfirmProvider` → `Nav` + `main` + `PwaRegister`.

### 2.2 Routes API (27)

**Auth / config :** `login`, `settings`, `budget`, `estimate`  
**SDK lecture :** `characters`, `character`, `v1/characters`, `v1/characters/[id]`, `assets`, `asset`, `outfits`, `template`  
**Génération payante :** `generate/image`, `voice`, `video`, `lipsync`, `status`, `scene-image`, `duo-frame`, `merge`, `merge-audio`, `carousel`  
**Données :** `products`, `product-screen`, `scenes`  
**Utilitaires :** `video-models`, `aiccos/send`

Protection : globale via `proxy.ts` **uniquement si** `APP_PASSWORD` est défini. Les handlers generate appellent `capReached()` puis `addSpend()` après succès.

### 2.3 Librairies (`studio/src/lib/`)

| Module | Responsabilité | Décision V2 |
|---|---|---|
| `sdk.ts` | Lecture disque packages / assets | **reuse** (garde path-traversal) |
| `runtime/character/*` | Validation Zod + registry | **reuse** (noyau Character) |
| `auth.ts` / `proxy.ts` | Auth cookie SHA-256 | **wrap** (renforcer prod) |
| `budget.ts` | Journal `vh_spend` + plafond | **refactor** → ledger V2 |
| `pricing.ts` | Tarifs + catalogues modèles | **wrap** → Capability Registry |
| `providers/fal.ts` | Queue fal + upload | **wrap** → Generation Engine adapter |
| `providers/openai-image.ts` | gpt-image-1 | **wrap** → adapter |
| `providers/elevenlabs-voice.ts` | TTS | **wrap** → adapter |
| `assemble.ts` | Templates EN/FR + variables | **reuse** côté Prompt |
| `products.ts` / `scenes.ts` | CRUD Supabase | **reuse** courts termes ; **replace** long terme |
| `character-context.tsx` | Personnage actif (localStorage) | **reuse** |
| `media-store.ts` / `reflib.ts` / `use-persistent-state.ts` | État client | **reuse** studios ; pas pour `/director` |
| `client.ts` | `apiGet`/`apiPost` | **reuse** |
| `location-presets.ts` | Décors | **reuse** |

### 2.4 Composants

`nav`, `confirm` (`useConfirm`), `page-header`, `prompt-composer`, `pwa-register`, `send-to-aiccos`.

### 2.5 Flux actuel (simplifié)

```text
UI Studio (React, logique métier embarquée)
  → /api/generate/* (route choisit/accepte modelId + prompt)
    → lib/providers/* (OpenAI / ElevenLabs / fal)
    → lib/budget.addSpend (estimation, pas coût réel provider)
  → localStorage (brouillons / médias)
  → Supabase service_role (vh_spend, vh_products, vh_scenes, bucket product-screens)
  → optionnel AICCOS export
```

Pas de queue durable, pas d’idempotence, pas de dry-run, pas de Production Director.

### 2.6 Runtime SDK

- Schemas Zod : `runtime/character/schema.ts`
- Loader Markdown/YAML/JSON : `loader.ts`, `personality.ts`, `markdown.ts`
- Registry cache mtime + unicité `characterId`/`characterCode` : `registry.ts`
- Mapping HTTP 404/409/422 : `http.ts`
- Tests : personality, registry, collision, tom (+ fixtures)

### 2.7 Storyboard / merge / export

- **Un seul moteur storyboard** : `app/storyboard/page.tsx` (~2053 lignes) — UI + orchestration + prompts + styles + casting + génération.
- Merge : `/api/generate/merge` (fal ffmpeg compose), `/api/generate/merge-audio`, `/api/generate/carousel`.
- Export : `SendToAiccos` → `/api/aiccos/send`.
- **[Fait]** Styles « Plateau produit » mentionnent explicitement « Mei » / « Tom » dans des templates UI (couplage présentation, pas branche runtime).

---

## 3. Fonctionnalités déjà présentes

| Capacité | État |
|---|---|
| Studios Image / Voix / Vidéo / Lip-sync / Scène / Storyboard | ✅ Opérationnels |
| Estimation pré-génération (`/api/estimate` + UI) | ✅ Présente (indicative) |
| Plafond `BUDGET_CAP_USD` | ✅ Présent (optionnel) |
| Journal dépenses estimées | ✅ `vh_spend` |
| Produits + captures | ✅ `vh_products` + bucket privé |
| Scènes sauvegardées | ✅ `vh_scenes` |
| Multi-personnages Runtime | ✅ Mei + Tom |
| PWA (manifest, SW, offline) | ✅ |
| Auth mot de passe optionnelle | ✅ |
| Export AICCOS | ✅ |
| Parcours `/director` | 🟡 Stub VHS-112 (flag off par défaut ; brief + autosave local) |
| Directeurs métier | ❌ Absents |
| Model Router / Capability Registry | ❌ Absents |
| Generation Engine unifié | ❌ Absents (providers ad hoc) |
| Production Director / jobs / reprise | ❌ Absents |
| Dry-run / idempotence / correlationId | ❌ Absents |
| Ledger coûts réels + réservation | ❌ Absents |
| Migrations versionnées dans le dépôt | ❌ Absentes (2 migrations appliquées côté Supabase uniquement) |

---

## 4. Éléments réutilisables (matrice)

| Actif | Emplacement | Décision | Justification |
|---|---|---|---|
| Runtime Character | `src/runtime/character/` | **reuse** | Contrats Zod + tests ; base `Character` V2 |
| Lecture assets SDK | `lib/sdk.ts` | **reuse** | Path-safe ; tracing Vercel |
| Providers fal/openai/eleven | `lib/providers/` | **wrap** | Extraire derrière `ProviderAdapter` |
| Catalogue pricing | `lib/pricing.ts` | **wrap** | Noyau Capability Registry |
| Budget cap + spend | `lib/budget.ts` | **refactor** | Vers `cost_ledger` + réservation |
| PromptComposer + assemble | composants / `assemble.ts` | **reuse** puis **refactor** | Templates SDK ; sortir prompts hors UI |
| ConfirmProvider | `components/confirm.tsx` | **reuse** | Convention UI |
| Nav / PWA / auth cookie | divers | **reuse** | Studios avancés à conserver |
| Storyboard page | `app/storyboard/page.tsx` | **refactor** (pas replace) | **Un seul moteur** — extraire domaine sans second moteur |
| Tables `vh_*` | Supabase | **reuse** courts termes | Coexistent avec tables V2 (`video_projects`, …) |

---

## 5. Duplications et dettes techniques

1. **God component storyboard** (~2053 l) : métier + prompts + I/O + UI mélangés.
2. **Prompts codés en dur** dans `scene/page.tsx` et `storyboard/page.tsx` (`Photorealistic…`, styles plateau Mei/Tom).
3. **IDs modèles fal hardcodés** dans l’UI (`fal-ai/kling-video/v2/master/image-to-video`, etc.).
4. **Choix de modèle par l’utilisateur** dans Video / Scene / Storyboard / Lip-sync — contraire à la vision `/director`.
5. **Pas de couche domaine** : logique métier dans pages React et routes API.
6. **Spend = estimation**, pas coût réel provider ; `addSpend` tolère l’échec silencieusement.
7. **Pas de tests** API / E2E / pages (uniquement runtime character).
8. **11 warnings lint** `set-state-in-effect` (pages dashboard, video, scene, storyboard, lipsync, nav, prompt-composer).
9. **Warning build NFT** : tracing large de `characters/**` via `registry.ts`.
10. **Migrations Supabase hors dépôt** : 2 migrations distantes, aucun dossier `supabase/migrations` local.

---

## 6. Sécurité

### 6.1 Faits vérifiés

| Point | Constat |
|---|---|
| Secrets client | **[Fait]** Pas de clé provider en `NEXT_PUBLIC_*` dans le code métier. `supabase.ts` accepte fallback `NEXT_PUBLIC_SUPABASE_URL` pour l’URL seulement (pas la service role). |
| Service role | **[Fait]** Utilisé uniquement côté serveur. |
| Auth | **[Fait]** Désactivée si `APP_PASSWORD` vide → accès ouvert aux routes generate. |
| RLS | **[Fait]** Activé sur `vh_spend`, `vh_products`, `vh_scenes` **sans aucune policy** (advisor Supabase `rls_enabled_no_policy`). Effet : accès anon/authenticated bloqué ; service_role bypass. |
| Bucket | **[Fait]** `product-screens` existe, `public: false`. |
| SW | **[Fait]** N’intercepte pas `/api/*`. |
| Rate limiting | **[Fait]** Absent hors plafond budget. |
| Idempotence | **[Fait]** Absente — double-clic peut double-dépenser. |
| `.env.local` | **[Fait]** Présent localement ; listé dans `.gitignore` (**[Hypothèse]** non commité — non relu pour secrets). |

### 6.2 Risques classés

| ID | Priorité | Risque | Plan |
|---|---|---|---|
| SEC-01 | **P0** | Auth optionnelle en prod → générations facturées si URL exposée | Exiger `APP_PASSWORD` (ou fail-closed) en production ; documenter kill switch |
| SEC-02 | **P0** | Pas d’idempotence sur generate | Clé d’idempotence + journal avant appel provider |
| SEC-03 | **P0** | Pas de dry-run / réservation budgétaire | Estimation + dry-run obligatoires avant exécution (VHS-006) |
| SEC-04 | **P1** | RLS sans policies + modèle service-only | Préparer policies owner-based pour tables V2 ; garder service role workers |
| SEC-05 | **P1** | Pas de rate limit | Limiter `/api/generate/*` par session/IP |
| SEC-06 | **P1** | Logs peuvent contenir prompts / détails | Redaction + correlationId (VHS-005) |
| SEC-07 | **P2** | Migrations non versionnées dans le repo | Introduire `supabase/migrations` + sync |

---

## 7. Supabase — état réel

**Projet :** `ejdbksxaswhdtsudnmvi` (eu-west-3) — **[Fait]** via MCP.

| Table | RLS | Rows (approx.) | Policies |
|---|---|---|---|
| `vh_spend` | on | 56 | **aucune** |
| `vh_products` | on | 2 | **aucune** |
| `vh_scenes` | on | 1 | **aucune** |

**Bucket :** `product-screens` (privé).

**Migrations distantes (2) :**

1. `20260723203021_vh_studio_init_spend_products_storage`
2. `20260728210808_create_vh_scenes`

**Écart V2 (`17_SUPABASE_PROJECTS.md`) :** tables cibles `video_projects`, `project_artifacts`, `production_jobs`, `cost_ledger`, `domain_events`, etc. **absentes**.

---

## 8. Écarts avec l’architecture V2

| Contrat V2 | État actuel | Écart |
|---|---|---|
| Pipeline Directeurs découplés | Absents | Total |
| Objets métier versionnés | Absents | Total |
| `/director` UX | Absent | Total |
| Model Router | UI choisit le modèle | Inversé |
| Prompt Director | Prompts dans React/API | Inversé |
| Production Director unique | Orchestration dans pages + routes | Fragmenté |
| Generation Engine + adapters | Appels directs providers | Partiel (wrap possible) |
| Estimation + dry-run + idempotence | Estimation + cap seulement | Partiel |
| Character via Runtime | ✅ Présent | Mineur (labels Mei/Tom dans templates storyboard) |
| Studios avancés conservés | ✅ Présents | À ne pas casser |
| Un seul moteur storyboard | ✅ Un fichier | Dette de taille, pas de duplication |
| Observabilité corrélée | Absente | Total |
| RLS par propriétaire | Service-role only | Partiel / différent |

---

## 9. Plan de migration recommandé

Principe : **incréments derrière feature flag**, studios historiques intacts, **pas de second moteur storyboard**.

```text
Phase 0  ✅ audit (ce document)
Phase 1  Sécurité/observabilité minimale (auth fail-closed prod, correlation, redaction)
Phase 2  Fondations domaine : schemas Zod partagés + ArtifactMetadata (sans brancher l’UI)
Phase 3  Workflow /director stub (autosave brief) — feature flag
Phase 4–6  Directeurs Marketing→Prompt (pure functions, tests, pas de providers)
Phase 7  Capability Registry + Router (wrap pricing.ts)
Phase 8  Generation Engine adapters (wrap lib/providers)
Phase 9  Production Director + queue/idempotence/dry-run
Phase 10 Merge/export derrière Production Director (réutiliser routes merge)
Phase 11 Tables Supabase V2 additives + RLS owner
Phase 12 E2E / charge / a11y
Phase 13 Pilote
```

**Compatibilité :** les routes `/api/generate/*` et pages studios restent ; le nouveau chemin passe par Production Director. Extraction progressive du storyboard (hooks/domaine) sans remplacer la page.

**Rollback :** feature flag off → UI V1 ; migrations additives uniquement ; pas de drop des tables `vh_*` avant bascule.

---

## 10. Ordre précis des premières tâches

| Ordre | ID | Tâche | Nature |
|---:|---|---|---|
| 1 | VHS-001 | Audit dépôt (ce livrable) | ✅ Fait |
| 2 | VHS-003 | Types/schemas communs + `ArtifactMetadata` (+ tests) | **P0 sûr, non destructif** |
| 3 | VHS-005 (partiel) | `correlationId` + helper logs redacted | Non destructif |
| 4 | VHS-002 (partiel) | Fail-closed auth si `NODE_ENV=production` et pas de `APP_PASSWORD` | Sécurité — **décision ops à confirmer** |
| 5 | VHS-006 (partiel) | Contrat dry-run + estimation unifiée (sans brancher providers) | Prépare production |
| 6 | VHS-004 | États / révisions (domaine pur) | Avant `/director` |
| 7 | VHS-112 stub | Page `/director` + brief Zod + autosave local | Feature flag |
| … | VHS-101+ | Directeurs dans l’ordre pipeline | Voir roadmap |

> La tâche 4 (auth fail-closed) nécessite une **décision ops** (comportement local vs Vercel) → **ne pas implémenter sans confirmation**.

---

## 11. Commandes de validation disponibles

```bash
cd studio
npm install          # deps déjà présentes au moment de l’audit
npm test             # 26 tests runtime character
npx tsc --noEmit     # typecheck
npm run lint         # eslint (warnings acceptés actuellement)
npm run build        # build production Next 16
```

**Non disponibles aujourd’hui :** suite E2E, tests API, script `typecheck` npm, chaos providers, suite RLS locale.

**Interdit pendant l’audit / fondations :** appels réels OpenAI / fal / ElevenLabs.

---

## 12. Questions réellement bloquantes

| # | Question | Bloque |
|---|---|---|
| Q1 | En production Vercel, `APP_PASSWORD` est-il **déjà** défini ? | SEC-01 — comportement fail-closed |
| Q2 | Faut-il un seul locataire (mot de passe partagé) ou une vraie auth multi-utilisateurs dès V2 ? | Schéma RLS / `created_by` |
| Q3 | Budget : conserver USD estimé (`vh_spend`) en parallèle du ledger cents V2, ou migration stricte ? | VHS-006 / Phase 11 |
| Q4 | Feature flag : variable d’env (`DIRECTOR_V2=1`) ou flag UI Settings ? | **Tranché** : `DIRECTOR_V2_ENABLED` serveur (`1`/`true`), pas de Settings UI |
| Q5 | Queue jobs : Vercel background / Supabase + polling / worker externe ? | Phase 9 |

**Aucune de ces questions ne bloque VHS-003** (schemas domaine purs).

---

## 13. Critères de sortie Phase 0 — checklist

- [x] Carte du dépôt
- [x] Diagramme des flux actuels
- [x] Registre des écarts V2
- [x] Plan de migration par incréments
- [x] Baseline tests / lint / typecheck / build
- [x] Risques P0/P1 avec plan
- [x] Décisions à confirmer listées (non confondues avec des faits)
- [x] Point d’intégration identifié par module cible (wrap/reuse/refactor)
- [x] Propriétaire des données persistées actuel identifié (`vh_*` via service role)

**Phase 0 : TERMINÉE.**

---

## 14. Incréments post-audit

### VHS-003 — fondation schemas communs — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Fichiers | `studio/src/domain/shared/{artifact,units,index}.ts` + `__tests__/artifact.test.ts` |
| Scripts | `package.json` : `typecheck` |
| Validation | tests domaine verts ; `npm run typecheck` exit 0 |
| Impact studios | Aucun |

### VHS-005 (partiel) — correlation + logs redacted — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Fichiers | `studio/src/infrastructure/observability/{correlation,redact,logger,http,index}.ts` + 4 fichiers de tests |
| Routes intégrées | `GET /api/settings`, `POST /api/estimate`, `POST /api/generate/image` |
| Comportements | header `x-correlation-id` (accepte / génère / propage) ; logs JSON structurés ; redaction secrets + prompts ; `startObservedRoute` |
| Validation | `npm test` → **61/61 pass** ; `typecheck` / `lint` / `build` exit 0 |
| Lint | **11 warnings** préexistants (`react-hooks/set-state-in-effect`) — aucun nouveau sur les fichiers VHS-005 |
| Hors périmètre | métriques/traces avancées ; intégration des 24 autres routes ; auth (`APP_PASSWORD`) inchangée |

**Reste VHS-005 :** métriques, traces distribuées, généralisation aux autres routes generate.

### VHS-006 (partiel) — contrats coût / estimation / dry-run — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Fichiers | `studio/src/domain/cost/{money,errors,estimate,budget,dry-run,legacy,schemas,index}.ts` + 5 fichiers de tests |
| Contrats | `Money` (`amountMinor`), `CostEstimate`, `BudgetPolicy` / `BudgetSnapshot` / `BudgetDecision`, `DryRunRequest` / `DryRunResult` (`providerCalled: false`) |
| Compatibilité | `legacy.ts` : `fromLegacyUsdEstimate` / `toLegacyEstimateResponse` — **sans** remplacer `pricing.ts`, `budget.ts`, ni `/api/estimate` |
| Persistance | **Aucune** — pas de `cost_ledger`, `vh_spend` **inchangé** |
| Validation | `npm test` → **92/92 pass** ; typecheck / lint / build exit 0 |
| Décision Q3 | **Toujours ouverte** (ledger cents V2 vs coexistence `vh_spend`) |
| Providers | **Aucun** branché au dry-run |

### VHS-004 — révisions, états, verrouillage optimiste — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Fichiers | `studio/src/domain/project/{artifact-types,project-state,scene-state,revision,concurrency,approval,errors,schemas,index}.ts` + 6 fichiers de tests |
| Machines d’état | Projet (`draft→…→completed` + failed/cancelled/archived) ; Scène (`pending→…→completed` + retryable_failed/failed/cancelled/skipped) |
| Révisions | `Revision<T>` immuable, chaîne parent, `ActiveRevision` distincte, freeze JSON |
| Concurrence | `assertExpectedRevision` / `applyOptimisticUpdate` (règles pures, pas de transaction) |
| Approbations | `Approval` liée à une révision ; `checkProductionReadiness` |
| Persistance / UI / API | **Aucune** — `vh_scenes` et storyboard inchangés ; pas de `/director` |
| Validation | `npm test` → **121/121 pass** ; typecheck / lint / build exit 0 |

### VHS-112 (stub) — `/director`, brief V2, autosave local — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Flag | `DIRECTOR_V2_ENABLED` — centralisé dans `infrastructure/config/feature-flags.ts` ; défaut **off** ; seul `1` / `true` (trim, case-insensitive) active |
| Routes | `/director`, `/director/new` — `layout.tsx` appelle `notFound()` si flag off ; nav « Réalisateur IA » via `features.directorV2` depuis `/api/settings` |
| Domaine | `studio/src/domain/brief` — champs métier + `finalizeBrief` ; pas de provider/model/prompt ; `characterId` opaque |
| Application | `studio/src/application/director` — clé `virtual-humans:director:v2:brief-draft`, debounce 400 ms, quarantine |
| UI | Wizard brief multi-étapes ; `PageHeader`, `useConfirm`, `useCharacter` ; classes `.select` / `.btn` existantes |
| Persistance | **Locale uniquement** — pas de Supabase, pas de Directeurs, pas de production |
| Validation | `npm test` → **139/139** ; typecheck / lint (11 warnings préexistants) / build exit 0 (+ warning NFT préexistant) |
| Env exemple | `studio/.env.example` → `DIRECTOR_V2_ENABLED=0` |

### VHS-101 — Marketing Director (domaine + dry-run) — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Domaine | `studio/src/domain/marketing` — `MarketingPlan` v1.0.0, `Audience`, `SuccessMetric`, assumptions/evidence/rationale, Zod, invariants, `finalizeMarketingPlan` |
| Objectif | `MarketingObjective` = `BriefObjective` (mapping identité) |
| Application | `studio/src/application/directors/marketing` — `createMarketingDirector(analyzer)`, `runMarketingDryRun`, résultats discriminés |
| Port | `MarketingAnalyzerPort.analyze` → `MarketingAnalysisCandidate` non fiable ; **aucune implémentation provider** |
| Dry-run | readiness brief uniquement ; `providerCalled: false` ; **aucun plan inventé** |
| UI / API | **Aucune** — `/director` inchangé ; pas de route Marketing |
| Persistance | **Aucune** |
| Validation | `npm test` → **177/177** ; typecheck / lint (11 warnings préexistants) / build exit 0 (+ warning NFT) |

**Limites avant activation réelle :** pas d’adaptateur IA, pas de branchement UI, pas de persistance du plan, pas d’approbation workflow branchée.

**Écarts restants :** adaptateur analyzer (hors prod jusqu’à décision) + branchement `/director` ; Creative Director (VHS-102) ; VHS-113 ; finaliser VHS-005 / VHS-006.

Prochain incrément recommandé : **VHS-102 Creative Director** (domaine + dry-run) **ou** brancher le dry-run Marketing dans `/director` (sans provider) ; sinon finaliser VHS-005 / VHS-006.  
**Ne pas** implémenter auth fail-closed (VHS-002) sans réponse à Q1.  
**Ne pas** migrer Supabase / basculer les routes generate tant que Q3 n’est pas tranchée.
