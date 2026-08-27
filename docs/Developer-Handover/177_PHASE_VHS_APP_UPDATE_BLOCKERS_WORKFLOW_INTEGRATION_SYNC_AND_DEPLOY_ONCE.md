# 177 — VHS app update blockers workflow integration sync and deploy once

**Date :** 2026-08-27  
**Auth :** `AUTH_VHS_APP_UPDATE_BLOCKERS_WORKFLOW_INTEGRATION_SYNC_AND_DEPLOY_ONCE_NO_FLAG_WRITE`  
**Nature :** **1** push `main` · auto-deploy GitHub Production · lecture seule `/api/version` · **0** flag · **0** second push  
**HEAD au départ :** `7d1c34c` (`176_` SHA record)  
**SHA fonctionnel blockers :** `045f48a`  
**SHA déployé :** `7d1c34c`  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_APP_UPDATE_BLOCKERS_WORKFLOW_INTEGRATION_SYNC_AND_DEPLOY_ONCE_READY
SOURCE_HEAD=7d1c34c
FUNCTIONAL_COMMIT=045f48a
ORIGIN_MAIN_INITIAL=80cc7fa
ORIGIN_MAIN_FINAL=7d1c34c
LOCAL_COMMITS_PUSHED=3
FUNCTIONAL_COMMITS_PUSHED=1
GIT_PUSHES=1
FORCE_PUSHES=0
MANUAL_DEPLOY_CALLS=0
AUTO_DEPLOYS_OBSERVED=1
AUTO_DEPLOY_READY=1
DEPLOYED_GIT_SHA=7d1c34c
PRODUCTION_ALIAS_VERIFIED=1
API_VERSION_PRODUCTION_VERIFIED=1
API_VERSION_SHA_MATCH=1
PROTECTED_API_STILL_PROTECTED=1
REAL_BLOCKER_E2E_OBSERVED=0
SKIP_WAITING_DURING_BLOCKER_CHECK=0
RELOAD_DURING_BLOCKER_CHECK=0
UPDATE_BLOCKER_REGISTRIES_CREATED=0
AICCOS_BLOCKERS_INTEGRATED=0
SERVICE_WORKER_WRITES=0
MANIFEST_WRITES=0
FLAG_WRITES=0
PRODUCTION_DATA_WRITES=0
SUPABASE_MUTATIONS=0
PROVIDER_CALLS=0
TTS_CALLS=0
MEDIA_READS=0
MEDIA_WRITES=0
STORAGE_UPLOADS=0
BUDGET_WRITES=0
BUDGET_RESERVATIONS=0
PHASE_COST=0¢
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
NEXT_AUTH=AUTH_VHS_APP_UPDATE_BLOCKERS_WORKFLOW_INTEGRATION_DOCS_SYNC_ONCE_NO_FLAG_WRITE
```

---

## 1. Autorisation consommée

`AUTH_VHS_APP_UPDATE_BLOCKERS_WORKFLOW_INTEGRATION_SYNC_AND_DEPLOY_ONCE_NO_FLAG_WRITE` — Christian, chat courant.

Un `git push` normal `main → origin/main` (`80cc7fa..7d1c34c`). Aucun force push. Aucun `vercel --prod`. Aucun MCP `deploy_to_vercel`. Aucune promotion. Aucun flag. Aucune mutation Production/Supabase hors auto-deploy Git. Les deux fichiers AICCOS restent dirty hors staging. RideCloud apply non consommée.

Le commit documentaire de **cette** porte reste **local** (pas de second push). Il n’est **pas** en Production.

`157_`–`176_` restent des snapshots immuables.

### Distinguer les SHA

| Pointeur | SHA | Rôle |
|---|---|---|
| Commit fonctionnel blockers | `045f48ad65cfd4fcd14e4a6942c1ccdead71c007` | câblage workflows · dans le tree servi |
| SHA du build Production | `7d1c34c0ff11c5ee7f279c7f7d7097629df45785` | commit docs `176_` · identité `/api/version` |
| Commit documentaire `177_` | local, non poussé | ce rapport · **non déployé** |

---

## 2. Git

| Champ | Attendu Auth | Réel initial | Après push | Après commit docs local |
|---|---|---|---|---|
| Branche | `main` | `main` | `main` | `main` |
| HEAD | `7d1c34c` | `7d1c34c` | `7d1c34c` | commit docs local (non poussé) |
| origin/main | `80cc7fa` | `80cc7fa` (fetch) | **`7d1c34c`** | **`7d1c34c`** |
| ahead/behind | `3/0` | `3/0` | `0/0` | **`1/0`** |
| Dirty protégés | 2 AICCOS | 2 AICCOS | 2 AICCOS | 2 AICCOS, non stagés |

Historique linéaire poussé, dans l’ordre :

1. `3f83f4f` — docs `175_` ;
2. `045f48a` — **unique** commit fonctionnel ;
3. `7d1c34c` — docs `176_`.

`sw.js`, manifest et les deux fichiers AICCOS **absents** de ces trois commits. Index vide avant et après le push. Aucun rebase / merge / amend / reset / restore / stash / cherry-pick / force push.

---

## 3. Préconditions avant push

- Fetch lecture seule. Branche `main`. HEAD `7d1c34c`. origin/main `80cc7fa`. Ahead/behind `3/0`.
- Tests ciblés **37/37** (update-blockers, policy, integration, wiring-source, app-update-client, pwa-register-source, director-processing).
- Secret scan officiel `findSecretHits` sur `80cc7fa..7d1c34c` : **0 hit**.
- Suite **1956/1956**, typecheck, lint et build local **réutilisés** depuis `176_` : aucun fichier fonctionnel changé depuis `045f48a` (diff `045f48a..7d1c34c` = docs only).
- Flags payants / média / Director **considérés OFF**. Aucune écriture.
- RideCloud apply **suspendue**.

---

## 4. Push et auto-déploiement

```text
git push origin main
80cc7fa..7d1c34c  main -> main
```

`GIT_PUSHES=1`. `FORCE_PUSHES=0`. `MANUAL_DEPLOY_CALLS=0`.

Baseline Production **avant** push (honnête, lecture seule) : alias `virtual-humans.vercel.app` servait `dpl_2Th9fGvk…` · `githubCommitSha=80cc7fa…` · `/api/version` `gitShaShort=80cc7fa`.

Auto-deploy GitHub observé (source=`git`, target=production, `githubDeployment=1`) :

| | Valeur redacted-safe |
|---|---|
| id | `dpl_82gNhGqe…` |
| host | `es3e5zdlm-…` |
| state | **READY** |
| `githubCommitSha` | **`7d1c34c0ff11c5ee7f279c7f7d7097629df45785`** |
| aliases | `virtual-humans.vercel.app` + git-main + team |
| `aliasError` | null |

`list_deployments` depuis l’heure du push : **un seul** déploiement. `get_deployment(virtual-humans.vercel.app)` = **le même** id. Alias Production **sert** `7d1c34c`.

---

## 5. `GET /api/version` Production

Host canonique : `https://virtual-humans.vercel.app/api/version`.

Deux GET, corps identiques, **200**, `Content-Type: application/json`, **aucun** `Set-Cookie` :

```json
{
  "version": "1.0.0",
  "gitSha": "7d1c34c0ff11c5ee7f279c7f7d7097629df45785",
  "gitShaShort": "7d1c34c",
  "buildId": "dpl_82gNhGqe…",
  "environment": "production",
  "deployedAt": null
}
```

- `gitSha` = SHA complet de `7d1c34c` fourni par Vercel.
- `gitShaShort` = `7d1c34c`.
- `buildId` = id du déploiement Ready.
- `deployedAt` = `null`.

Headers observés sur l’alias :

- `Cache-Control: no-store, max-age=0`
- `CDN-Cache-Control: no-store`
- `X-Vercel-Cache: MISS` · `Age: 0`

`Vercel-CDN-Cache-Control` **n’est pas renvoyé** par l’alias public. Le no-store reste prouvé par les deux headers visibles + MISS.

POST `/api/version` : **403** (proxy : seul GET est public). Aucun cookie. GET `/api/budget` sans session : **401** (`Accès protégé — connexion requise.`). Pas d’ouverture `/api/*`.

---

## 6. Pages publiques et blocker Production

Pages essentielles, lecture seule, sans login :

- `GET /login` **200** · `data-dpl-id` = `dpl_82gNhGqe…` · `PwaRegister` présent.
- `GET /offline` **200**.
- `GET /` et `GET /settings` sans session : **307** vers `/login` (proxy). Aucune erreur manifeste.
- Aucun cookie de session créé par ces lectures. Aucun appel provider ou média déclenché par le simple chargement HTML.

Aucune session utilisateur n’a été ouverte. Aucune génération, sauvegarde, mutation métier, `SKIP_WAITING` ou reload forcé.

Baseline version **API** honnête observée : `80cc7fa` → `7d1c34c`. Ce n’est **pas** une preuve E2E de blocker (pas d’onglet avec workflow actif + mise à jour waiting).

`REAL_BLOCKER_E2E_OBSERVED=0`. `SKIP_WAITING_DURING_BLOCKER_CHECK=0`. `RELOAD_DURING_BLOCKER_CHECK=0`.

Limite **déclarée**, pas un échec de porte. Les preuves fonctionnelles restent `176_` (suite 1956/1956 + tests ciblés 37/37) et le build Ready.

Invariants préservés : `sw.js` / manifest / `clients.claim()` / filtre docs-only / registre unique / AICCOS non câblé / dry-runs non bloqués / cleanup sans apply / Director non activé / providers OFF / RideCloud suspendu.

---

## 7. Compteurs

```text
SOURCE_HEAD=7d1c34c
FUNCTIONAL_COMMIT=045f48a
ORIGIN_MAIN_INITIAL=80cc7fa
ORIGIN_MAIN_FINAL=7d1c34c
LOCAL_COMMITS_PUSHED=3
FUNCTIONAL_COMMITS_PUSHED=1
GIT_PUSHES=1
FORCE_PUSHES=0
MANUAL_DEPLOY_CALLS=0
AUTO_DEPLOYS_OBSERVED=1
AUTO_DEPLOY_READY=1
DEPLOYED_GIT_SHA=7d1c34c
PRODUCTION_ALIAS_VERIFIED=1
API_VERSION_PRODUCTION_VERIFIED=1
API_VERSION_SHA_MATCH=1
PROTECTED_API_STILL_PROTECTED=1
REAL_BLOCKER_E2E_OBSERVED=0
SKIP_WAITING_DURING_BLOCKER_CHECK=0
RELOAD_DURING_BLOCKER_CHECK=0
UPDATE_BLOCKER_REGISTRIES_CREATED=0
AICCOS_BLOCKERS_INTEGRATED=0
SERVICE_WORKER_WRITES=0
MANIFEST_WRITES=0
FLAG_WRITES=0
PRODUCTION_DATA_WRITES=0
SUPABASE_MUTATIONS=0
PROVIDER_CALLS=0
TTS_CALLS=0
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

Ledger inchangé : hard **437¢** · committed **391¢** · reserved **0¢** · available **46¢**.

---

## 8. Limites restantes

- Commit docs `177_` **local**, non poussé. origin/main reste `7d1c34c`.
- Blocker E2E Production non observé (`REAL_BLOCKER_E2E_OBSERVED=0`).
- AICCOS non câblé. Deux fichiers AICCOS dirty hors Git.
- Filtre docs-only inchangé : `/api/version` reflète le SHA docs `7d1c34c`, pas seulement `045f48a`.
- `clients.claim()` peut encore recharger d’autres onglets après un `SKIP_WAITING` réussi (`sw.js` non modifié).
- Director, RideCloud apply, flags et providers restent OFF / suspendus.

---

## 9. Prochaine porte — non exécutée

```text
AUTH_VHS_APP_UPDATE_BLOCKERS_WORKFLOW_INTEGRATION_DOCS_SYNC_ONCE_NO_FLAG_WRITE
```

Porte documentaire bornée : synchroniser le rapport local `177_` vers `origin/main`. **0 flag.** **0** déploiement manuel. Puis retour au développement fonctionnel du Studio.

Ne pas exécuter pendant cette phase. L’activation du Réalisateur IA, le filtre des builds docs-only, AICCOS, RideCloud et les phases média restent hors périmètre.
