# 174 — VHS app update versioning and notification sync and deploy once

**Date :** 2026-08-27  
**Auth :** `AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_SYNC_AND_DEPLOY_ONCE_NO_FLAG_WRITE`  
**Nature :** **1** push `main` · auto-deploy GitHub Production · lecture seule `/api/version` · **0** flag · **0** second push  
**HEAD au départ :** `1765da6` (`173_` SHA record)  
**SHA fonctionnel :** `68b09ee`  
**SHA déployé :** `1765da6`  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_SYNC_AND_DEPLOY_ONCE_READY
SOURCE_HEAD=1765da6
ORIGIN_MAIN_INITIAL=5ebf73c
ORIGIN_MAIN_FINAL=1765da6
GIT_PUSHES=1
FORCE_PUSHES=0
MANUAL_DEPLOY_CALLS=0
AUTO_DEPLOYS_OBSERVED=1
DEPLOYED_GIT_SHA=1765da6
DEPLOYMENT_READY=1
PRODUCTION_ALIAS_VERIFIED=1
API_VERSION_PRODUCTION_VERIFIED=1
API_VERSION_SHA_MATCH=1
API_VERSION_NO_STORE_HEADERS_VERIFIED=1
PROTECTED_API_STILL_PROTECTED=1
PWA_BASELINE_VERIFIED=0
REAL_UPDATE_NOTIFICATION_OBSERVED=0
SKIP_WAITING_SENT=0
FLAG_WRITES=0
PRODUCTION_DATA_WRITES=0
SUPABASE_MUTATIONS=0
PROVIDER_CALLS=0
TTS_CALLS=0
MEDIA_READS=0
MEDIA_WRITES=0
STORAGE_UPLOADS=0
BUDGET_WRITES=0
PHASE_COST=0¢
SERVICE_WORKER_WRITES=0
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
NEXT_AUTH=AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_DOCS_SYNC_ONCE_NO_FLAG_WRITE
```

---

## 1. Autorisation consommée

`AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_SYNC_AND_DEPLOY_ONCE_NO_FLAG_WRITE` — Christian, chat courant.

Un `git push` normal `main → origin/main` (`5ebf73c..1765da6`). Aucun force push. Aucun `vercel --prod`. Aucun MCP `deploy_to_vercel`. Aucune promotion. Aucun flag. Aucune mutation Production/Supabase hors auto-deploy Git. Les deux fichiers AICCOS restent dirty hors staging. RideCloud apply non consommée.

Le commit documentaire de **cette** porte reste **local** (pas de second push). Il n’est **pas** en Production.

`157_`–`173_` restent des snapshots immuables.

## 2. Git

| Champ | Attendu Auth | Réel initial | Après push | Après commit docs local |
|---|---|---|---|---|
| Branche | `main` | `main` | `main` | `main` |
| HEAD | `1765da6` | `1765da6` | `1765da6` | commit docs local (non poussé) |
| origin/main | `5ebf73c` | `5ebf73c` (fetch) | **`1765da6`** | **`1765da6`** |
| ahead/behind | `2/0` | `2/0` | `0/0` | **`1/0`** |
| Dirty protégés | 2 AICCOS | 2 AICCOS | 2 AICCOS | 2 AICCOS, non stagés |

Commits poussés, dans l’ordre : `68b09ee` puis `1765da6`. Aucun commit supplémentaire. `sw.js`, manifest, `layout.tsx`, `page.tsx` et les deux AICCOS **absents** de ces commits.

## 3. Préconditions avant push

- Tests ciblés **48/48** (app-version, route, proxy/rate-limit, client, blockers, source PWA, tracing, freshness).
- Typecheck **PASS** (working tree AICCOS non modifié).
- Secret scan officiel sur `5ebf73c..1765da6` : **aucun hit**.
- Suite 1940/1940 et build local **réutilisés** depuis `173_` : aucun fichier fonctionnel changé depuis `1765da6` (hors AICCOS dirty hors Git).
- Flags payants / média / Director **considérés OFF**. Aucune écriture.
- RideCloud apply **suspendue**.

## 4. Push et auto-déploiement

```text
git push origin main
5ebf73c..1765da6  main -> main
```

`GIT_PUSHES=1`. `FORCE_PUSHES=0`. `MANUAL_DEPLOY_CALLS=0`.

Auto-deploy GitHub observé (source=`git`, target=production) :

| | Valeur redacted-safe |
|---|---|
| id | `dpl_6KhbWNjo…` |
| host | `dkhe3tfg9-…` |
| state | **READY** |
| `githubCommitSha` | **`1765da67b0f3bbe9e577975d7c92188bb65d2fb1`** |
| aliases | `virtual-humans.vercel.app` + git-main + team |
| `aliasError` | null |

`get_deployment(virtual-humans.vercel.app)` = **le même** id. Alias Production **sert** `1765da6`.

## 5. `GET /api/version` Production

Host canonique : `https://virtual-humans.vercel.app/api/version`.

Deux GET, corps identiques, **200**, `Content-Type: application/json`, **aucun** `Set-Cookie` :

```json
{
  "version": "1.0.0",
  "gitSha": "1765da67b0f3bbe9e577975d7c92188bb65d2fb1",
  "gitShaShort": "1765da6",
  "buildId": "dpl_6KhbWNjo…",
  "environment": "production",
  "deployedAt": null
}
```

- `gitSha` = SHA complet de `1765da6` (variable Vercel réellement fournie, **pas** inventée).
- `gitShaShort` = 7 premiers caractères.
- `buildId` = id du déploiement Ready (non vide).
- `deployedAt` = `null`. Pas de timestamp inventé. Pas de dump d’environnement.

Headers observés sur l’alias :

- `Cache-Control: no-store, max-age=0`
- `CDN-Cache-Control: no-store` (`Cdn-Cache-Control`)
- `X-Vercel-Cache: MISS` · `Age: 0`

`Vercel-CDN-Cache-Control` **n’est pas renvoyé** par l’alias public (probablement consommé par la plateforme). Le no-store reste prouvé par les deux headers visibles + MISS. Compteur `API_VERSION_NO_STORE_HEADERS_VERIFIED=1` avec cette limite déclarée.

POST `/api/version` : **403** (proxy : seul GET est public). GET `/api/budget` sans session : **401**. Pas d’ouverture `/api/*`.

## 6. PWA / notification

Aucune baseline Production pré-déploiement honnête n’était disponible dans cette session (pas d’onglet déjà ouvert avec l’ancien build).

`PWA_BASELINE_VERIFIED=0`. `REAL_UPDATE_NOTIFICATION_OBSERVED=0`. `SKIP_WAITING_SENT=0`.

Limite **déclarée**, pas un échec de porte. Les tests locaux `173_` restent la preuve du client. Ne pas inventer une transition E2E.

Limites inchangées, **non corrigées** :

- `clients.claim()` peut encore recharger d’autres onglets après un `SKIP_WAITING` réussi (`sw.js` non modifié).
- Blockers non câblés à generate / director / AICCOS.

## 7. Compteurs

```text
SOURCE_HEAD=1765da6
ORIGIN_MAIN_INITIAL=5ebf73c
ORIGIN_MAIN_FINAL=1765da6
GIT_PUSHES=1
FORCE_PUSHES=0
MANUAL_DEPLOY_CALLS=0
AUTO_DEPLOYS_OBSERVED=1
DEPLOYED_GIT_SHA=1765da6
DEPLOYMENT_READY=1
PRODUCTION_ALIAS_VERIFIED=1
API_VERSION_PRODUCTION_VERIFIED=1
API_VERSION_SHA_MATCH=1
API_VERSION_NO_STORE_HEADERS_VERIFIED=1
PROTECTED_API_STILL_PROTECTED=1
PWA_BASELINE_VERIFIED=0
REAL_UPDATE_NOTIFICATION_OBSERVED=0
SKIP_WAITING_SENT=0
FLAG_WRITES=0
PRODUCTION_DATA_WRITES=0
SUPABASE_MUTATIONS=0
PROVIDER_CALLS=0
TTS_CALLS=0
MEDIA_READS=0
MEDIA_WRITES=0
STORAGE_UPLOADS=0
BUDGET_WRITES=0
PHASE_COST=0¢
SERVICE_WORKER_WRITES=0
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
```

Ledger inchangé : 437 / 391 / 0 / 46.

## 8. Prochaine Auth exacte — non exécutée

```text
AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_DOCS_SYNC_ONCE_NO_FLAG_WRITE
```

Traiter **uniquement** le commit documentaire local `174_` (ahead `1/0`). Un push docs déclenchera un auto-deploy GitHub d’un SHA documentaire : ne pas le promouvoir comme nouvelle feature applicative. **0** flag. **0** provider. Ne pas réutiliser l’autorisation de déploiement applicatif, de migration, de média, d’activation, de lipsync ou d’export.

Ne **pas** exécuter cette porte pendant cette Auth.
