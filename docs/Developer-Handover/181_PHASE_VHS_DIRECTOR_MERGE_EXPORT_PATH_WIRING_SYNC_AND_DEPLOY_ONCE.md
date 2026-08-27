# 181 — VHS Director merge/export path wiring sync and deploy once

**Date :** 2026-08-27  
**Auth :** `AUTH_VHS_DIRECTOR_MERGE_EXPORT_PATH_WIRING_SYNC_AND_DEPLOY_ONCE_NO_PROVIDER_NO_FLAG_WRITE`  
**Nature :** **1** push `main` · auto-deploy GitHub Production · lecture seule `/api/version` · **0** moteur · **0** flag · **0** second push  
**HEAD au départ :** `8a7cc19`  
**SHA fonctionnel merge/export :** `a602de9`  
**SHA du build Production :** `8a7cc19`  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_DIRECTOR_MERGE_EXPORT_PATH_WIRING_SYNC_AND_DEPLOY_ONCE_READY
SOURCE_HEAD=8a7cc19
FUNCTIONAL_COMMIT=a602de9
ORIGIN_MAIN_INITIAL=134631d
ORIGIN_MAIN_FINAL=8a7cc19
LOCAL_COMMITS_PUSHED=2
FUNCTIONAL_COMMITS_PUSHED=1
GIT_PUSHES=1
FORCE_PUSHES=0
MANUAL_DEPLOY_CALLS=0
AUTO_DEPLOYS_OBSERVED=1
AUTO_DEPLOY_READY=1
DEPLOYED_GIT_SHA=8a7cc19
PRODUCTION_ALIAS_VERIFIED=1
API_VERSION_PRODUCTION_VERIFIED=1
API_VERSION_SHA_MATCH=1
PROTECTED_API_STILL_PROTECTED=1
DIRECTOR_MERGE_EXPORT_UI_PRODUCTION_OBSERVED=0
REAL_MERGE_ADAPTERS_CREATED=0
REAL_EXPORT_ADAPTERS_CREATED=0
REAL_MERGES=0
REAL_EXPORTS=0
FILES_CREATED_BY_MERGE_EXPORT=0
SIGNED_URLS_CREATED=0
DOWNLOADS_TRIGGERED=0
ASSETS_ACTIVATED=0
ASSETS_PUBLISHED=0
MERGE_EXPORT_AUTHORIZED=0
UPDATE_BLOCKER_REGISTRIES_CREATED=0
AICCOS_BLOCKERS_INTEGRATED=0
SERVICE_WORKER_WRITES=0
FLAG_WRITES=0
PRODUCTION_DATA_WRITES=0
SUPABASE_MUTATIONS=0
PROVIDER_CALLS=0
MEDIA_READS=0
MEDIA_WRITES=0
STORAGE_UPLOADS=0
BUDGET_WRITES=0
BUDGET_RESERVATIONS=0
PHASE_COST=0¢
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
```

---

## 1. Autorisation consommée

`AUTH_VHS_DIRECTOR_MERGE_EXPORT_PATH_WIRING_SYNC_AND_DEPLOY_ONCE_NO_PROVIDER_NO_FLAG_WRITE` — Christian, chat courant.

Un `git push` normal `main → origin/main` (`134631d..8a7cc19`). Aucun force push. Aucun `vercel --prod`. Aucun MCP `deploy_to_vercel`. Aucune promotion. Aucun rollback. Aucun flag. Aucun moteur. Aucune mutation Production/Supabase hors auto-deploy Git. Les deux fichiers AICCOS restent dirty hors staging. RideCloud apply non consommée.

Le commit documentaire de **cette** porte reste **local** (pas de second push). Il n’est **pas** en Production.

`157_`–`180_` restent des snapshots immuables.

### Distinguer les SHA

| Pointeur | SHA | Rôle |
|---|---|---|
| Commit fonctionnel merge/export | `a602de974a7029b355300d0e3d320f487d3c5d73` | câblage WIRED_DISABLED · dans le tree servi |
| SHA du build Production | `8a7cc197f3779448ea651e0b03c88a1b077af05f` | commit docs `180_` · identité `/api/version` |
| Commit documentaire `181_` | local, non poussé | ce rapport · **non déployé** |

Ce n’est **pas** une validation moteur, ni une preuve UI Director en Production, ni un merge/export réel.

---

## 2. Git

| Champ | Attendu Auth | Réel initial | Après push | Après commit docs local |
|---|---|---|---|---|
| Branche | `main` | `main` | `main` | `main` |
| HEAD | `8a7cc19` | `8a7cc19` | `8a7cc19` | commit docs local (non poussé) |
| origin/main | `134631d` | `134631d` (fetch) | **`8a7cc19`** | **`8a7cc19`** |
| ahead/behind | `2/0` | `2/0` | `0/0` | **`1/0`** |
| Dirty protégés | 2 AICCOS | 2 AICCOS | 2 AICCOS | 2 AICCOS, non stagés |

Historique linéaire poussé, dans l’ordre :

1. `a602de9` — **unique** commit fonctionnel ;
2. `8a7cc19` — docs `180_`.

`sw.js`, manifest, migrations et les deux fichiers AICCOS **absents** de ces deux commits. Index vide avant et après le push. Aucun rebase / merge / amend / reset / restore / stash / cherry-pick / force push.

---

## 3. Préconditions avant push

- Fetch lecture seule. Branche `main`. HEAD `8a7cc19`. origin/main `134631d`. Ahead/behind `2/0`.
- Tests ciblés **81/81** (11E, plans, fake adapters, run-state/idempotence, QC, coherence, vue merge/export, Delivery, blockers, fraîcheur).
- Secret scan officiel `findSecretHits` sur `134631d..8a7cc19` : **0 hit**.
- Suite **2002/2002**, typecheck, lint et build local **réutilisés** depuis `180_` : aucun fichier fonctionnel changé depuis `a602de9`.
- Sept gates 11E fail-closed (lecture seule, 0 write Vercel). `mergeExportAuthorized=false`. Aucun chemin automatique merge → export.
- Ledger **437 / 391 / 0 / 46**. RideCloud apply **suspendue**.

---

## 4. Push et auto-déploiement

```text
git push origin main
134631d..8a7cc19  main -> main
```

`GIT_PUSHES=1`. `FORCE_PUSHES=0`. `MANUAL_DEPLOY_CALLS=0`.

Baseline Production **avant** push (honnête, lecture seule) : alias `virtual-humans.vercel.app` servait `dpl_34oqVAp…` · `githubCommitSha=134631d…`.

Auto-deploy GitHub observé (source=`git`, target=production, `githubDeployment=1`) :

| | Valeur redacted-safe |
|---|---|
| id | `dpl_14MHhoRB…` |
| host | `88bvs37tz-…` |
| state | **READY** |
| `githubCommitSha` | **`8a7cc197f3779448ea651e0b03c88a1b077af05f`** |
| aliases | `virtual-humans.vercel.app` + git-main + team |
| `aliasError` | null |
| `aliasAssigned` | true |

`inspect(virtual-humans.vercel.app)` = **le même** id. Alias Production **sert** `8a7cc19`. Le tree applicatif inclut `a602de9`.

---

## 5. `GET /api/version` Production

Host canonique : `https://virtual-humans.vercel.app/api/version`.

GET **200**, `Content-Type: application/json`, **aucun** `Set-Cookie` :

```json
{
  "version": "1.0.0",
  "gitSha": "8a7cc197f3779448ea651e0b03c88a1b077af05f",
  "gitShaShort": "8a7cc19",
  "buildId": "dpl_14MHhoRB…",
  "environment": "production",
  "deployedAt": null
}
```

- `gitSha` = SHA complet de `8a7cc19` fourni par Vercel.
- `gitShaShort` = `8a7cc19`.
- `buildId` = id du déploiement Ready.
- `deployedAt` = `null`.

Headers observés sur l’alias :

- `Cache-Control: no-store, max-age=0`
- `CDN-Cache-Control: no-store`
- `X-Vercel-Cache: MISS` · `Age: 0`

POST `/api/version` : **403**. GET `/api/budget` sans session : **401**. Pas d’ouverture `/api/*`.

---

## 6. Pages publiques et UI Director

Lecture seule, sans session :

- `GET /login` **200**.
- `GET /offline` **200**.
- `GET /director` **307** → `/login?next=%2Fdirector`.
- `GET /characters` et `GET /settings` **307** → login.

Aucune session opérateur. Aucune génération, dry-run distant, sauvegarde ou mutation. Le flag Director reste OFF.

`DIRECTOR_MERGE_EXPORT_UI_PRODUCTION_OBSERVED=0` — **attendu**, pas un échec. La preuve fonctionnelle merge/export reste locale et synthétique (`180_`).

---

## 7. Fail-closed merge/export (code déployé + tests)

| Invariant | Preuve |
|---|---|
| Capabilities réutilisées | `postproduction.merge` / `postproduction.export` · 0 nouvelle |
| Adapter réel absent | `REAL_*_ADAPTERS_CREATED=0` |
| Moteur réel absent | `engineSelected=false` · `unavailable` |
| Fake merge synthétique | métadonnées only · 0 fichier |
| Fake export synthétique | manifeste `synthetic=true` · 0 URL |
| Sept gates 11E OFF | lecture env seulement · 0 write Vercel |
| `mergeExportAuthorized=false` | dominant · `completed` / `merge_ready` insuffisants |
| Pas d’export auto après merge | orchestration 11E |
| 0 retry / fallback / second submit | run-state + tests |
| 0 fichier / URL / download / publication | fake adapter + tests |
| Blocker unique | `director-merge-export` · registre existant |

Aucune validation moteur réelle. Aucun claim de vidéo finale.

---

## 8. Ledger, AICCOS, RideCloud

Ledger inchangé : **437 / 391 / 0 / 46**.  
AICCOS : dirty, non stagés, absents du push.  
RideCloud apply : **SUSPENDED_NOT_CONSUMED**.

---

## 9. Limites restantes

- UI `/director` merge/export non observée en Production (flag OFF + pas de session).
- Aucun moteur merge/export choisi.
- Merge/export réel toujours interdit.
- Assets I2V/Voice restent privés et inactifs.
- Ce rapport `181_` n’est **pas** déployé.

---

## 10. Prochaine porte — non exécutée

```text
AUTH_VHS_DIRECTOR_MERGE_EXPORT_PATH_WIRING_DOCS_SYNC_ONCE_NO_PROVIDER_NO_FLAG_WRITE
```

Synchroniser administrativement ce rapport local `181_` **sans** créer une nouvelle boucle de rapports numérotés, puis reprendre le développement fonctionnel.

Toute exécution réelle, sélection de moteur, publication ou téléchargement exige une Auth humaine séparée.
