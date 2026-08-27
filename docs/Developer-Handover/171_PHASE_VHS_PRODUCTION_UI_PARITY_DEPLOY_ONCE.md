# 171 — Production UI parity deploy once

**Date :** 2026-08-27  
**Auth :** `AUTH_VHS_PRODUCTION_UI_PARITY_DEPLOY_ONCE_NO_FLAG_WRITE`  
**Nature :** unique déploiement Production de `e4703bf` · **0** flag write · **0** AICCOS · **0** second appel  
**HEAD au départ :** `e4703bf` (`170_` SHA record)  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_PRODUCTION_UI_PARITY_DEPLOY_ONCE_READY
PHASE_COST = 0¢
DEPLOY_CALLS = 0
GIT_PRODUCTION_DEPLOYS_OF_E4703BF = 1
DEPLOYS_READY = 1
DEPLOY_RETRIES = 0
FLAG_WRITES = 0
FUNCTIONAL_FILES_CHANGED = 0
PRODUCTION_WRITES_OTHER_THAN_DEPLOY = 0
VERCEL_MUTATIONS = 0
SUPABASE_MUTATIONS = 0
PROVIDER_CALLS = 0
TTS_CALLS = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
STORAGE_UPLOADS = 0
BUDGET_WRITES = 0
AICCOS_FILES_STAGED = 0
AICCOS_FILES_COMMITTED = 0
GIT_SHA_DEPLOYED_PROVEN = true
LIVE_SDK_STRING_PROVEN = false
RIDECLOUD_APPLY = SUSPENDED_NOT_CONSUMED
NEXT_AUTH = AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_PREFLIGHT_NO_DEPLOY_NO_FLAG_WRITE
```

---

## 1. Autorisation consommée

`AUTH_VHS_PRODUCTION_UI_PARITY_DEPLOY_ONCE_NO_FLAG_WRITE` — Christian, chat courant.

Objectif : publier les deux corrections déjà committées (`169_` tracing `SDK_VERSION` · `170_` cartes dashboard) **sans** activer le Réalisateur IA.

Cette Auth **n’a pas** appelé `vercel --prod`, `vercel deploy`, ni MCP `deploy_to_vercel`. Un déploiement GitHub Production **Ready** de l’état exact `e4703bf` existait déjà. Un second appel aurait violé « aucun second déploiement / retry ».

`AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_PREFLIGHT_NO_DEPLOY_NO_FLAG_WRITE` **non exécutée**. Aucune implémentation `/api/version`.

RideCloud `AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_APPLY_ONCE_NO_PROVIDER` **non consommée**.

`157_`–`170_` restent des snapshots immuables.

## 2. Git avant action

| Champ | Attendu | Réel |
|---|---|---|
| Branche | `main` | `main` |
| HEAD / origin/main | `e4703bf` | **`e4703bf`** |
| ahead / behind | 0 / 0 | **0 / 0** |
| Index | vide | **vide** |
| `page.tsx` | propre | **propre** · `overview.documents` absent |
| Dirty | 2 AICCOS | **exact** |

Tests ciblés `169_`+`170_` : **14/14**. Typecheck **PASS**.

## 3. Cible Vercel (lecture seule)

| | |
|---|---|
| Projet | `virtual-humans` · `prj_NTK8…GKdP` |
| Team | `javachrist-projects` · `team_HGXX…d87N` |
| Framework | Next.js |
| Git | GitHub `JavaChrist/Virtual-Humans` · `main` |
| Alias Production | `virtual-humans.vercel.app` |

`DIRECTOR_V2_ENABLED` : présent Encrypted Production, **créé il y a 23 j**. Aucune écriture cette porte. Les flags paid/worker/VHS/Motion **non touchés**.

Protection : SSO Vercel `all_except_custom_domains` · password Vercel **off**. Auth applicative `APP_PASSWORD` **inchangée**.

Aucune écriture de flag n’est nécessaire pour publier tracing + cartes.

## 4. Méthode de déploiement — exclusion du working tree dirty

Le projet est lié GitHub (`githubDeployment=1`, `source=git`). Un push sur `main` déclenche un clone **côté Vercel** du SHA Git, **pas** un upload du disque local.

Conséquence : les deux fichiers AICCOS dirty **ne peuvent pas** être embarqués. Cette propriété a été vérifiée **avant** tout appel : le déploiement Ready de `e4703bf` est déjà `source=git`.

Aucun `vercel --prod` depuis le working tree (cela aurait pu uploader les AICCOS). Aucun MCP `deploy_to_vercel` (upload fichier).

## 5. Déploiement unique de `e4703bf`

Créé par l’auto-deploy GitHub du push `170_` (`7453858..e4703bf`), **avant** cette Auth. Le tip poussé était `e4703bf` (contient `67eb7fe` cartes + `1a0978c` tracing).

| | Valeur redacted-safe |
|---|---|
| id | `dpl_41zVp38…` |
| host | `l8dxm473r-…` |
| created | 2026-08-27 **15:15:58 +02** |
| ready | 2026-08-27 **15:20:50 +02** |
| state | **READY** |
| target | Production |
| source | **git** |
| `githubCommitSha` | **`e4703bf22ffa82bd99e303113e5198522223c60a`** |
| aliases | `virtual-humans.vercel.app` + git-main + team |
| `aliasError` | null |

Preuve alias HTML login : `data-dpl-id="dpl_41zVp38FLxG49JQFeCU2f8sedAoR"`.

`get_deployment(virtual-humans.vercel.app)` = **le même** id.

Appels de déploiement **pendant cette Auth : 0**. Retries : **0**. Ready du SHA demandé : **1**.

Le push ultérieur de **cette documentation** déclenchera un auto-deploy GitHub d’un SHA docs. Le tree applicatif (tracing + cartes) reste le même. Le `githubCommitSha` Production **ne restera pas** `e4703bf` après ce push docs. Ne pas traiter ce SHA docs comme un runtime image (`245bea2`).

## 6. Preuves Production (read-only)

### A. SDK

| Preuve | Résultat |
|---|---|
| SHA déployé = `e4703bf` | **oui** · meta GitHub Vercel |
| Tree `e4703bf` contient tracing `../SDK_VERSION` (`169_`) | **oui** |
| Fichier Git `SDK_VERSION` | `1.0.0` |
| `GET /api/character` public | **401** `Accès protégé — connexion requise.` |
| Chaîne live `SDK 1.0.0` | **non observée** (mur `APP_PASSWORD`) |

`LIVE_SDK_STRING_PROVEN=false`. Pas de contournement d’authentification. Le runtime déployé **est** le commit qui embarque `SDK_VERSION` (NFT local `169_` + SHA Production).

### B. Cartes documentaires

HEAD `page.tsx` : `overview.documents` **absent**. HTML login Production : pas de `00_IDENTITY` / `01_APPEARANCE` / `02_PERSONALITY` / `04_VOICE`.

Nav layout (login, prerender) **conserve** Studio Image, Studio Voix, Studio Vidéo. La page dashboard elle-même est derrière 307 → `/login` : extraits `overview.documents` **non rendus** publiquement ; le code committé ne les mappe plus.

Métriques dashboard (Dépense estimée, Comportements, Templates) : présentes dans `page.tsx` committé. Layout login affiche aussi un cumul « Dépense estimée » (nav), distinct des cartes documentaires.

### C. Réalisateur IA

Flag **non écrit**. Nav prerender login : **pas** de lien Réalisateur IA (insertion client via `/api/settings`, 401 sans session). Absence **attendue** si Production reste OFF. **Pas un échec** de cette porte.

### D. PWA / cache

| | |
|---|---|
| `GET /` | 307 → `/login?next=%2F` · `Cache-Control: private, no-store` |
| `GET /login` | 200 · `X-Vercel-Cache: PRERENDER` · `Age: 0` |
| `GET /sw.js` | 200 · `no-cache, no-store, must-revalidate` · `X-Vercel-Cache: HIT` · `Age: 183` · `Last-Modified: 13:21:45 UTC` |
| SW | `vh-studio-v12` · pas de `skipWaiting` auto · modale `SKIP_WAITING` inchangée |

Un onglet déjà contrôlé par un ancien SW peut rester sur l’ancienne UI jusqu’à rechargement / acceptation de la modale existante. **Aucun** changement de SW cette porte. HTML login frais (`Age: 0`) = nouvelle réponse serveur pour une navigation non authentifiée.

### E. SHA

`GIT_SHA_DEPLOYED_PROVEN=true` — `meta.githubCommitSha` Vercel = `e4703bf` + `source=git`. Ce n’est **pas** un endpoint `/api/version` (non implémenté). CLI `gitSource=null` de `168_` ne s’applique pas à cette lecture MCP. Une corrélation horaire n’est **pas** la preuve : le SHA GitHub est la preuve.

## 7. Hors périmètre confirmé

- 0 flag write  
- 0 mutation Supabase  
- 0 provider / TTS / média / Storage / budget  
- 0 apply RideCloud  
- 2 AICCOS dirty, non stagés, non commités  

## 8. Prochaine autorisation exacte — non exécutée

**`AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_PREFLIGHT_NO_DEPLOY_NO_FLAG_WRITE`**

Audit/conception seulement : `/api/version`, SHA build, comparaison client/serveur, SW existant, notification, application contrôlée. **Aucune implémentation** ici.

RideCloud apply reste **suspendue**.

STOP.
