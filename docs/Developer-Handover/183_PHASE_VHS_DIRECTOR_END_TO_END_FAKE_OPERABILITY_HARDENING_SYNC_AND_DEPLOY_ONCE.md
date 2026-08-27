# 183 — VHS Director end-to-end fake operability hardening sync and deploy once

**Date :** 2026-08-27 / 2026-08-28  
**Auth :** `AUTH_VHS_DIRECTOR_END_TO_END_FAKE_OPERABILITY_HARDENING_SYNC_AND_DEPLOY_ONCE_NO_PROVIDER_NO_FLAG_WRITE`  
**Nature :** **1** push `main` · auto-deploy GitHub Production · lecture seule `/api/version` · **0** moteur · **0** flag · **0** second push  
**HEAD au départ :** `ad4a909`  
**SHA fonctionnel hardening :** `d376a7c`  
**SHA du build Production :** `ad4a909`  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_DIRECTOR_END_TO_END_FAKE_OPERABILITY_HARDENING_SYNC_AND_DEPLOY_ONCE_READY
SOURCE_HEAD=ad4a909
FUNCTIONAL_COMMIT=d376a7c
ORIGIN_MAIN_INITIAL=26e9b02
ORIGIN_MAIN_FINAL=ad4a909
LOCAL_COMMITS_PUSHED=2
FUNCTIONAL_COMMITS_PUSHED=1
GIT_PUSHES=1
FORCE_PUSHES=0
MANUAL_DEPLOY_CALLS=0
AUTO_DEPLOYS_OBSERVED=1
AUTO_DEPLOY_READY=1
DEPLOYED_GIT_SHA=ad4a909
PRODUCTION_ALIAS_VERIFIED=1
API_VERSION_PRODUCTION_VERIFIED=1
API_VERSION_SHA_MATCH=1
PROTECTED_API_STILL_PROTECTED=1
DIRECTOR_OPERABILITY_UI_PRODUCTION_OBSERVED=0
PROVIDER_NETWORK_ATTEMPTS=0
PRODUCTION_SUPABASE_ATTEMPTS=0
PRODUCTION_STORAGE_ATTEMPTS=0
REAL_GENERATIONS=0
REAL_LIPSYNC_SUBMITS=0
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
FLAG_WRITES=0
PRODUCTION_DATA_WRITES=0
SUPABASE_MUTATIONS=0
PROVIDER_CALLS=0
MEDIA_READS=0
MEDIA_WRITES=0
STORAGE_UPLOADS=0
BUDGET_WRITES=0
PHASE_COST=0¢
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
```

---

## 1. Autorisation consommée

`AUTH_VHS_DIRECTOR_END_TO_END_FAKE_OPERABILITY_HARDENING_SYNC_AND_DEPLOY_ONCE_NO_PROVIDER_NO_FLAG_WRITE` — Christian, chat courant.

Un `git push` normal `main → origin/main` (`26e9b02..ad4a909`). Aucun force push. Aucun `vercel --prod`. Aucun MCP `deploy_to_vercel`. Aucune promotion. Aucun rollback. Aucun flag. Aucun moteur. Aucune mutation Production/Supabase hors auto-deploy Git. Les deux fichiers AICCOS restent dirty hors staging. RideCloud apply non consommée.

Le commit documentaire de **cette** porte reste **local** (pas de second push). Il n’est **pas** en Production.

`157_`–`182_` restent des snapshots immuables.

### Distinguer les SHA

| Pointeur | SHA | Rôle |
|---|---|---|
| Commit fonctionnel hardening | `d376a7c4fa273641336b939e73f03a8207428e68` | UX fake · pipeline · Lipsync/Merge · barrière · tests · **dans le tree servi** |
| SHA du build Production | `ad4a90964452f2562967a165fb933c52185f8470` | commit docs `182_` · identité `/api/version` |
| Commit documentaire `183_` | local, non poussé | ce rapport · **non déployé** |

Ce n’est **pas** une validation provider, ni une preuve UI Director en Production, ni un parcours réel.

---

## 2. Git

| Champ | Attendu Auth | Réel initial | Après push | Après commit docs local |
|---|---|---|---|---|
| Branche | `main` | `main` | `main` | `main` |
| HEAD | `ad4a909` | `ad4a909` | `ad4a909` | commit docs local (non poussé) |
| origin/main | `26e9b02` | `26e9b02` (fetch) | **`ad4a909`** | **`ad4a909`** |
| ahead/behind | `2/0` | `2/0` | `0/0` | **`1/0`** |
| Dirty protégés | 2 AICCOS | 2 AICCOS | 2 AICCOS | 2 AICCOS, non stagés |

Historique linéaire poussé, dans l’ordre :

1. `d376a7c` — **unique** commit fonctionnel ;
2. `ad4a909` — docs `182_`.

`sw.js`, manifest, migrations et les deux fichiers AICCOS **absents** de ces deux commits. Index vide avant et après le push. Aucun rebase / merge / amend / reset / restore / stash / cherry-pick / force push.

---

## 3. Préconditions avant push

- Fetch lecture seule. Branche `main`. HEAD `ad4a909`. origin/main `26e9b02`. Ahead/behind `2/0`.
- Historique linéaire : `d376a7c` parent de `ad4a909` · `26e9b02` parent de `d376a7c`.
- Tests ciblés **39/39** (pipeline, Lipsync view, Merge/Export view, fake adapter, blockers, fraîcheur).
- Secret scan officiel `findSecretHits` :
  - rapport `182_` : **0 hit** ;
  - plage `26e9b02..ad4a909` : **2 motifs classés**, aucun secret :
    1. ligne **supprimée** d’un data-URL PNG inline dans le fake adapter (retrait du `dataUrl` — le hardening lui-même) ;
    2. fixture E2E d’URL signée factice `example.com` dans le spec barrière (preuve fail-closed, pas une URL réelle).
- Suite **2006/2006**, Playwright **38/38**, typecheck, lint et build local **réutilisés** depuis `182_` : aucun fichier fonctionnel changé depuis `d376a7c`.
- Fake adapter : `source.kind=internal` · **aucun** `dataUrl`. Barrière locale fail-closed. `mergeExportAuthorized=false`.
- Director Production OFF. Providers OFF. Ledger **437 / 391 / 0 / 46**. RideCloud apply **suspendue**.

---

## 4. Push et auto-déploiement

```text
git push origin main
26e9b02..ad4a909  main -> main
```

`GIT_PUSHES=1`. `FORCE_PUSHES=0`. `MANUAL_DEPLOY_CALLS=0`.

Baseline Production **avant** push (honnête, lecture seule) : alias `virtual-humans.vercel.app` servait `dpl_9BrcuXvc…` · `githubCommitSha=26e9b02…`.

Auto-deploy GitHub observé (source=`git`, target=production, `githubDeployment=1`) :

| | Valeur redacted-safe |
|---|---|
| id | `dpl_9nsHqHin…` |
| host | `8nk8hiofk-…` |
| state | **READY** |
| `githubCommitSha` | **`ad4a90964452f2562967a165fb933c52185f8470`** |
| aliases | `virtual-humans.vercel.app` + git-main + team |
| `aliasError` | null |
| `readyState` | READY |

`inspect(virtual-humans.vercel.app)` = **le même** id. Alias Production **sert** `ad4a909`. Le tree applicatif inclut `d376a7c`.

---

## 5. `GET /api/version` Production

Host canonique : `https://virtual-humans.vercel.app/api/version`.

GET **200**, `Content-Type: application/json`, **aucun** `Set-Cookie` :

```json
{
  "version": "1.0.0",
  "gitSha": "ad4a90964452f2562967a165fb933c52185f8470",
  "gitShaShort": "ad4a909",
  "buildId": "dpl_9nsHqHin…",
  "environment": "production",
  "deployedAt": null
}
```

- `gitSha` = SHA complet de `ad4a909` fourni par Vercel.
- `gitShaShort` = `ad4a909`.
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

`DIRECTOR_OPERABILITY_UI_PRODUCTION_OBSERVED=0` — **attendu**, pas un échec. La preuve fonctionnelle reste locale et synthétique (`182_`).

---

## 7. Invariants conservés (code déployé + tests)

| Invariant | Preuve |
|---|---|
| Barrière réseau locale fail-closed | `network-barrier.ts` · abort hors localhost · tests E2E |
| Aucun `dataUrl` fake | `fake-universal-adapter.ts` · `source.kind=internal` |
| Aucun téléchargement présenté comme succès | Delivery sans ancre download · 0 lien publication |
| Manifeste explicitement synthétique | `director-synthetic-export-manifest` |
| Aucune publication | `mergeExportAuthorized=false` |
| Progression UI sans claim réel | pipeline `done\|current\|locked\|prepared_disabled` |
| Prérequis Lipsync/merge cohérents | `videoResolved` / `audioResolved` · boutons réels disabled |
| Aucun sélecteur provider | vues Lipsync / Merge |
| Blockers sur registre unique | 0 nouveau registre · AICCOS non câblé |
| Aucun `SKIP_WAITING` / reload ajouté | `sw.js` absent du push |

Aucune validation moteur réelle. Aucun claim de parcours Production réel.

---

## 8. Ledger, AICCOS, RideCloud

Ledger inchangé : **437 / 391 / 0 / 46**.  
AICCOS : dirty, non stagés, absents du push.  
RideCloud apply : **SUSPENDED_NOT_CONSUMED**.

---

## 9. Limites restantes

- UI `/director` complète non observée en Production (flag OFF + pas de session).
- Aucun moteur réel Lipsync / merge / export.
- Export réel toujours interdit.
- Assets I2V/Voice restent privés et inactifs.
- Ce rapport `183_` n’est **pas** déployé.

---

## 10. Prochaine porte — non exécutée

```text
AUTH_VHS_DIRECTOR_END_TO_END_FAKE_OPERABILITY_HARDENING_DOCS_SYNC_ONCE_NO_PROVIDER_NO_FLAG_WRITE
```

Synchroniser administrativement ce rapport local `183_` **sans** créer une nouvelle boucle de rapports numérotés.

Ensuite, Christian et Léo décideront entre une ouverture UI-only contrôlée du Director et le preflight d’une première capacité réelle. Aucune activation ni dépense n’est implicite.

Toute exécution réelle, sélection de moteur, publication ou téléchargement exige une Auth humaine séparée.
