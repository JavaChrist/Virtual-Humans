# 190 — VHS Director persistence Production enablement hardening sync and deploy

**Date :** 2026-08-28  
**Auth :** `AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_HARDENING_SYNC_AND_DEPLOY_NO_FLAG_WRITE_NO_PROVIDER`  
**Nature :** **1** push `main` · unique auto-deploy GitHub Production · lecture seule · **0** flag write · **0** provider · **0** second push  
**HEAD au départ :** `1cadcb0`  
**SHA fonctionnel hardening :** `a785949`  
**SHA synchronisé et servi :** `1cadcb0`  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_HARDENING_SYNC_AND_DEPLOY_READY
SOURCE_HEAD=1cadcb0
FUNCTIONAL_COMMIT=a785949
ORIGIN_MAIN_INITIAL=baa92c4
ORIGIN_MAIN_FINAL=1cadcb0
LOCAL_COMMITS_PUSHED=5
FUNCTIONAL_COMMITS_PUSHED=1
GIT_PUSHES=1
FORCE_PUSHES=0
MANUAL_DEPLOY_CALLS=0
AUTO_DEPLOYS_OBSERVED=1
AUTO_DEPLOY_READY=1
DEPLOYED_GIT_SHA=1cadcb0
PRODUCTION_ALIAS_VERIFIED=1
API_VERSION_PRODUCTION_VERIFIED=1
API_VERSION_SHA_MATCH=1
PROTECTED_API_STILL_PROTECTED=1
DIRECTOR_FLAG_VALUE_FINAL=ON
DIRECTOR_PERSISTENCE_ENABLED=0
DIRECTOR_RUNTIME_FLAGS_ENABLED=0
FLAG_WRITES=0
PRODUCTION_PROJECTS_CREATED=0
PRODUCTION_PROJECTS_UPDATED=0
PRODUCTION_DATA_WRITES=0
SUPABASE_MUTATIONS=0
PROVIDER_CALLS=0
BUDGET_WRITES=0
BUDGET_RESERVATIONS=0
RUNS_CREATED=0
JOBS_CREATED=0
MEDIA_READS=0
MEDIA_WRITES=0
STORAGE_CALLS=0
SIGNED_URLS_CREATED=0
DOWNLOADS_TRIGGERED=0
ASSETS_ACTIVATED=0
ASSETS_PUBLISHED=0
MERGE_EXPORT_AUTHORIZED=0
PHASE_COST=0¢
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
```

---

## 1. Autorisation consommée

`AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_HARDENING_SYNC_AND_DEPLOY_NO_FLAG_WRITE_NO_PROVIDER` — Christian, chat courant.

Un `git push` normal `main → origin/main` (`baa92c4..1cadcb0`). Observation de l’unique auto-déploiement GitHub Production. Vérifications lecture seule. **Aucun** second push. **Aucun** force-push. **Aucun** `vercel --prod`. **Aucun** MCP `deploy_to_vercel`. **Aucune** promotion. **Aucun** rollback. **Aucune** écriture de flag. **Aucun** provider. **Aucune** session métier Production. **Aucune** mutation projet / brief / budget / run / job / média / Storage. RideCloud apply **non consommée**.

Le commit documentaire de **cette** porte reste **local** (pas de second push). Il n’est **pas** en Production. Ne pas créer `191_`.

`157_`–`189_` restent des snapshots immuables.

### Distinguer les SHA

| Pointeur | SHA | Rôle |
|---|---|---|
| Commit fonctionnel hardening | `a78594910a3d61939f0408daf612270ce8a86e8a` | refuse pipeline si persistence seule · **dans le tree servi** |
| SHA synchronisé / servi Production | `1cadcb070828dcca3ccd8a04e22eb3c01d417060` | tip poussé · identité `/api/version` · auto-deploy Ready |
| origin/main initial | `baa92c4ab8638677214c6af8565e2191020d44bb` | SHA servi **avant** ce push (`185_`) |
| Commit documentaire `190_` | local, non poussé | ce rapport · **non déployé** |

Ce n’est **pas** une activation persistence, ni une validation provider, ni une session Production.

---

## 2. Git

| Champ | Attendu Auth | Réel initial | Après push | Après commit docs local |
|---|---|---|---|---|
| Branche | `main` | `main` | `main` | `main` |
| HEAD | `1cadcb0` | `1cadcb0` | `1cadcb0` | commit docs local (non poussé) |
| origin/main | `baa92c4` | `baa92c4` (fetch) | **`1cadcb0`** | **`1cadcb0`** |
| ahead/behind | `5/0` | `5/0` | `0/0` | **`1/0`** |
| Dirty protégés | 2 AICCOS | 2 AICCOS | 2 AICCOS | 2 AICCOS, non stagés |
| Index | vide | vide | vide | vide |

Historique linéaire poussé, dans l’ordre :

1. `4713d33` — docs `186_` ;
2. `a785949` — **unique** commit fonctionnel ;
3. `9dce256` — docs `187_` ;
4. `732875c` — docs `188_` ;
5. `1cadcb0` — docs `189_`.

`git merge-base --is-ancestor a785949 1cadcb0` = **0**. Le hardening est dans le tree servi.

Plage `baa92c4..1cadcb0` : **0** fichier AICCOS · **0** migration nouvelle · **0** fichier env/flag · **0** `sw.js` / manifest · **0** secret (`findSecretHits` = `[]`). Aucun rebase / merge / amend / reset / restore / stash / cherry-pick / force push.

---

## 3. Préconditions avant push

- Fetch lecture seule. Branche `main`. HEAD `1cadcb0`. origin/main `baa92c4`. Ahead/behind `5/0`.
- Index vide. Dirty = uniquement les deux AICCOS.
- Recheck `189_` réutilisé comme preuve locale principale : DB **35/35** · Playwright **5/5** · `PERSISTENCE_DURABLE_E2E_SKIPPED=0` · adversariaux **21/21** · unitaires **2065/2065** · typecheck / lint / build PASS.
- Tests ciblés relancés avant push : policy / quota / refus persistence-only **PASS**. Fraîcheur living : échec attendu (`nextPhase` déjà cette Auth) — corrigé avec ce commit docs.
- Baseline Production **avant** push : alias `virtual-humans.vercel.app` = `dpl_8Bq6MJ72…` · `githubCommitSha=baa92c4…` · `/api/version` `gitShaShort=baa92c4`.
- Ledger **437 / 391 / 0 / 46**. RideCloud apply **suspendue**.

---

## 4. Push et auto-déploiement

```text
git push origin main
baa92c4..1cadcb0  main -> main
```

`GIT_PUSHES=1`. `FORCE_PUSHES=0`. `MANUAL_DEPLOY_CALLS=0`.

Auto-deploy GitHub observé (source=`git`, target=`production`, `githubDeployment=1`) :

| | Valeur redacted-safe |
|---|---|
| id | `dpl_7mdw4kLr…` |
| host | `crr8q13u9-…` |
| state | **READY** |
| `githubCommitSha` | **`1cadcb070828dcca3ccd8a04e22eb3c01d417060`** |
| aliases | `virtual-humans.vercel.app` + git-main + team |
| `aliasError` | null |
| `readyState` | READY |

`get_deployment(virtual-humans.vercel.app)` = **le même** id. Alias Production **sert** `1cadcb0`. Le tree applicatif inclut `a785949`.

Un seul déploiement Production nouveau depuis le push. Aucun déploiement manuel.

---

## 5. `GET /api/version` Production

Host canonique : `https://virtual-humans.vercel.app/api/version`.

GET **200**, `Content-Type: application/json`, **aucun** `Set-Cookie` :

```json
{
  "version": "1.0.0",
  "gitSha": "1cadcb070828dcca3ccd8a04e22eb3c01d417060",
  "gitShaShort": "1cadcb0",
  "buildId": "dpl_7mdw4kLrRfgyRrtneQCTmxtUQegG",
  "environment": "production",
  "deployedAt": null
}
```

- `gitSha` = SHA complet de `1cadcb0` fourni par Vercel.
- `gitShaShort` = `1cadcb0`.
- `buildId` = id du déploiement Ready observé.
- `deployedAt` = `null`.

Headers observés sur l’alias :

- `Cache-Control: no-store, max-age=0`
- `CDN-Cache-Control: no-store`

---

## 6. Protections non authentifiées

Lecture seule, **sans** cookie, **sans** session métier :

| Contrôle | Résultat |
|---|---|
| `POST /api/version` | **403** |
| `GET /api/budget` | **401** |
| `GET /director` | **307** → `/login?next=%2Fdirector` |
| `GET /api/director/projects` | **401** |
| `GET /api/settings` | **401** (pas de session — Auth l’interdit) |

`PROTECTED_API_STILL_PROTECTED=1`. Aucune route persistante n’a été exercée avec une session Production.

---

## 7. Configuration runtime (source officielle, lecture seule)

Source officielle déjà utilisée (`185_`) : inventaire Vercel `vercel env ls production` (noms + `Encrypted` / présence, **jamais** les valeurs) + parseur `parseStrictEnabledFlag` (ON seulement `"1"` / `"true"` ; Encrypted pull = EMPTY = fail-closed **OFF**) + écriture unique `DIRECTOR_V2_ENABLED=1` du `185_` et **zéro** écriture de flag depuis.

`GET /api/settings` live n’est **pas** relu : 401 sans session, et cette Auth interdit toute session Production.

| Flag / famille | Inventaire Production | Effectif retenu |
|---|---|---|
| `DIRECTOR_V2_ENABLED` | Encrypted présent | **ON** — unique write `185_` · `FLAG_WRITES=0` depuis |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | Encrypted présent | **OFF** — jamais écrit ON · fail-closed EMPTY |
| Directors AI (8) | Encrypted présents | **OFF** |
| Paid generation / worker | Encrypted présents | **OFF** |
| Harness E2E (3) | **ABSENT** | **OFF** |
| 11A exception | Encrypted présent | **OFF** |
| 11B (6) / 11C (6) | Encrypted présents | **OFF** |
| 11D (6) / 11E (7) | **ABSENT** | **OFF** |
| Motion (4 présents + fake harness) | Encrypted / **ABSENT** fake harness | **OFF** |

`FORBIDDEN_ON=none`. `DIRECTOR_RUNTIME_FLAGS_ENABLED=0`. `mergeExportAuthorized=false`. Aucune commande `vercel env add` / `update` / `rm`.

---

## 8. Hardening servi

`a785949` est un ancêtre de `1cadcb0`. Le SHA servi par l’alias est `1cadcb0`. Le catalogue 25 routes, le quota 50 et le refus persistence-only sont donc dans l’image Ready.

Aucune route persistante n’a été appelée avec une session Production. La preuve fonctionnelle du hardening reste `189_` (locale) + ancestry Git.

---

## 9. Tests ciblés

Relancés (policy / quota / refus persistence-only) : **PASS**.

Preuve locale principale **réutilisée** depuis `189_` (aucun fichier métier changé depuis `a785949`) :

- DB locale **35/35**
- Playwright **5/5** · skip durable **0**
- Adversariaux **21/21**
- Unitaires **2065/2065**
- Typecheck / lint / build **PASS**

Fraîcheur living : alignée par ce commit docs. Stack Supabase locale **laissée running**. Docker Desktop **non arrêté**. Volumes **conservés**.

---

## 10. Ledger, AICCOS, RideCloud

Ledger inchangé : **437 / 391 / 0 / 46**.  
AICCOS : dirty, non stagés, absents du push et de ce commit.  
RideCloud apply : **SUSPENDED_NOT_CONSUMED**.  
`PHASE_COST=0¢`.

---

## 11. Limites restantes

- Persistence Production **toujours OFF**.
- Aucune session `/director` Production dans cette porte.
- Aucun moteur réel, aucun média, aucun budget write.
- Ce rapport `190_` n’est **pas** déployé.

---

## 12. Prochaine porte — non exécutée

```text
AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_HARDENING_DOCS_SYNC_ONCE_NO_FLAG_WRITE_NO_PROVIDER
```

Publier uniquement ce rapport `190_`, **sans** nouvelle boucle documentaire `191_`.

Ensuite seulement, Christian et Léo décideront d’une autorisation **distincte** pour écrire `DIRECTOR_V2_PERSISTENCE_ENABLED=1` et effectuer des validations Production bornées.

**STOP.**
