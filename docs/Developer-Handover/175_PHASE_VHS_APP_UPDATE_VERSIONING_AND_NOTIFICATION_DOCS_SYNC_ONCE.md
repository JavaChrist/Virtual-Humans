# 175 — VHS app update versioning and notification docs sync once

**Date :** 2026-08-27  
**Auth :** `AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_DOCS_SYNC_ONCE_NO_FLAG_WRITE`  
**Nature :** **1** push du commit documentaire `80cc7fa` · auto-deploy GitHub du SHA **docs** · **0** code fonctionnel · **0** flag · **0** second push  
**HEAD au départ :** `80cc7fa`  
**Parent :** `1765da6`  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_DOCS_SYNC_ONCE_READY
SOURCE_HEAD=80cc7fa
SOURCE_PARENT=1765da6
FUNCTIONAL_COMMIT=68b09ee
ORIGIN_MAIN_INITIAL=1765da6
ORIGIN_MAIN_FINAL=80cc7fa
DOCS_COMMITS_PUSHED=1
FUNCTIONAL_FILES_PUSHED=0
GIT_PUSHES=1
FORCE_PUSHES=0
MANUAL_DEPLOY_CALLS=0
AUTO_DEPLOYS_OBSERVED=1
AUTO_DEPLOY_READY=1
AUTO_DEPLOY_GIT_SHA=80cc7fa
PRODUCTION_ALIAS_GIT_SHA=80cc7fa
API_VERSION_PRODUCTION_VERIFIED=1
API_VERSION_GIT_SHA_SHORT=80cc7fa
DOCS_ONLY_BUILD_IDENTITY_CHANGE=1
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
NEXT_AUTH=AUTH_VHS_POST_APP_UPDATE_HUMAN_NEXT_PRIORITY_DECISION_NO_DEPLOY_NO_FLAG_WRITE
```

---

## 1. Autorisation consommée

`AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_DOCS_SYNC_ONCE_NO_FLAG_WRITE` — Christian, chat courant.

Un `git push` normal `1765da6..80cc7fa main -> main`. Aucun force push. Aucun déploiement manuel. Aucun flag. Aucun correctif applicatif.

`AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_SYNC_AND_DEPLOY_ONCE_NO_FLAG_WRITE` **non réutilisée**.

Les deux fichiers AICCOS restent dirty hors staging. RideCloud apply non consommée.

`157_`–`174_` restent des snapshots immuables.

## 2. Distinctions SHA

| Rôle | SHA | Nature |
|---|---|---|
| Commit fonctionnel app-update | `68b09ee` | route `/api/version` + `PwaRegister` |
| Commit applicatif vérifié `174_` | `1765da6` | SHA record `173_` · `/api/version` déjà prouvé |
| Commit documentaire synchronisé | `80cc7fa` | rapport `174_` + living handovers · **0** fichier applicatif |

`80cc7fa` contient exactement 10 fichiers : 9 docs handover + le test de fraîcheur. Pas de `sw.js`, manifest, `layout.tsx`, `page.tsx`, routes, `proxy.ts`, `rate-limit.ts`, `next.config.ts`, migration, AICCOS.

## 3. Git

| Champ | Attendu | Réel initial | Après push | Après commit docs `175_` local |
|---|---|---|---|---|
| Branche | `main` | `main` | `main` | `main` |
| HEAD | `80cc7fa` | `80cc7fa` | `80cc7fa` | commit local `175_` (non poussé) |
| origin/main | `1765da6` | `1765da6` (fetch) | **`80cc7fa`** | **`80cc7fa`** |
| ahead/behind | `1/0` | `1/0` | `0/0` | **`1/0`** |
| Dirty | 2 AICCOS | 2 AICCOS | 2 AICCOS | 2 AICCOS, non stagés |

Historique linéaire. Secret scan `1765da6..80cc7fa` : **aucun hit**. Freshness **PASS**. Suite/typecheck/build **non relancés** (commit strictement documentaire).

## 4. Auto-déploiement documentaire

```text
git push origin main
1765da6..80cc7fa  main -> main
```

`GIT_PUSHES=1`. `MANUAL_DEPLOY_CALLS=0`.

Auto-deploy GitHub observé (source=`git`, target=production) :

| | Valeur redacted-safe |
|---|---|
| id | `dpl_2Th9fGvk…` |
| host | `gujby9ath-…` |
| state | **READY** |
| `githubCommitSha` | **`80cc7fa8b68707fa9d7dab2707ca9003ef551bd2`** |
| aliases | `virtual-humans.vercel.app` + git-main + team |
| `aliasError` | null |

`get_deployment(virtual-humans.vercel.app)` = **le même** id.

**L’alias Production sert un build portant le SHA documentaire `80cc7fa` ; aucune modification fonctionnelle applicative n’a été introduite par ce commit.**

Le tree applicatif de référence reste celui de `68b09ee`, déjà vérifié sur `1765da6`. Ce build n’est **pas** une nouvelle feature, **pas** une seconde implémentation app-update, **pas** un nouveau runtime applicatif.

## 5. `GET /api/version` après le build docs

Host canonique : `https://virtual-humans.vercel.app/api/version`.

**200**, JSON, **aucun** `Set-Cookie` :

```json
{
  "version": "1.0.0",
  "gitSha": "80cc7fa8b68707fa9d7dab2707ca9003ef551bd2",
  "gitShaShort": "80cc7fa",
  "buildId": "dpl_2Th9fGvk…",
  "environment": "production",
  "deployedAt": null
}
```

Headers : `Cache-Control: no-store, max-age=0` · `CDN-Cache-Control: no-store` · `X-Vercel-Cache: MISS`. Pas de dump d’environnement.

Le changement `1765da6` → `80cc7fa` est une **identité de build Git**, pas un changement fonctionnel. `DOCS_ONLY_BUILD_IDENTITY_CHANGE=1`.

Limite opérationnelle **non corrigée** : le détecteur compare l’identité du build ; un auto-déploiement docs **peut** produire une notification de mise à jour. Cette porte n’autorise aucun filtre des commits documentaires.

`REAL_UPDATE_NOTIFICATION_OBSERVED=0` (aucune baseline onglet `1765da6` honnête). `SKIP_WAITING_SENT=0`.

## 6. Compteurs

```text
SOURCE_HEAD=80cc7fa
SOURCE_PARENT=1765da6
FUNCTIONAL_COMMIT=68b09ee
ORIGIN_MAIN_INITIAL=1765da6
ORIGIN_MAIN_FINAL=80cc7fa
DOCS_COMMITS_PUSHED=1
FUNCTIONAL_FILES_PUSHED=0
GIT_PUSHES=1
FORCE_PUSHES=0
MANUAL_DEPLOY_CALLS=0
AUTO_DEPLOYS_OBSERVED=1
AUTO_DEPLOY_READY=1
AUTO_DEPLOY_GIT_SHA=80cc7fa
PRODUCTION_ALIAS_GIT_SHA=80cc7fa
API_VERSION_PRODUCTION_VERIFIED=1
API_VERSION_GIT_SHA_SHORT=80cc7fa
DOCS_ONLY_BUILD_IDENTITY_CHANGE=1
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

## 7. Prochaine Auth — non choisie, non exécutée

```text
AUTH_VHS_POST_APP_UPDATE_HUMAN_NEXT_PRIORITY_DECISION_NO_DEPLOY_NO_FLAG_WRITE
```

Placeholder de **décision humaine**. Ne choisit pas entre : observation PWA contrôlée, câblage blockers, filtre des builds docs-only, reprise RideCloud, Director, ou phase média. Toute autorisation de déploiement, flag, migration, provider, média, activation, lipsync ou export exige une décision distincte de Christian.

Ne **pas** exécuter pendant cette Auth.
