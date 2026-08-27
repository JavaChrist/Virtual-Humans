# 169 — SDK_VERSION File Tracing Include

**Date :** 2026-08-27  
**Auth :** `AUTH_VHS_SDK_VERSION_FILE_TRACING_INCLUDE_NO_DEPLOY_NO_FLAG_WRITE`  
**Nature :** correctif packaging Next.js **local** · **0** deploy · **0** flag write · **0** mutation Production  
**HEAD au départ :** `14dbba5` (`168_` SHA record)  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_SDK_VERSION_FILE_TRACING_INCLUDE_READY
PHASE_COST = 0¢
DEPLOYS = 0
FLAG_WRITES = 0
VERCEL_MUTATIONS = 0
SUPABASE_MUTATIONS = 0
PROVIDER_CALLS = 0
TTS_CALLS = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
STORAGE_UPLOADS = 0
BUDGET_WRITES = 0
DIRTY_PROTECTED_FILES_STAGED = 0
NFT_PROOF = PASS
RIDECLOUD_APPLY = SUSPENDED_NOT_CONSUMED
NEXT_AUTH = AUTH_VHS_DASHBOARD_DOC_CARDS_ISOLATE_COMMIT_NO_AICCOS_NO_DEPLOY
```

---

## 1. Autorisation consommée

`AUTH_VHS_SDK_VERSION_FILE_TRACING_INCLUDE_NO_DEPLOY_NO_FLAG_WRITE` — Christian, chat courant.

Correctif tracing + tests + build local + docs + commit/push. Aucun deploy Vercel. Aucun flag write. Aucune mutation Supabase. Aucun provider.

`AUTH_VHS_DASHBOARD_DOC_CARDS_ISOLATE_COMMIT_NO_AICCOS_NO_DEPLOY` **non exécutée**.

RideCloud `AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_APPLY_ONCE_NO_PROVIDER` **non consommée**.

`157_`–`168_` restent des snapshots immuables.

## 2. Git avant action

| Champ | Attendu | Réel |
|---|---|---|
| Branche | `main` | `main` |
| HEAD / origin/main | `14dbba5` | **`14dbba5`** |
| ahead / behind | 0 / 0 | **0 / 0** |
| Working tree | 3 dirty protégés | **exact** |

Fichiers protégés **non touchés, non stagés**.

## 3. Cause confirmée

`getCharacterOverview()` (`studio/src/lib/sdk.ts`) et `extractSdkVersion()` (`studio/src/runtime/character/loader.ts`) lisent `path.join(REPO_ROOT, "SDK_VERSION")`.

`REPO_ROOT` = `SDK_ROOT` ou `process.cwd() + "/.."`. Fichier Git racine présent, contenu versionné `1.0.0`.

Avant : `CHARACTER_FS_INCLUDE_GLOBS = ["../characters/**"]` seulement. Production embarquait les markdowns (cartes 00_IDENTITY visibles) mais pas le fichier version → dashboard **SDK unknown**.

Localhost lisait le disque réel → **SDK 1.0.0**.

Surfaces qui lisent `SDK_VERSION` :

| Surface | Lecteur |
|---|---|
| `GET /api/character` | `getCharacterOverview` |
| `GET /api/v1/characters` · `/api/v1/characters/[id]` | registry / loader |
| Art Director `/api/director/projects/*/art/**` | registry capabilities |

Toutes sont déjà dans `CHARACTER_FS_ROUTE_GLOBS`. Pas d’élargissement `/api/**` ni `/**`.

## 4. Correctif

| | Avant | Après |
|---|---|---|
| Includes character-fs | `../characters/**` | `../characters/**` + **`../SDK_VERSION`** |
| Routes | inchangées | inchangées |
| Excludes | inchangées | inchangées · ne ciblent pas `SDK_VERSION` |
| Dev (`NODE_ENV=development`) | pas de `outputFileTracingRoot` | **inchangé** |
| Garde | include doit commencer par `../characters` | `../characters…` **ou exact** `../SDK_VERSION` |
| Globs larges | `../**` interdit | toujours interdit |

Chemin studio-relatif `../SDK_VERSION` : cohérent avec `../characters/**` et `outputFileTracingRoot = process.cwd()/..`.

Aucun fallback identité ajouté dans `getCharacterOverview` (hors scope). Aucun flag. Aucun `next.config` hors le graphe déjà branché sur `characterFsTracingIncludes()`.

## 5. Preuves — tests vs NFT

**Preuve configuration (tests) :**

- `SDK_VERSION` est dans `CHARACTER_FS_INCLUDE_GLOBS`
- `resolve(studioCwd, "../SDK_VERSION")` = fichier racine existant
- `/api/character/**` et `/api/v1/characters/**` reçoivent l’include
- excludes ne neutralisent pas `../SDK_VERSION`
- `../**` et `../docs/**` restent refusés
- `../characters/**` inchangé
- `/api/**` et `/api/budget/**` toujours absents des includes

**Preuve NFT (build Production local, Next 16.2.10 Turbopack) :**

| Route NFT | `SDK_VERSION` | `characters/**` |
|---|---|---|
| `api/character/route.js.nft.json` | **1** (`../../../../../../SDK_VERSION`) | 437 |
| `api/v1/characters/route.js.nft.json` | **1** | 438 |
| `api/v1/characters/[id]/route.js.nft.json` | **1** | 438 |
| `api/budget/route.js.nft.json` | **0** | 0 |

Build **PASS** · 0 accès externe requis. `.next/` **non committé**.

Le test de configuration seul ne suffit pas : la preuve NFT ci-dessus confirme l’emballage réel. Un test unitaire relit le NFT **s’il est présent** (skip silencieux sans `.next`).

## 6. Tests / typecheck / build

| Check | Résultat |
|---|---|
| Ciblés file-tracing | **PASS** |
| Suite unitaire | **1908/1908** (cible) |
| Typecheck | **PASS** |
| `next build` | **PASS** · NFT ci-dessus |
| Fraîcheur | après docs |
| Secret scan | après docs |

AICCOS + `page.tsx` **exclus**. 0 média Git. 0 `.tmp`. Migration `20260827133000` **non appliquée**.

## 7. Prochaine autorisation exacte — non exécutée

**`AUTH_VHS_DASHBOARD_DOC_CARDS_ISOLATE_COMMIT_NO_AICCOS_NO_DEPLOY`**

Uniquement `git add -- studio/src/app/page.tsx` pour la suppression déjà dirty des cartes documentaires. **Aucun** AICCOS. **Aucun** deploy.

RideCloud apply reste **suspendue**.

**Ne pas exécuter ces portes ici.**

STOP.
