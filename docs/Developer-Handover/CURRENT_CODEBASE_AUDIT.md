# CURRENT_CODEBASE_AUDIT — Phase 0

**Date :** 2 août 2026  
**Périmètre :** dépôt `virtual-humans` (application `studio/` + packages `characters/` + Supabase projet `ejdbksxaswhdtsudnmvi`)  
**Protocole :** `03_CURRENT_AUDIT.md` + Phase 0 de `06_ROADMAP_V2.md` (VHS-001)  
**Statut :** audit terminé — aucune modification d’architecture applicative pendant cet audit

> Mise à jour lot VHS-118B + VHS-119A + VHS-119B : pipeline persistant étendu jusqu’au `VideoScript` (Brief → Marketing → Creative → Script) sous flags AI off ; timing VHS-103 autoritaire ; **0** OpenAI / smoke / apply distant.
>
> **Reprise Phase 0 (3 août 2026) :** VHS-120A/B et VHS-121A/B **livrés**. Pipeline `/director` persistant couvre Brief → Marketing → Creative → Script → Art → Storyboard. Prompt/Routing = domaine seul.

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
| Generation Engine unifié | ✅ Domaine + adapters (VHS-109) — non branché routes |
| Production Director / jobs / reprise | 🟡 Orchestrateur + ports (VHS-110) — pas de queue/store durable |
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

### VHS-102 — Creative Director (domaine + dry-run) — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Domaine | `studio/src/domain/creative` — `CreativeConcept` v1.0.0, `EmotionalBeat`, `CreativeDevice`, références génériques, conservation marketing via evidence, Zod, `finalizeCreativeConcept` |
| Conservation | Objectif, audience, problème, bénéfice, ton, CTA, messages clés, métrique — traçés, non réécrits |
| Application | `studio/src/application/directors/creative` — `createCreativeDirector(analyzer)`, `runCreativeDryRun`, `DirectorRunContext` partagé |
| Port | `CreativeAnalyzerPort` → candidat non fiable ; **aucune implémentation provider** |
| Dry-run | readiness MarketingPlan + brief ; `providerCalled: false` ; **aucun concept inventé** |
| UI / API / persistance | **Aucune** |
| Validation | `npm test` → **217/217** ; typecheck / lint (11 warnings préexistants) / build OK (+ NFT) |

**Limites :** pas d’adaptateur IA, pas d’UI, pas de persistance.

### VHS-103 — Script Writer (narration + timing) — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Domaine | `studio/src/domain/script` — `VideoScript` v1.0.0, segments, hook/CTA, `ScriptTimingReport`, Zod, `finalizeVideoScript` |
| Timing | `timing.ts` — profils `speech-fr-v1` / `speech-en-v1` / `speech-fallback-v1` ; segment = `max(oral, écran) + pause` ; tolérance **±10 %** ; recalcul obligatoire |
| Conservation | Objectif/audience/bénéfice/ton/CTA/messages + grande idée/arc/approche/rythme via evidence |
| Application | `studio/src/application/directors/script` — `createScriptWriter`, `runScriptDryRun`, `DirectorRunContext` partagé |
| Port | `ScriptAnalyzerPort` — candidat non fiable ; **aucune implémentation provider** |
| Dry-run | readiness brief+plan+concept ; `providerCalled: false` ; **aucun script** |
| UI / API / persistance | **Aucune** |
| Validation | `npm test` → **256/256** ; typecheck / lint (11 warnings) / build OK (+ NFT) |

**Limites :** pas d’adaptateur IA, pas d’UI, pas d’Art Director, pas de persistance.

### VHS-104 — Art Director (direction visuelle + Runtime snapshot) — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Domaine | `studio/src/domain/art` — `VisualDirection` v1.0.0, palette, continuité, `SegmentVisualDirection` lié à `scriptSegmentId`, accessibilité couleurs, Zod, `finalizeVisualDirection` |
| Alignement script | Exactement une direction par segment du `VideoScript` ; ordre conservé ; pas de découpage en plans |
| Runtime | Snapshot canonique `CharacterCapabilitiesSnapshot` (domaine) ; builder pur `buildCharacterCapabilitiesSnapshot` dans `application/runtime/` — **aucun** chemin/URL/binaire ; **aucun** appel SDK depuis le domaine |
| Continuité | `ContinuityRule` structurées ; required non contradictoires ; tenue/lieu stables vérifiés |
| Application | `studio/src/application/directors/art` — `createArtDirector`, `ArtAnalyzerPort`, dry-run `providerCalled: false` |
| Frontières | Art = style/lieu/caméra/lumière/assets/composition/continuité ; **pas** storyboard, prompts, modèles, coûts |
| UI / API / persistance | **Aucune** — `/director` inchangé ; Runtime SDK non modifié |
| Validation | `npm test` → **309/309** ; typecheck / lint (11 warnings préexistants) / build OK (+ NFT) |

**Limites :** pas d’adaptateur IA, pas d’UI, pas de Storyboard/Prompt Director, pas de persistance.

### VHS-105 — Storyboard Director (contrat de tournage) — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Domaine | `studio/src/domain/storyboard` — `StoryboardProject` v1.0.0, `StoryboardScene`, timing déterministe 0,01 s, couverture segment→scènes, continuité projetée, transitions narratives, Zod, `finalizeStoryboardProject` |
| Segment vs scène | Segment narratif (script) → 1..N scènes de production ; ordre des segments conservé ; reconstruction parlée exacte |
| Timing | Candidat non autoritaire ; somme exacte = durée cible ; transitions = métadonnées (non additionnées) ; plages 15/20/30/60 → warnings soft |
| Application | `studio/src/application/directors/storyboard` — `createStoryboardDirector`, `StoryboardAnalyzerPort`, dry-run `providerCalled: false` |
| Frontières | Découpage / durées / intent / transitions / refs — **pas** prompts, modèles, coûts, merge, Prompt Director |
| Storyboard historique | `app/storyboard/page.tsx` **inchangé** — seul moteur UI ; domaine = cible d’extraction ; pas de `/storyboard-v2` ; mapping documenté dans `historical-mapping.ts` |
| UI / API / persistance | **Aucune** — `/director` inchangé |
| Validation | `npm test` → **356/356** ; typecheck / lint (11 warnings préexistants) / build OK (+ NFT) |

**Limites :** pas d’adaptateur IA, pas de branchement UI, pas de Prompt Director, pas de persistance.

### VHS-106 — Prompt Director (`ScenePackage[]`) — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Domaine | `studio/src/domain/prompt` — `ScenePackage` v1.0.0 (`artifactType: scene_package`), blocs sémantiques, contraintes, références, profils abstraits, renderers déterministes `prompt-renderer-v1`, injection-safety, Zod, `finalizeScenePackage` |
| Enveloppe applicative | `PromptDirectorOutput { storyboardRevisionId, packages }` — **un package par scène** ; pas d’artifact métier concurrent |
| Blocs | subject / action / environment / camera / lighting / style / composition / dialogue verbatim / audio / screenText (`post_production` par défaut) / constraints / references |
| Profils | `image.*`, `video.*`, `audio.*`, `motion.carousel` — mapping depuis `productionIntent` ; **aucun** nom provider/modèle/tarif/fallback |
| Rendu | Assemblage déterministe des blocs délimités ; dialogue verbatim ; négatifs ciblés ; reconstructible ; pas d’URLs/secrets/chemins |
| Injection | Données brief/produit/réfs = non fiables ; scan FR/EN ; délimitation au rendu ; erreurs typées **sans** logger le payload hostile |
| Fidélité | Reconstruction depuis brief→…→Storyboard ; candidat non autoritaire ; refus dialogue/assets/refs/durée/intent altérés |
| Application | `studio/src/application/directors/prompt` — `createPromptDirector`, `PromptAnalyzerPort`, dry-run `providerCalled: false` (aucun package produit) |
| Frontières | Packages + variantes abstraites — **pas** Model Router, GenerationPlan, provider, coût, UI, persistance |
| Prompts historiques | `assemble.ts`, `prompt-composer.tsx`, Scene/Storyboard **inchangés** (non déplacés) |
| UI / API / persistance | **Aucune** — `/director` inchangé |
| Validation | `npm test` → **390/390** ; typecheck / lint (11 warnings préexistants) / build OK (+ NFT) |

**Limites :** pas d’adaptateur IA, pas de composers modèle-spécifiques, pas de Model Router, pas de branchement UI, pas de persistance.

### VHS-107 — Capability Registry versionné — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Domaine | `studio/src/domain/routing/capabilities` — `ProviderDefinition`, `ModelCapabilities`, `CapabilityRegistrySnapshot` v1.0.0, pricing `Money`, evidence/scores 0–100, Zod, freeze |
| Inventaire importé | Providers `openai`, `elevenlabs`, `fal` ; modèles : `gpt-image-1`, `eleven_multilingual_v2`, `VIDEO_MODELS` (Veo/Seedance/Kling/Runway/MiniMax), `LIPSYNC_MODELS`, `flux-pulid`, `nano-banana/edit`, carousel ffmpeg |
| Vérifié (structure catalogue/code) | IDs, `mode`→profils abstraits, `audio` native/silent→`nativeAudioOutput`, `seconds[]`, `aspectRatios`, prix USD→cents half-up `source: legacy_catalog` |
| Inconnu (non inventé) | régions réelles, disponibilité live (`status: unknown`), dialogue natif, multi-personnage, scores qualité, identité hors `flux-pulid` / modes structurés |
| Requirements | `deriveCapabilityRequirements(scenePackage, storyboard)` — profils depuis `productionIntent`, pas de sélection modèle |
| Éligibilité | `evaluateEligibility` pur — bloque si info critique inconnue ; warnings sur préférences ; **pas** de ranking |
| Application | `buildRegistryFromLegacyPricing`, `buildCapabilityRegistry`, `buildRegistryFromStudioPricing` ; dry-run `runRegistryDryRun` → `providerCalled: false` |
| Frontières | Registre + filtre — **pas** Model Router, GenerationPlan, scoring final, UI, API, persistance |
| Invariants | `pricing.ts` / adapters providers **inchangés** ; domaine sans React/env/réseau |
| Validation | `npm test` → **430/430** ; typecheck / lint (11 warnings préexistants) / build OK (+ NFT) |

**Limites :** snapshot partiel ; pas de probe disponibilité ; pas de Model Router ni stratégie de production.

### VHS-108 — Model Router (`GenerationPlan`) — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Domaine | `studio/src/domain/routing/router` — `GenerationPlan` v1.0.0, stratégies, scoring, estimation, fallbacks, explications, validation, `routeModelPlan` |
| Stratégies | `direct_video`, `image_to_video`, `talking_head`, `voice_over`, `carousel`, `product_demo`, `tutorial`, `multi_character` — templates sans provider |
| Scoring | Politique `routing-policy-v1` ; poids entiers somme 100 ; inconnu = exclusion dénominateur (ou blocage si hard) ; **aucune note inventée** ; tie-break score→fiabilité→coût→durée→ids lexicaux |
| Estimation | Ligne tarifaire compatible × quantité dérivée ; `CostEstimate` ; coût principal = somme étapes ; exposition fallback séparée |
| Budget | `decideBudget` dur ; `budget_exceeded` sans réservation/dépense |
| Fallbacks | 0–2 / étape ; différents du primaire ; même politique déterministe |
| Application | `createModelRouter`, `runModelRouterDryRun` (`providerCalled: false`, pas d’artifact finalisé) |
| Registre réel partiel | Souvent `no_eligible_strategy` (dialogue/identité inconnus) — **attendu** ; happy-path via registre synthétique de test |
| Frontières | Planifie uniquement — **pas** Generation Engine, Production Director, queue, UI, API, persistance |
| Validation | `npm test` → **450/450** ; typecheck / lint (11 warnings préexistants) / build OK (+ NFT) |

**Limites :** pas d’exécution ; registre legacy insuffisant pour talking_head réel ; pas de merge global routé.

### VHS-109 — Generation Engine et contrats d’adapters — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Domaine | `studio/src/domain/generation` — `GenerationCommand`, entrées canoniques, `GenerationResult`, erreurs, idempotence + empreinte SHA-256, port `IdempotencyStore` (sans impl) |
| Application | `createGenerationEngine`, `ProviderAdapterRegistry`, `resolveCanonicalInput`, dry-run `providerCalled: false` |
| Infrastructure | Wrappers injectables : `createFalAdapter` (submit+poll queue ; identity sync optionnel), `createOpenAIImageAdapter` (sync completed), `createElevenLabsVoiceAdapter` (sync completed ; voice id explicite requis) |
| Supporté | fal submit/poll ; OpenAI/ElevenLabs submit→completed |
| Unsupported (réel) | cancel, webhook, estimate provider, idempotency côté SDK |
| Erreurs | taxonomie V2 + mapping pur ; `unknown` non retryable ; pas de secret/prompt/URL dans `publicMessage` |
| Frontières | Une seule étape ; **ignore** `step.fallbacks` ; pas de choix de modèle ; routes historiques / `lib/providers` **inchangés** |
| Validation | `npm test` → **466/466** ; typecheck / lint (11 warnings préexistants) / build OK (+ NFT) |

**Limites :** pas de store d’idempotence durable ; pas de Production Director / queue / UI / persistance ; pas d’appel réseau en tests.

### VHS-110 — Production Director, orchestration multi-étapes et fallbacks — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Domaine | `studio/src/domain/production` — `ProductionRun` / `ProductionResult`, machine d’états d’étape, scheduling pur, tentatives, `decideFallback`, qualité structurée, manifeste redacted, événements |
| Application | `studio/src/application/production` — `createProductionDirector` (`start` / `advance` / `requestCancellation`), ports run-store / budget / idempotence / qualité / events, dry-run |
| Pipeline | `GenerationPlan` approuvé → Production Director → `GenerationEngine` (une étape/commande) → `ProductionResult` |
| Fallbacks | Uniquement ceux du plan (0–2) ; PD seul autorisé à les déclencher ; pas de retry silencieux du primaire |
| Budget | Réserve → exécute → commit réel ou **provisoire explicite** → release écart ; pas de `vh_spend` |
| Idempotence | PD appelle `begin`/`complete`/`fail` ; engine **sans** `idempotencyStore` (évite double-begin) ; `durable: false` refuse `start` par défaut |
| Qualité | Port ; checks MIME/type/durée/dimensions/source ; `needs_review` jamais accepté silencieusement ; pas de score visuel |
| Annulation / partial | `cancelling` → `cancelled` ; partial si politique + ≥1 scène ok + ≥1 échec/skip/cancel ; pas de merge/export |
| Validation | `npm test` → **486/486** ; typecheck / lint (**11** warnings préexistants) / build OK (+ NFT) |

**Limites :** pas de queue durable, pas de tables Supabase, pas de reprise crash réelle, pas de merge/export, pas d’UI/API, fakes mémoire **tests only**.

### VHS-111 — Contrôle qualité étendu, MergePlan et export — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Domaine | `studio/src/domain/postproduction` — `FinalQualityReport` (technique/contractuel/éditorial), `HumanReviewDecision`, `MergePlan`, capacités déclarées, `ExportPackage` / manifeste redacted |
| Application | `PostProductionDirector` (`prepare` / `merge` / `prepareExport` / `recordHumanReview`), dry-run `providerCalled: false` |
| ProductionResult | **1.1.0** additif : `delivery.status` (`not_started`…`delivered`) ; `status` reste l’exécution scènes ; migration pure `migrateProductionResultToV11` ; pas de nouvel artifact type |
| MergeEngine | Stub `createUnavailableMergeEngine` → `merge_adapter_not_configured` ; capacités futures fal compose déclarées honnêtement (`cut`/`none`, concat, audio embarqué, async poll ; **pas** fade/overlays/LUFS/cancel) |
| Export | `download` (validation locale) ; AICCOS stub `destination_not_configured` — **pas** de duplication du Route Handler |
| Transitions / overlays | Transition ≠ `cut`/`none` → `unsupported_transition` ; texte `post_production` projeté dans le plan mais `exportReady: false` |
| Validation | `npm test` → **502/502** ; typecheck / lint (**11** warnings préexistants) / build OK (+ NFT) |

**Limites :** aucun merge réel, aucune publication AICCOS, pas d’UI/API, pas de queue/Supabase.

### VHS-111B — Helper fal compose partagé et MergeEngine V2 injectable — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Helper pur | `studio/src/infrastructure/postproduction/fal-compose` — `buildFalComposePayload`, `resolveHistoricalComposeDurations`, validation, résultat, erreurs, `FalComposeClientPort` |
| Keyframes historiques | `{ url, timestamp, duration }` en ms ; `durationMs = max(500, round(sec*1000))` ; timestamps cumulés ; piste `audio` si `preserveEmbeddedAudio` |
| Route | `/api/generate/merge` utilise le helper pour le mapping uniquement — `capReached` / `addSpend` / `estimateMerge` / `submitJob` / JSON inchangés |
| Application | `mapMergePlanToFalComposeInput`, `createFalComposeMergeEngine({ client })`, `createFalComposeClientFromLib` (runtime wire) |
| Capacités supportées | concat séquentielle, cut/none, audio embarqué on/off, submit async, poll si `client.poll` |
| Refus explicites | fade/cross_fade/slide/zoom/match_cut, overlays, mix multi-pistes, LUFS, fades audio, cancel, codec/AR/fps imposés, singleAudioMux (merge-audio hors scope) |
| Dry-run | `merge_adapter_absent` vs `merge_adapter_configured` / `polling_available` / `plan_fal_mappable` ; toujours `providerCalled: false` |
| Activation | **non** branché Production Director ; stub reste le défaut |
| Validation | `npm test` → **516/516** ; typecheck / lint (**11** warnings préexistants) / build OK (+ NFT) |

**Limites :** pas d’activation PD ; merge-audio/carousel non extraits ; pas de test HTTP Route Handler (caractérisation pure + adapter fakes) ; TTL expiry via `expiresAtFrom` (hypothèse documentée comme génération).

### VHS-111C — Extraction partagée du pipeline AICCOS — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Infra | `studio/src/infrastructure/export/aiccos` — validation, downloader, import client, uploader, pipeline, http-map, factory |
| Ordre | validate → download → createImport → PUT → completeImport → validate clip |
| Route | `/api/aiccos/send` délègue au pipeline — JSON `{ clip }` / erreurs / codes HTTP historiques inchangés |
| Application | `createAiccosExportAdapter`, `mapExportPackageToAiccosRequest` ; stub `createUnavailableAiccosExportAdapter` inchangé par défaut |
| Secrets | `AICCOS_IMPORT_TOKEN` uniquement dans la fabrique ; jamais dans domaine/erreurs/logs/snapshots |
| Observabilité | événements `aiccos.export.*` via logger VHS-005 (correlation, taille, MIME, codes — pas d’URL/token) |
| Dry-run | `aiccosExport` optionnel (`null` = absent) ; `dryCheckAiccosFinalAsset` ; `providerCalled: false` |
| Activation | **non** branché Production Director / `/director` ; UI `SendToAiccos` inchangée |
| Validation | `npm test` → **528/528** ; typecheck / lint (**11** warnings préexistants) / build OK |

**Limites :** pas d’activation PD ; pas de retry auto ; pas de queue/Supabase ; timeout borné ajouté côté pipeline (110 s) sans changer le contrat HTTP.

### VHS-113 — Persistance Supabase, ledger V2 et queue durable — ✅ 2 août 2026 (dépôt uniquement)

| Élément | Détail |
|---|---|
| Migrations locales | `studio/supabase/migrations/20260802*` — additive ; **ne recrée pas** `vh_*` |
| Distant (lecture) | Migrations déjà appliquées : `20260723203021`, `20260728210808` ; tables `vh_spend`, `vh_products`, `vh_scenes` |
| Tables V2 | workspaces, video_projects, project_artifacts, active_artifact_revisions, artifact_approvals, storyboard_scenes, generation_plans, production_runs, production_jobs, generation_attempts, cost_ledger, budget_reservations, idempotency_records, domain_events, assets, audit_log |
| RPC | claim/heartbeat/complete/fail/release jobs ; reserve/commit/release budget ; idempotency_begin ; set_active_artifact_revision |
| RLS | Activée, **aucune** policy anon — service_role only ; REVOKE PUBLIC sur RPC sensibles |
| Adapters | `infrastructure/db` — Project/Artifact/RunStore/Budget/Idempotency/Events/Queue/Assets ; client injecté ; `DIRECTOR_V2_WORKSPACE_ID` |
| Décisions | single_workspace ; `vh_spend` // `cost_ledger` ; pas d’auth multi-user |
| Apply distant | **Non effectué** (interdit sans autorisation séparée) — plan dans `SUPABASE_V2_MIGRATION_PLAN.md` |
| Validation | `npm test` / typecheck / lint (11 warnings) / build ; **pas** `supabase test db` (CLI absent) |

**Limites :** pas de worker (voir VHS-114) ; pas de branchement PD/UI ; pas de types générés depuis schéma live ; tests SQL locaux non exécutés ici.

### VHS-114 — Worker de production durable et borné — ✅ 2 août 2026 (dépôt uniquement)

| Élément | Détail |
|---|---|
| Application | `studio/src/application/worker/*` — `ProductionWorker.runOnce`, policy, lease-guard, dispatcher, dry-run |
| PD | `planEnqueueCommands` + `processClaimedJob` — scheduling/budget/idempotence/fallback restent dans le PD |
| Infra | `infrastructure/worker` factory (pas d’auto-start) ; `adaptProductionJobQueue` ; RPC `reschedule_production_job` (migration locale `20260802180400`) |
| Flags | `DIRECTOR_V2_WORKER_ENABLED=0`, `DIRECTOR_V2_PAID_GENERATION_ENABLED=0` — serveur only, `feature-flags.ts` |
| Kill switches | worker off → `disabled` / aucun claim ; worker on + paid off → `dry_run` / aucun provider ; les deux on pour exécution réelle |
| Bornes | claimLimit, max jobs/run, max provider calls, max durée ; pas de boucle infinie ni sleep réel long |
| Async | `submitted`/`processing` → `reschedule` (mode `poll`, même attempt/idempotency key) |
| Garantie | **at-least-once** + idempotence durable autant que possible — **pas** exactly-once |
| Heartbeat | lease défaut (90 s) > max run (25 s) → pas de heartbeat concurrent nécessaire (`needsConcurrentHeartbeat=false`) |
| Endpoints / cron | **aucun** ; factory non appelée à l’import |
| Validation | `npm test` → **558/558** ; typecheck / lint (**11** warnings préexistants) / build OK |

**Limites :** migrations V2 + RPC reschedule **non appliquées** distant ; aucun endpoint/cron ; aucune activation provider ; PD `advance()` inline toujours disponible (chemin historique tests) ; atomicité « persist run + complete job » non transactionnelle unique (ordre persist-then-complete + replay `already_done`).

### VHS-115 — Validation locale réelle des migrations Supabase — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Stack | Docker Desktop **29.6.2** + `npx supabase` **2.111.0** + PG major 17 local |
| Reset | 5 migrations `20260802*` depuis base vide — **2 passages** OK |
| Tests SQL | **82** assertions (`vhs_113_smoke` + `vhs_115_schema_rls` + `vhs_115_behavior`) PASS |
| Tests repos | **15** `*.integration.test.ts` — projects, artifacts, runs, queue/leases, budget, idempotence, assets, events, RLS, concurrence `Promise.allSettled` |
| Défaut corrigé | `GRANT` tables manquant pour `service_role` → 42501 ; fixé dans `20260802180300` |
| Types | `database.types.ts` généré depuis `--local` (0 `any`) |
| Baseline | V2 indépendant de `vh_*` — pas de fixture historique |
| Distant | **Aucune** opération (`link` / `db push` / etc.) |
| Secrets | `supabase/.temp/` gitignored ; gate sans fallback distant |
| Validation app | `npm test` 562 ; typecheck ; lint **11** warnings ; build OK |

**Écarts restants :** apply distant (autorisation écrite séparée) ; endpoint/cron worker ; Marketing Adapter IA ; VHS-005 / VHS-006 ; Merge/AICCOS au PD.

### VHS-116 — Persistance brief `/director` + reprise — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Flag | `DIRECTOR_V2_PERSISTENCE_ENABLED` (serveur, défaut off) — exige aussi `DIRECTOR_V2_ENABLED` |
| Workspace | `DIRECTOR_V2_WORKSPACE_ID` uniquement côté serveur ; seed local `npm run supabase:seed-workspace` (localhost + `CONFIRM_SEED_WORKSPACE=1`) |
| Atomicité | RPC `create_director_project_with_brief` — projet + brief rev 1 + active pointer + audit + outbox ; idempotence business-payload ; race `unique_violation` gérée |
| App | `CreateDirectorProject` / `GetDirectorProject` / `ListDirectorProjects` ; API `POST/GET /api/director/projects` ; page `/director/[projectId]` |
| Wizard | persistence on → « Créer le projet » ; draft local conservé jusqu’au succès ; pas d’autosave serveur |
| Hors scope | aucun Directeur actif, provider, génération, worker endpoint, apply distant, studios historiques |

**Limites :** pas d’autosave serveur ; pas d’analyse marketing branchée UI ; pas d’auth utilisateur Supabase (shared password) ; UI tests Playwright non ajoutés (manuel + unit/SQL/integration).

### VHS-117A — Adaptateur OpenAI Marketing Director — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| Port | `MarketingAnalyzerPort` → `OpenAIMarketingAnalyzerAdapter` |
| API | Responses (`POST /v1/responses`) via client `fetch` injectable — **pas** de package `openai` |
| Sortie | Structured Outputs `text.format.json_schema` strict → `MarketingAnalysisCandidate` non fiable |
| Prompt / schema | `marketing-analyzer-v1` / candidat `1.0.0` (Zod → JSON Schema strict) |
| Flags | `DIRECTOR_V2_MARKETING_AI_ENABLED` ∧ `DIRECTOR_V2_PAID_AI_ENABLED` (off) — distincts de `PAID_GENERATION` |
| Modèle | `OPENAI_MARKETING_MODEL` défaut `gpt-5.6-terra` ; effort `low` ; `store: false` |
| Coût | price book injecté / env optionnel ; sinon `unknown` ; jamais de tarif marché en dur dans l’adapter |
| Safety ID | HMAC-SHA256(workspace + `OPENAI_SAFETY_IDENTIFIER_SECRET`) — omis si secret absent |
| Hors scope | `/director`, route Marketing, persistance plan, Creative Director, appels réels en tests |

**Limites :** pas de branchement UI (levé en VHS-117B pour dry-run) ; pas de second appel de réparation ; pricing non fourni par défaut ; `safety_identifier` absent sans secret dédié.

### VHS-117B — Marketing `/director` dry-run + persistance — ✅ 2 août 2026

| Élément | Détail |
|---|---|
| UI | Section « Stratégie marketing » — Vérifier le brief ; execute visible seulement si `executionAvailable` |
| API | `GET/POST /api/director/projects/[projectId]/marketing` (`dry-run` \| `execute`) |
| Service | `AnalyzeMarketingForProject` — logique hors route |
| DB | `director_runs` ; `budget_reservations.scope_type/scope_id` ; RPC marketing persist |
| Budget | Réservation director sans détourner `production_runs` |
| Idempotence | clé `mkt:project:briefId:model:prompt:schema` + fingerprint |
| Flags | AI off → dry-run only ; execute testé avec **fake analyzer** injecté |
| Distant / OpenAI réel | **Aucun** |

**Limites :** bouton execute désactivé en validation manuelle (flags off) ; pas d’idempotence provider OpenAI ; Creative Director toujours off ; crash post-appel / pré-persist documenté.

### VHS-117C — Smoke Marketing OpenAI local (1 appel) — ⚠️ 3 août 2026

| Élément | Détail |
|---|---|
| Runner | `studio/scripts/smoke-marketing-openai.mjs` (`npm run smoke:marketing-openai`) |
| Garde | `MARKETING_AI_SMOKE_CONFIRM=ONE_CALL_MAX_010_USD` + `SUPABASE_LOCAL_INTEGRATION=1` + URL `127.0.0.1`/`localhost` uniquement |
| Compteur | `maximumOpenAICalls=1` — tentative consommée avant I/O ; **aucun** retry |
| Modèle | `gpt-5.6-terra` ; `reasoning.effort=low` ; `max_output_tokens=1200` ; store=false |
| Price book smoke | `smoke-vhs-117c-2026-08-03` — 2,50 / 15,00 USD/MTok (injecté process-local, pas dans l’adapter) |
| Plafond | 0,10 USD ; estimation dry-run observée : **1** cent |
| Chemin | `AnalyzeMarketingForProject.execute` (même stack que `/director`) |
| Appel | **1** — provider `rate_limited` (429) ; compteur → 0 |
| Persistance | `director_runs.status=failed` ; `cost_status=released` ; ledger `reservation`+`release` ; **pas** de `marketing_plan` ; **pas** de `vh_spend` |
| Sécurité | aucun secret / prompt / réponse brute persisté dans le scan local |
| Flags | process-local uniquement ; worker + paid media off |

**Conclusion smoke :** `VHS-117C échoué — aucun second appel autorisé` (quota/rate OpenAI ; pas de second appel autorisé).

**Cause racine (corrigée en VHS-117D) :** `MarketingDirector` catchait toute erreur analyzer en `status: "invalid"` (`analyzer_failed`) ; `AnalyzeMarketingForProject` forçait ensuite `error_code=invalid_candidate` + HTTP 422.

### VHS-117D — Taxonomie erreurs OpenAI Marketing — ✅ 3 août 2026

| Élément | Détail |
|---|---|
| Contrat | `MarketingAnalysisFailure` + `MarketingAnalyzerError` (`application/directors/marketing/failures.ts`) |
| Frontière | Director → `provider_failed` (pas OpenAI) ; domaine `invalid` inchangé pour candidat métier |
| Mapping OpenAI | `mapOpenAIAiErrorToMarketingFailure` — `rate_limited` préservé ; 401/403 séparés ; `empty_output`→`empty_response` |
| HTTP | `mapMarketingFailureToHttp` — 429/504/503/502/422/402/409/500 ; `Retry-After` numérique borné ≤3600 |
| Persistance (sans migration) | `director_runs.error_code` = code canonique (`rate_limited`, …) ; **pas** de colonnes retryable/httpStatus |
| UI | messages publics sans « OpenAI » / modèle / HTTP ; dry-run conservé ; pas de retry auto |
| Observabilité | `marketing.ai.request.failed` + `director.marketing.run.failed` avec `failureCode` / `retryable` |
| Réseau | **aucun** appel OpenAI ; **aucun** smoke relancé ; tests fakes uniquement |

**Limites :** `retryable` / `provider_http_status` / `internal_code` non persistés (schéma actuel) ; codes service-local (`marketing_ai_disabled`, …) hors taxonomie canonique mais HTTP préservé ; pas d’audit DB `director.marketing.failed`.

### VHS-118A — Adaptateur OpenAI Creative Director — ✅ 3 août 2026

| Élément | Détail |
|---|---|
| Port | `CreativeAnalyzerPort` → `OpenAICreativeAnalyzerAdapter` |
| Mutualisé | client Responses, `mapOpenAIAiErrorTo*`, Structured Outputs, injection scanner, pricing injecté, flags paid AI |
| Propre Creative | prompt `creative-analyzer-v1`, schema `creative-analysis-candidate-v1` 1.0.0, mapper brief+MarketingPlan |
| Flags | `DIRECTOR_V2_CREATIVE_AI_ENABLED` ∧ `DIRECTOR_V2_PAID_AI_ENABLED` (off) |
| Modèle | `OPENAI_CREATIVE_MODEL` défaut `gpt-5.6-terra` ; effort `low` ; max tokens défaut **1600** ; `store: false` |
| Erreurs | même taxonomie VHS-117D ; Director → `provider_failed` (pas `invalid_candidate`) |
| Dry-run | `runOpenAICreativeDryRun` → toujours `providerCalled: false` |
| Hors scope | `/director`, route Creative, persistance, ledger, smoke réel, Script Writer |

**Limites :** pas de branchement UI ; pas de réservation budget Creative ; price book Marketing env réutilisé si modèle identique ; délimiteurs tronqués à 2000 car/bloc (helper injection existant).

### VHS-118B — Creative persistant dans `/director` — ✅ 3 août 2026

| Élément | Détail |
|---|---|
| Migration | `20260803120000_vhs_118b_creative_director_runs.sql` |
| RPC | `begin_or_get_creative_director_run`, `persist_creative_concept` (+ `reserve_director_budget` / `fail_director_run`) |
| Service | `AnalyzeCreativeForProject` (`dryRun` / `execute`) |
| API | `GET\|POST /api/director/projects/[projectId]/creative` |
| UI | `CreativeSection` après Marketing ; confirmation avant appel payant ; anti double-clic |
| Gate | brief actif + Marketing Plan actif + readiness (pas d’approval Marketing en schéma) |
| Idempotence | `cre:…` + fingerprint SHA-256 incluant révisions brief/marketing |
| Budget | estimate → reserve → provider → persist → commit ; release intégral via `fail_director_run` |
| Checkpoint | reset OK ; SQL 126 ; integration 22 ; unitaires 637 ; typecheck/lint/build OK |
| Réseau | **0** OpenAI ; **0** smoke ; **0** distant ; flags off |

**Conflit prompt ↔ dépôt :** le prompt parle d’« MarketingPlan approuvé » ; le domaine n’a pas de champ approval — la gate est l’artifact actif + readiness.

**Limites :** exécution payante indisponible tant que flags off ; price book env Marketing réutilisé ; pas d’éditeur Creative ; Script Writer non branché.

### VHS-119A — Adaptateur OpenAI Script Writer — ✅ 3 août 2026

| Élément | Détail |
|---|---|
| Port | `ScriptAnalyzerPort` → `OpenAIScriptAnalyzerAdapter` |
| Schema | `script-analysis-candidate-v1` 1.0.0 |
| Prompt | `script-analyzer-v1` + délimiteurs `[DATA:BRIEF|MARKETING_PLAN|CREATIVE_CONCEPT]` |
| Flags | `DIRECTOR_V2_SCRIPT_AI_ENABLED` ∧ `DIRECTOR_V2_PAID_AI_ENABLED` (off) |
| Config | `OPENAI_SCRIPT_MODEL` défaut `gpt-5.6-terra` ; effort `low` ; max tokens **2400** |
| Timing | VHS-103 / `SPEECH_TIMING_ENGINE_VERSION` seule autorité ; timing candidat non autoritaire ignoré |
| Erreurs | taxonomie VHS-117D ; ScriptWriter → `provider_failed` |
| Dry-run | `runOpenAIScriptDryRun` → `providerCalled: false` |
| Checkpoint | unitaires **643** ; typecheck/lint/build OK |
| Hors scope | `/director`, route Script, persistance, migration, smoke |

**Limites :** pas de branchement UI ; pas de ledger Script ; price book Marketing env réutilisé.

### VHS-119B — Script persistant dans `/director` — ✅ 3 août 2026

| Élément | Détail |
|---|---|
| Migration | `20260803130000_vhs_119b_script_director_runs.sql` |
| RPC | `begin_or_get_script_director_run`, `persist_video_script` (+ reserve/fail partagés) |
| Service | `WriteScriptForProject` (`dryRun` / `execute`) |
| API | `GET\|POST /api/director/projects/[projectId]/script` |
| UI | `ScriptSection` après Creative ; confirmation payante ; anti double-clic |
| Gate | brief + marketing_plan + creative_concept actifs + readiness (pas d’approval en schéma) |
| Idempotence | `scr:…` + fingerprint incluant `SPEECH_TIMING_ENGINE_VERSION` |
| Timing | VHS-103 autoritaire ; view model durée cible / calculée / tolérance / warnings |
| Checkpoint | reset OK (9 mig.) ; SQL **137** ; integration **23** ; unitaires **648** ; typecheck/lint/build OK |
| Réseau | **0** OpenAI ; **0** smoke ; **0** distant ; flags off |

**Conflit prompt ↔ dépôt :** « approuvé » = artifact actif + readiness, pas de champ approval.

**Limites :** exécution payante off par défaut ; pas d’éditeur Script complet ; Art/Storyboard non branchés.

### Reprise Phase 0 — matrice pipeline (3 août 2026)

| Composant | Domaine | Adapter | Persistance | API | UI | Tests | État |
|---|---:|---:|---:|---:|---:|---:|---|
| Brief | ✅ | n/a | ✅ VHS-116 | ✅ | ✅ | ✅ | Complet local |
| Marketing | ✅ | ✅ OpenAI | ✅ VHS-117B | ✅ | ✅ | ✅ | Complet local (AI off) |
| Creative | ✅ | ✅ OpenAI | ✅ VHS-118B | ✅ | ✅ | ✅ | Complet local (AI off) |
| Script | ✅ | ✅ OpenAI | ✅ VHS-119B | ✅ | ✅ | ✅ | Complet local (AI off) |
| Art | ✅ | ✅ OpenAI | ✅ VHS-120B | ✅ | ✅ | ✅ | Complet local (AI off) |
| Storyboard | ✅ | ✅ OpenAI | ✅ VHS-121B | ✅ | ✅ | ✅ | Complet local (AI off) |
| Prompt | ✅ | n/a déterministe | ✅ VHS-122 `scene_package_set` | ✅ | ✅ | ✅ | Complet local — sans provider |
| Routing | ✅ | registry legacy | ❌ (table projection) | ❌ | ❌ | domaine/app | Domaine seul |
| Production | ✅ | engine/adapters | ✅ queue/ledger | ❌ | ❌ | app/SQL | Non branché `/director` |
| Postproduction | ✅ | fal/AICCOS | ❌ | ❌ | ❌ | app | Stub PD ; historique merge OK |

**Flags inventoriés (tous off par défaut) :** `DIRECTOR_V2_ENABLED`, `DIRECTOR_V2_WORKER_ENABLED`, `DIRECTOR_V2_PAID_GENERATION_ENABLED`, `DIRECTOR_V2_PERSISTENCE_ENABLED`, `DIRECTOR_V2_MARKETING_AI_ENABLED`, `DIRECTOR_V2_CREATIVE_AI_ENABLED`, `DIRECTOR_V2_SCRIPT_AI_ENABLED`, `DIRECTOR_V2_ART_AI_ENABLED`, `DIRECTOR_V2_STORYBOARD_AI_ENABLED`, `DIRECTOR_V2_PAID_AI_ENABLED`.

**Routes `/api/director` :** `projects` GET/POST ; `projects/[id]` GET ; `…/marketing|creative|script|art|storyboard|prompts` GET/POST. Absents : routing, approvals, production, worker.

**Migrations locales (12) :** … + `vhs_120b` + `vhs_121b` + `vhs_122`. `director_type` ∈ {marketing, creative, script, art, storyboard, prompt}.

**VHS-122 :** livré et validé localement (Phase 2) — pgTAP **176**, integration **26**, unitaires **672**. Prochain : Routing / GenerationPlan persistant.  
**Ne pas** appliquer les migrations distantes sans autorisation écrite.  
**Ne pas** activer worker + paid generation sans store durable et plafond V2.  
**Ne pas** publier AICCOS depuis le PD sans critères d’activation.  
**Ne pas** implémenter auth fail-closed (VHS-002) sans réponse à Q1.  
**Ne pas** créer un second moteur Storyboard UI.  
**Ne pas** déclencher de fallback depuis le Generation Engine.  
**Ne pas** relancer le smoke Marketing sans nouvelle autorisation (1 appel / ≤0,10 USD).  
**Ne pas** activer `DIRECTOR_V2_*_AI_ENABLED` en permanence.
