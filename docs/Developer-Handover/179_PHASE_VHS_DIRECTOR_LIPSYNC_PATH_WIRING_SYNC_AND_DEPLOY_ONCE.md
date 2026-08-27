# 179 — VHS Director lipsync path wiring sync and deploy once

**Date :** 2026-08-27  
**Auth :** `AUTH_VHS_DIRECTOR_LIPSYNC_PATH_WIRING_SYNC_AND_DEPLOY_ONCE_NO_PROVIDER_NO_FLAG_WRITE`  
**Nature :** **1** push `main` · auto-deploy GitHub Production · lecture seule `/api/version` · **0** provider · **0** flag · **0** second push  
**HEAD au départ :** `bb41dcc`  
**SHA fonctionnel lipsync :** `366abd6`  
**SHA du build Production :** `bb41dcc`  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_DIRECTOR_LIPSYNC_PATH_WIRING_SYNC_AND_DEPLOY_ONCE_READY
SOURCE_HEAD=bb41dcc
FUNCTIONAL_COMMIT=366abd6
ORIGIN_MAIN_INITIAL=9b62799
ORIGIN_MAIN_FINAL=bb41dcc
LOCAL_COMMITS_PUSHED=2
FUNCTIONAL_COMMITS_PUSHED=1
GIT_PUSHES=1
FORCE_PUSHES=0
MANUAL_DEPLOY_CALLS=0
AUTO_DEPLOYS_OBSERVED=1
AUTO_DEPLOY_READY=1
DEPLOYED_GIT_SHA=bb41dcc
PRODUCTION_ALIAS_VERIFIED=1
API_VERSION_PRODUCTION_VERIFIED=1
API_VERSION_SHA_MATCH=1
PROTECTED_API_STILL_PROTECTED=1
DIRECTOR_LIPSYNC_UI_PRODUCTION_OBSERVED=0
LIPSYNC_PROVIDER_SELECTED=0
LIPSYNC_REAL_ADAPTERS_CREATED=0
LIPSYNC_REAL_SUBMITS=0
LIPSYNC_RETRIES=0
LIPSYNC_FALLBACKS=0
LIPSYNC_ASSETS_ACTIVATED=0
MERGE_EXPORT_AUTHORIZED=0
MERGE_EXPORT_CALLS=0
UPDATE_BLOCKER_REGISTRIES_CREATED=0
AICCOS_BLOCKERS_INTEGRATED=0
SERVICE_WORKER_WRITES=0
FLAG_WRITES=0
PRODUCTION_DATA_WRITES=0
SUPABASE_MUTATIONS=0
PROVIDER_CALLS=0
LIPSYNC_PROVIDER_CALLS=0
TTS_CALLS=0
MEDIA_READS=0
MEDIA_WRITES=0
SIGNED_URLS_CREATED=0
STORAGE_UPLOADS=0
BUDGET_WRITES=0
BUDGET_RESERVATIONS=0
PHASE_COST=0¢
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
NEXT_AUTH=AUTH_VHS_POST_LIPSYNC_WIRING_HUMAN_NEXT_PRIORITY_DECISION_NO_DEPLOY_NO_FLAG_WRITE
```

---

## 1. Autorisation consommée

`AUTH_VHS_DIRECTOR_LIPSYNC_PATH_WIRING_SYNC_AND_DEPLOY_ONCE_NO_PROVIDER_NO_FLAG_WRITE` — Christian, chat courant.

Un `git push` normal `main → origin/main` (`9b62799..bb41dcc`). Aucun force push. Aucun `vercel --prod`. Aucun MCP `deploy_to_vercel`. Aucune promotion. Aucun rollback. Aucun flag. Aucun provider. Aucune mutation Production/Supabase hors auto-deploy Git. Les deux fichiers AICCOS restent dirty hors staging. RideCloud apply non consommée.

Le commit documentaire de **cette** porte reste **local** (pas de second push). Il n’est **pas** en Production.

`157_`–`178_` restent des snapshots immuables. La sync docs `177_` était déjà **terminée** avant cette porte.

### Distinguer les SHA

| Pointeur | SHA | Rôle |
|---|---|---|
| Commit fonctionnel lipsync | `366abd6141a3f4198560769511f8608b0e1ac5d1` | câblage WIRED_DISABLED · dans le tree servi |
| SHA du build Production | `bb41dccfc05e5c4b9b06056bff3646309848549b` | commit docs `178_` · identité `/api/version` |
| Commit documentaire `179_` | local, non poussé | ce rapport · **non déployé** |

Ce n’est **pas** une validation provider, ni une preuve UI Director en Production.

---

## 2. Git

| Champ | Attendu Auth | Réel initial | Après push | Après commit docs local |
|---|---|---|---|---|
| Branche | `main` | `main` | `main` | `main` |
| HEAD | `bb41dcc` | `bb41dcc` | `bb41dcc` | commit docs local (non poussé) |
| origin/main | `9b62799` | `9b62799` (fetch) | **`bb41dcc`** | **`bb41dcc`** |
| ahead/behind | `2/0` | `2/0` | `0/0` | **`1/0`** |
| Dirty protégés | 2 AICCOS | 2 AICCOS | 2 AICCOS | 2 AICCOS, non stagés |

Historique linéaire poussé, dans l’ordre :

1. `366abd6` — **unique** commit fonctionnel ;
2. `bb41dcc` — docs `178_`.

`sw.js`, manifest, migrations et les deux fichiers AICCOS **absents** de ces deux commits. Index vide avant et après le push. Aucun rebase / merge / amend / reset / restore / stash / cherry-pick / force push.

---

## 3. Préconditions avant push

- Fetch lecture seule. Branche `main`. HEAD `bb41dcc`. origin/main `9b62799`. Ahead/behind `2/0`.
- Tests ciblés **92/92** (11D, références, plan/orchestration/run-state/QC, coherence, vue Lipsync, Delivery, Production, registry, blockers, fraîcheur).
- Secret scan officiel `findSecretHits` sur `9b62799..bb41dcc` : **0 secret réel**. Trois fixtures de tests de rédaction seulement (préfixes token, data-image et sk redacted dans des asserts).
- Suite **1976/1976**, typecheck, lint et build local **réutilisés** depuis `178_` : aucun fichier fonctionnel changé depuis `366abd6`.
- Provider lipsync = `unavailable`. Six gates 11D fail-closed (lecture seule, 0 write Vercel). `mergeExportAuthorized=false`.
- Ledger **437 / 391 / 0 / 46**. RideCloud apply **suspendue**.

---

## 4. Push et auto-déploiement

```text
git push origin main
9b62799..bb41dcc  main -> main
```

`GIT_PUSHES=1`. `FORCE_PUSHES=0`. `MANUAL_DEPLOY_CALLS=0`.

Baseline Production **avant** push (honnête, lecture seule) : alias `virtual-humans.vercel.app` servait `dpl_8NfbceNa…` · `githubCommitSha=9b62799…`.

Auto-deploy GitHub observé (source=`git`, target=production, `githubDeployment=1`) :

| | Valeur redacted-safe |
|---|---|
| id | `dpl_9i9MUDPd…` |
| host | `hmqclrbae-…` |
| state | **READY** |
| `githubCommitSha` | **`bb41dccfc05e5c4b9b06056bff3646309848549b`** |
| aliases | `virtual-humans.vercel.app` + git-main + team |
| `aliasError` | null |

`get_deployment(virtual-humans.vercel.app)` = **le même** id. Alias Production **sert** `bb41dcc`. Le tree applicatif inclut `366abd6`.

---

## 5. `GET /api/version` Production

Host canonique : `https://virtual-humans.vercel.app/api/version`.

GET **200**, `Content-Type: application/json`, **aucun** `Set-Cookie` :

```json
{
  "version": "1.0.0",
  "gitSha": "bb41dccfc05e5c4b9b06056bff3646309848549b",
  "gitShaShort": "bb41dcc",
  "buildId": "dpl_9i9MUDPd…",
  "environment": "production",
  "deployedAt": null
}
```

- `gitSha` = SHA complet de `bb41dcc` fourni par Vercel.
- `gitShaShort` = `bb41dcc`.
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

`DIRECTOR_LIPSYNC_UI_PRODUCTION_OBSERVED=0` — **attendu**, pas un échec. La preuve fonctionnelle lipsync reste locale et synthétique (`178_`).

---

## 7. Fail-closed lipsync (code déployé + tests)

| Invariant | Preuve |
|---|---|
| Provider = `unavailable` | `PHASE_11D_PROVIDER` dans `366abd6` |
| Adapter réel absent | `LIPSYNC_REAL_ADAPTERS_CREATED=0` |
| Fake ≠ preuve Production | adapter `fake-local-lipsync` local only |
| Capability réelle refusée | `assertPhase11DRealExecutionGates` |
| Six gates 11D OFF | lecture env seulement · 0 write Vercel |
| Pas de bouton réel si gates OFF | UI `disabled` · tests source |
| Pas de choix provider UI | aucun `<select>` |
| 0 persist Production | plan/run in-memory |
| 0 retry / fallback / second submit | run-state + tests |
| `mergeExportAuthorized=false` | plan + coherence + Delivery |
| 0 activation | `outputActive=false` |
| Blocker unique | `director-lipsync` · registre existant |

Aucune validation lipsync réelle. Aucun claim provider.

---

## 8. Ledger, AICCOS, RideCloud

Ledger inchangé : **437 / 391 / 0 / 46**.  
AICCOS : dirty, non stagés, absents du push.  
RideCloud apply : **SUSPENDED_NOT_CONSUMED**.

---

## 9. Limites restantes

- UI `/director` lipsync non observée en Production (flag OFF + pas de session).
- Aucun provider lipsync choisi.
- Merge/export réel toujours interdit.
- Assets I2V/Voice restent privés et inactifs.
- Ce rapport `179_` n’est **pas** déployé.

---

## 10. Prochaine porte — non exécutée

```text
AUTH_VHS_POST_LIPSYNC_WIRING_HUMAN_NEXT_PRIORITY_DECISION_NO_DEPLOY_NO_FLAG_WRITE
```

Synchroniser plus tard le rapport local `179_` de façon administrative, **sans** créer une nouvelle boucle de rapports numérotés, puis décider du prochain chantier fonctionnel.

Le choix et le preflight d’un provider lipsync réel exigent une Auth humaine séparée. Aucune dépense ou exécution réelle n’est implicitement autorisée.
