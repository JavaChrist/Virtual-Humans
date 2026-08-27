# 168 — Production UI Parity Preflight

**Date :** 2026-08-27  
**Auth :** `AUTH_VHS_PRODUCTION_UI_PARITY_PREFLIGHT_NO_DEPLOY_NO_FLAG_WRITE`  
**Nature :** diagnostic + preflight de réconciliation **lecture seule** · **0** deploy · **0** flag write · **0** mutation Production  
**HEAD attendu par l’Auth :** `1d28f94` (snapshot `166_` SHA record)  
**HEAD réel :** `2cacf1b` (`167_` SHA record)  
**RideCloud :** `AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_NO_PROVIDER` **non rejouée** · apply **suspendu, non consommé**

```text
VERDICT = VHS_PRODUCTION_UI_PARITY_PREFLIGHT_READY
PHASE_COST = 0¢
DEPLOYS = 0
FLAG_WRITES = 0
VERCEL_MUTATIONS = 0
SUPABASE_MUTATIONS = 0
PROVIDER_CALLS = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
DIRTY_FILES_COMMITTED = 0
DIRTY_FILES_RESTORED = 0
PWA_STRATEGY_CHANGED = false
GIT_SHA_DEPLOYED_PROVEN = false
HARD = 437
COMMITTED = 391
RESERVED = 0
AVAILABLE = 46
NEXT_AUTH = AUTH_VHS_SDK_VERSION_FILE_TRACING_INCLUDE_NO_DEPLOY_NO_FLAG_WRITE
RIDECLOUD_APPLY = SUSPENDED_NOT_CONSUMED
```

---

## 1. Autorisation consommée

`AUTH_VHS_PRODUCTION_UI_PARITY_PREFLIGHT_NO_DEPLOY_NO_FLAG_WRITE` — Christian, chat courant.

Diagnostic uniquement. Aucun deploy. Aucun flag write. Aucune mutation Vercel/Supabase. Aucun provider. Aucun commit des trois fichiers dirty. Aucune restauration / stash / stage de ces fichiers.

La porte RideCloud `AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_APPLY_ONCE_NO_PROVIDER` **n’est pas exécutée**.

`157_`–`167_` restent des snapshots immuables.

## 2. Git

| Champ | Attendu Auth | Réel |
|---|---|---|
| Branche | `main` | `main` |
| HEAD | `1d28f94` | **`2cacf1b`** |
| origin/main | `1d28f94` | **`2cacf1b`** |
| ahead / behind | 0 / 0 | **0 / 0** |

L’Auth a été rédigée sur le HEAD de `166_`. `167_` a été poussé à **14:35:43** (`e93fc98`) puis SHA record à **14:35:54** (`2cacf1b`). Écart **attendu**, pas une corruption Git.

Hors scope protégés (status ` M`, **non touchés**) :

| Fichier | Diff contenu vs HEAD |
|---|---|
| `studio/src/app/page.tsx` | **12 suppressions** (cartes documentaires) |
| `studio/src/app/api/aiccos/send/route.ts` | **0 hunk** visible |
| `studio/src/components/send-to-aiccos.tsx` | **0 hunk** visible |

Les deux fichiers AICCOS restent dirty/protégés. Ils n’ont **pas** de delta de contenu inspectable vs HEAD dans cet audit. **Ne pas** les restaurer ni les stager.

## 3. Dashboard — cartes documentaires

**Cause exacte :** localhost sert le working tree ; Production sert le code **committé**.

Le diff non commité de `studio/src/app/page.tsx` **supprime uniquement** le `<section>` qui mappe `char?.overview.documents` (titre + `d.file` + excerpt). Aucune autre logique, aucun import, aucun appel API n’est retiré.

Preuve committed : `HEAD:studio/src/app/page.tsx` contient encore `overview.documents.map`. Dernier commit de ce fichier : `0ab26e9` (2026-07-22, « Mise en place de Tom »). Les cartes `00_IDENTITY`, `01_APPEARANCE`, `02_PERSONALITY`, `04_VOICE` viennent de `getCharacterOverview()` dans `studio/src/lib/sdk.ts` (`docFiles` figés).

Intention : retirer du dashboard produit les extraits markdown SDK (cartes documentaires). Cohérent avec un dashboard opérateurs (studios + budget), pas avec une lecture de dossier personnage.

Dépendances : **aucune**. Aucun test unitaire ne snapshotte ces cartes. `/api/character` continue de renvoyer `overview.documents` ; seul le rendu dashboard est retiré.

**Porte distincte proposée :** `AUTH_VHS_DASHBOARD_DOC_CARDS_ISOLATE_COMMIT_NO_AICCOS_NO_DEPLOY`

- `git add -- studio/src/app/page.tsx` **uniquement** (pathspec exact)
- ne jamais `git add studio/` ni `.`
- 0 AICCOS, 0 deploy, 0 flag

## 4. Réalisateur IA

**Cause exacte :** le lien n’apparaît que si `GET /api/settings` → `features.directorV2 === true`. Ce booléen est `isDirectorV2Enabled()` = parse strict de **`DIRECTOR_V2_ENABLED`** (`1` ou `true` uniquement). Ce n’est **pas** un `NEXT_PUBLIC_*`.

`studio/src/components/nav.tsx` : `setDirectorV2(Boolean(s.features?.directorV2))` puis insertion de `DIRECTOR_LINK` après le dashboard.

`studio/src/app/director/layout.tsx` : si le flag est off → `notFound()` (404). **Aucun** autre flag n’est requis pour afficher le lien ou ouvrir la route.

Code `/director` **présent dans `main`** : **36** fichiers sous `studio/src/app/director/` à `HEAD` `2cacf1b`, dont `layout.tsx`. Auto-deploy Production après `167_`. Ce n’est **pas** du code absent du build.

| Couche | Production observée |
|---|---|
| Code déployé | **présent** (tree `/director` dans `main` + auto-deploy) |
| Feature masquée par flags | **oui** — nav lit `directorV2` |
| Route accessible | **non** si flag off (404 layout) |
| Runtime paid | **OFF** attendu — worker / paid generation / paid AI **non** lus ici ; UI Production sans lien = `DIRECTOR_V2_ENABLED` n’est pas `1`/`true` au runtime |

Noms comparés (valeurs **non lues**, **non affichées**) :

| Nom | Local `.env.local` | Vercel Production (env ls, Encrypted) |
|---|---|---|
| `DIRECTOR_V2_ENABLED` | présent | présent (Production + Preview) |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | présent | présent |
| `DIRECTOR_V2_WORKER_ENABLED` | présent | présent |
| `DIRECTOR_V2_PAID_GENERATION_ENABLED` | présent | présent |
| `DIRECTOR_V2_PAID_AI_ENABLED` | présent | présent |
| `DIRECTOR_V2_*_AI_ENABLED` (M/C/S/A/SB) | présents | présents |
| `SDK_ROOT` | **absent** | **absent** du listing filtré |

Preuve UI : localhost affiche « Réalisateur IA » → parse local **ON**. Production ne l’affiche pas → parse Production **OFF** (variable présente mais pas `1`/`true`, ou équivalent fail-closed). Valeur chiffrée **non relue**.

`canUseDirectorV2Persistence` = `DIRECTOR_V2_ENABLED` ∧ `DIRECTOR_V2_PERSISTENCE_ENABLED` — nécessaire aux API projets, **pas** au lien nav.

`canExecutePaidGeneration` = worker ∧ paid generation. `canExecute*Ai` = director AI ∧ `DIRECTOR_V2_PAID_AI_ENABLED`. Aucun de ces flags n’est requis pour l’UI.

**Activation UI-only proposée (non exécutée) :** write Production **uniquement** `DIRECTOR_V2_ENABLED=1`. Ne pas écrire worker, paid generation, paid AI, directors AI, VHS-11A/B/C, Motion. Ne pas toucher `DIRECTOR_V2_PERSISTENCE_ENABLED` dans la première write (déjà présent ; valeur inconnue). Auth distincte : `AUTH_VHS_DIRECTOR_UI_ONLY_ENABLE_NO_PAID_NO_PROVIDER`.

## 5. SDK unknown

**Cause exacte :** `getCharacterOverview()` lit `SDK_VERSION` à `REPO_ROOT` et retombe sur le littéral `"unknown"` si le fichier est illisible. Le dashboard affiche `SDK ${overview.sdkVersion}`.

```text
REPO_ROOT = SDK_ROOT  ||  process.cwd() + "/.."
sdkVersion = read(REPO_ROOT/SDK_VERSION)  ??  "unknown"
```

Local : `SDK_ROOT` absent → `REPO_ROOT` = parent réel du repo → fichier Git `SDK_VERSION` = `1.0.0` → **SDK 1.0.0**.

Production : `SDK_ROOT` absent du listing env. `outputFileTracingIncludes` pour `/api/character/**` n’inclut que `../characters/**`. **`../SDK_VERSION` n’est pas tracé.** Les markdowns personnage **sont** tracés → cartes `00_IDENTITY` etc. visibles en Production, version fichier absente → **SDK unknown**.

Le loader runtime (`extractSdkVersion`) a un fallback regex sur l’identité. `getCharacterOverview` **n’a pas** ce fallback. D’où l’écart dashboard vs registre personnages.

Fichier `SDK_VERSION` : **versionné** (Git), **non** gitignoré, **non** dans `.vercelignore`. Le trou est le **NFT / file-tracing**, pas Git.

`assertTracingBoundsSafe` refuse tout include qui ne commence pas par `../characters` — une correction devra **élargir ce garde** à l’exact `../SDK_VERSION` (pas `../**`).

**Correction minimale proposée (non implémentée) :**

1. Ajouter `../SDK_VERSION` aux includes des routes `CHARACTER_FS_ROUTE_GLOBS`.
2. Autoriser ce path exact dans `assertTracingBoundsSafe`.
3. Tests : tracing + overview `"unknown"` si fichier absent + non-régression ENOSPC (`../**` toujours interdit).
4. Option ceinture : fallback identité comme le loader (même deploy).

Porte : `AUTH_VHS_SDK_VERSION_FILE_TRACING_INCLUDE_NO_DEPLOY_NO_FLAG_WRITE`.

## 6. PWA

Fichiers : `studio/src/components/pwa-register.tsx`, `studio/public/sw.js` (cache `vh-studio-v12`).

Détection de mise à jour : **fonctionnelle dans le code**.

- `register("/sw.js", { updateViaCache: "none" })`
- `reg.update()` immédiat + intervalle 60 s + `visibilitychange` / `focus`
- `updatefound` → state `installed` + controller existant → modale
- `SKIP_WAITING` → `controllerchange` → reload
- `next dev` : SW off par défaut ; Production : on

Headers Production `GET /sw.js` (lecture seule) :

| Header | Valeur |
|---|---|
| `Cache-Control` | `no-cache, no-store, must-revalidate` |
| `Service-Worker-Allowed` | `/` |
| `X-Vercel-Cache` | `HIT` (`Age` ~294 s) |

Le `HIT` CDN malgré `no-store` peut retarder de quelques minutes un fetch HTTP naïf. Le SW s’enregistre avec `updateViaCache: "none"` et n’intercepte **pas** `/sw.js`. Ce n’est **pas** un cache bloquant d’ancienne UI. **Pas de changement de stratégie.**

Le SW :

- n’intercepte jamais `/api/*` → ne peut pas forger `features.directorV2`
- navigations `/director`, `/login`, `/settings`, `/budget` : network-only
- HTML : network-first
- `/_next/` : network-first

**Un SW Production ne peut pas intégrer un working tree localhost** (origine distincte). **Il ne peut pas contourner un flag OFF** (flags serveur). Les cartes Production sont le **code committé**, pas un cache PWA d’un diff local.

Taille locale `sw.js` 3540 o vs `Content-Length` Production 3423 : écart compatible CRLF local vs LF servi, pas une autre révision de stratégie.

## 7. Provenance du déploiement

Inspect **lecture seule** (`npx vercel inspect`, 0 deploy, 0 env write).

| | Attendu Auth | Alias Production **actuel** | Déploiement 14:16 |
|---|---|---|---|
| id | `dpl_rVG3f6…` | **`dpl_Bc4oDFqG…`** | `dpl_rVG3f6Sr…` |
| host | — | `2dlgmulzw-…` | `4r6w5n9sb-…` |
| created | 2026-08-27 14:16:10 | **2026-08-27 14:35:59 +02** | 2026-08-27 14:16:10 +02 |
| status | Ready | **Ready** | Ready |
| target | Production | Production | Production |
| aliases | Production | `virtual-humans.vercel.app` + git-main + team | historiques inspect |

`dpl_rVG3f6…` existe, Ready, créé **26 s après** `1d28f94` (14:15:44). Il **n’est plus** l’alias Production : auto-deploy `167_` à 14:35:59, **5 s après** `2cacf1b` (14:35:54).

**SHA Git exact :** `gitSource=null`, `meta` git **vide**. CLI **sans SHA**. Corrélation temporelle seulement :

- `dpl_rVG3f6…` ↔ `1d28f94` (non prouvé)
- `dpl_Bc4oDFqG…` ↔ `2cacf1b` (non prouvé)

Ne pas promouvoir un commit docs comme runtime applicatif image (`245bea2`).

**Route future (non implémentée) :** `GET /api/version` ou bloc Réglages affichant `VERCEL_GIT_COMMIT_SHA` (booléen présent / préfixe court, jamais secret). Porte ultérieure, après tracing SDK.

## 8. Tests

Aucun test n’a muté Production. Aucun provider. Aucun deploy.

| Check | Résultat |
|---|---|
| Ciblés tracing + flags + registry | **20/20** |
| Typecheck | **PASS** |
| Suite 1906 | **non relancée** (dernière : `167_`) |
| AICCOS | **exclus** |
| Fraîcheur | après docs |

## 9. Plan de correction — portes sûres, non exécutées

| # | Auth | Fait | Interdit |
|---|---|---|---|
| 1 | `AUTH_VHS_SDK_VERSION_FILE_TRACING_INCLUDE_NO_DEPLOY_NO_FLAG_WRITE` | include `../SDK_VERSION` + tests | deploy, flags, dirty AICCOS/`page.tsx` |
| 2 | `AUTH_VHS_DASHBOARD_DOC_CARDS_ISOLATE_COMMIT_NO_AICCOS_NO_DEPLOY` | commit **uniquement** `page.tsx` | AICCOS, deploy, flags |
| 3 | `AUTH_VHS_PRODUCTION_UI_PARITY_DEPLOY_ONCE_NO_FLAG_WRITE` | un deploy après 1+2 | flag write, provider |
| 4 | `AUTH_VHS_DIRECTOR_UI_ONLY_ENABLE_NO_PAID_NO_PROVIDER` | write `DIRECTOR_V2_ENABLED=1` Production | tout flag paid/worker/VHS/Motion |
| 5 | `AUTH_VHS_SETTINGS_GIT_SHA_DISPLAY_NO_DEPLOY` (option) | `/api/version` ou Réglages | secrets, SHA inventé |

PWA : **aucune** porte — pas de défaut démontré.

RideCloud apply : **suspendu**, READY, **non consommé**.

## 10. Verdict

**`VHS_PRODUCTION_UI_PARITY_PREFLIGHT_READY`**

Les trois divergences UI sont expliquées. Production n’est pas « en retard de code `/director` ». Le dashboard local n’est pas déployable tant que `page.tsx` reste dirty isolé. SDK unknown est un trou de tracing. Réalisateur IA est un flag OFF. PWA n’est pas la cause.

## 11. Prochaine autorisation exacte — non exécutée

**`AUTH_VHS_SDK_VERSION_FILE_TRACING_INCLUDE_NO_DEPLOY_NO_FLAG_WRITE`**

Uniquement l’include NFT de `SDK_VERSION` + tests. **Aucun** deploy. **Aucun** flag write. **Aucun** commit `page.tsx` / AICCOS.

RideCloud : `AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_APPLY_ONCE_NO_PROVIDER` reste **suspendue**.

**Ne pas exécuter ces portes ici.**

STOP.
