# 172 — VHS app update versioning and notification preflight

**Date :** 2026-08-27  
**Auth :** `AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_PREFLIGHT_NO_DEPLOY_NO_FLAG_WRITE`  
**Nature :** audit PWA + contrat déterministe `/api/version` · **0** implémentation runtime · **0** deploy manuel · **0** flag write  
**HEAD au départ :** `c808fa2` (`171_` SHA record)  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_PREFLIGHT_READY
RUNTIME_FILES_CHANGED = 0
API_ROUTES_CREATED = 0
SERVICE_WORKER_WRITES = 0
DEPLOY_CALLS = 0
FLAG_WRITES = 0
PRODUCTION_WRITES = 0
SUPABASE_MUTATIONS = 0
PROVIDER_CALLS = 0
TTS_CALLS = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
STORAGE_UPLOADS = 0
BUDGET_WRITES = 0
PHASE_COST = 0¢
AICCOS_FILES_STAGED = 0
AICCOS_FILES_COMMITTED = 0
RIDECLOUD_APPLY = SUSPENDED_NOT_CONSUMED
NEXT_AUTH = AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_IMPLEMENT_NO_DEPLOY_NO_FLAG_WRITE
```

---

## 1. Autorisation consommée

`AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_PREFLIGHT_NO_DEPLOY_NO_FLAG_WRITE` — Christian, chat courant.

Preflight uniquement. Aucune route `/api/version`. Aucune modification de `pwa-register.tsx`, `sw.js` ou du manifest. Aucun déploiement manuel. Aucun flag Vercel. Aucune mutation Production/Supabase. Aucun provider / TTS / média / Storage. Les deux fichiers AICCOS restent dirty hors staging. RideCloud apply non consommée. La porte d’implémentation n’est pas exécutée.

`157_`–`171_` restent des snapshots immuables.

## 2. Git

| Champ | Attendu Auth | Réel |
|---|---|---|
| Branche | `main` | `main` |
| HEAD | `c808fa2` | `c808fa25d684fe1835bb574e8625cda1ea686096` |
| origin/main | `c808fa2` | identique |
| ahead/behind | `0/0` | `0/0` |
| Index | vide | vide |
| Dirty protégés | 2 AICCOS | `studio/src/app/api/aiccos/send/route.ts` · `studio/src/components/send-to-aiccos.tsx` |
| `studio/src/app/page.tsx` | propre | propre |

Aucun reset, restore ou stash.

## 3. Déploiements (lecture seule)

| Déploiement | SHA Git | Rôle |
|---|---|---|
| `dpl_41zVp38…` / host `l8dxm473r-…` | `e4703bf` | **déploiement applicatif prouvé** (`171_`) · Ready 15:20:50+02 |
| `dpl_EUEqB8…` / host `kisy3xdci-…` | `c808fa2` | **auto-deploy GitHub documentaire** · `source=git` · Ready · **alias Production actuel** |

`get_deployment(virtual-humans.vercel.app)` : alias porté par `dpl_EUEqB8ZzrKWULgG5YFyA1M9jTGxH`, `githubCommitSha=c808fa2`, `source=git`. Non relancé. Le tree applicatif Studio est le même que `e4703bf` (commits docs `75b5e57` / `c808fa2`). Ne pas promouvoir `c808fa2` comme un nouveau runtime image.

Production reste liée à GitHub (`githubDeployment=1`). RideCloud apply = `SUSPENDED_NOT_CONSUMED`.

## 4. Architecture PWA actuelle

Point d’entrée unique : `studio/src/components/pwa-register.tsx`, monté **une fois** dans `studio/src/app/layout.tsx` **hors** `ConfirmProvider` (modale dédiée, pas `useConfirm`).

### Enregistrement

- ON si `NODE_ENV=production`.
- OFF en `next dev` sauf `NEXT_PUBLIC_VH_PWA_LOCAL=1|true` (alors unregister + purge caches).
- `navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })`.
- Pas d’attente de `window.load` (useEffect Next arrive souvent trop tard).

### Détection (service worker seulement)

- `reg.update()` immédiat après register.
- Intervalle **60 s**.
- `visibilitychange` (si visible) + `window` `focus`.
- `updatefound` → `installing` `statechange` `installed` + `controller` → `setWaiting`.
- `reg.waiting` immédiat aussi.
- Aucun `/api/version`. Aucun SHA visible. Aucun `BroadcastChannel`.

### Modale

Titre « Mise à jour disponible ». Boutons « Plus tard » / « Mettre à jour ». Style `card` overlay `z-[200]`.

- **Plus tard** = `setWaiting(null)`. Le worker **reste waiting**. La modale **revient** au prochain `check` (60 s / focus).
- **Mettre à jour** = `waiting.postMessage("SKIP_WAITING")`. Pas de garde contre un second clic.

### Service worker `studio/public/sw.js`

- Cache `vh-studio-v12`. Pas de `skipWaiting` à l’install.
- Message `SKIP_WAITING` → `skipWaiting()`.
- `activate` : purge caches ≠ `vh-studio-v12` + `clients.claim()`.
- **N’intercept jamais `/api/*` ni `/sw.js`.**
- Navigations network-first ; `/director|/login|/settings|/budget` network-only ; `/_next/` network-first + put cache ; icônes/manifest cache-first.

### Headers

`next.config.ts` : `/sw.js` = `no-cache, no-store, must-revalidate` + `Service-Worker-Allowed: /`. `/api/:path*` = `private, no-store, no-cache, must-revalidate`. Le CDN Vercel peut quand même servir un HIT court sur `/sw.js` (`171_`) ; `updateViaCache: "none"` reste la mitigation.

### Anti-boucle actuelle

Un flag `reloaded` sur `controllerchange` seulement. Pas de dédup des `reg.update()` concurrents (intervalle + focus + visibility). Pas de garde `SKIP_WAITING` unique.

### Auth proxy

`GET /api/*` hors allowlist → **401** sans cookie. `/api/version` n’est **pas** public aujourd’hui. Matcher proxy couvre `/api/*` (pas `/sw.js`).

### Tests PWA

Aucun test PWA runtime existant. Ce preflight ajoute uniquement des tests de contrat.

## 5. Lacunes confirmées

1. Aucune version applicative visible ; impossible de prouver le SHA exécuté depuis l’app (`LIVE_SDK_STRING_PROVEN=false` en `171_`).
2. Détection fondée uniquement sur le byte-diff du SW : un deploy docs (même `sw.js`) peut ne pas notifier ; un deploy app sans changement SW peut rester invisible.
3. Onglet ancien : HTML network-first, mais chunks `/_next/` peuvent servir le cache SW hors ligne ; nom de cache figé `v12` jusqu’à changer `sw.js`.
4. « Plus tard » ne mémorise pas le build → modale répétée.
5. Polling SW concurrent non sérialisé.
6. Multi-onglets : chaque onglet a sa modale ; `clients.claim()` + `controllerchange` rechargent **tous** les onglets après un `SKIP_WAITING` (y compris sans consentement local).
7. Hors ligne : `reg.update()` échoue silencieux ; pas d’état UX offline.
8. Aucun registre d’action sensible. Busy = `useState` local (generate `loading`, director `busy`, login, AICCOS `step: "sending"`). Pas de bus global.
9. SW indisponible : `PwaRegister` return tôt → **zéro** détection.
10. Pas de `BroadcastChannel`.
11. `GET /api/version` n’existe pas et serait 401 même créé, tant que `isPublicPath` n’est pas étendu.

## 6. Contrat JSON `GET /api/version`

Réponse **exacte** (clés stables, rien d’autre) :

```json
{
  "version": "1.0.0",
  "gitSha": "c808fa25d684fe1835bb574e8625cda1ea686096",
  "gitShaShort": "c808fa2",
  "buildId": "dpl_EUEqB8ZzrKWULgG5YFyA1M9jTGxH",
  "environment": "production",
  "deployedAt": null
}
```

Sentinelle string : `"unavailable"`. Timestamp absent : `null`. Ne jamais inventer une valeur.

### Sources et fallbacks

| Champ | Source | Fallback |
|---|---|---|
| `version` | fichier `SDK_VERSION` (fs Node, même lecture que `getCharacterOverview`) | `"unavailable"` — **pas** `"unknown"` |
| `gitSha` | `process.env.VERCEL_GIT_COMMIT_SHA` si 40 hex | `"unavailable"` |
| `gitShaShort` | 7 premiers caractères de `gitSha` valide | `"unavailable"` |
| `buildId` | `process.env.VERCEL_DEPLOYMENT_ID` non vide, sinon `gitSha` | `"unavailable"` |
| `environment` | `VERCEL_ENV` ∈ `{production,preview}` | `"development"` |
| `deployedAt` | aucune variable Vercel déterministe | **toujours `null`** |

Pas de cookie. Pas d’auth si le payload reste 100 % métadonnées publiques. Runtime **Node** (lecture `SDK_VERSION` + tracing). Edge interdit.

Tracing futur : `outputFileTracingIncludes["/api/version/**"] = ["../SDK_VERSION"]` **seulement**. Ne pas ajouter la route à `CHARACTER_FS_ROUTE_GLOBS` (éviterait `../characters/**`).

Allowlist proxy futur : `pathname === "/api/version" && method === "GET"`. Autres méthodes : 405. Rate limit GET léger : 60/min/IP (`RATE_LIMITS.version`).

Headers de la route :

- `Cache-Control: no-store, max-age=0`
- `CDN-Cache-Control: no-store`
- `X-Content-Type-Options: nosniff` (déjà via `/api/:path*`)
- aucun `Set-Cookie`

Le `private` de `next.config` `/api/:path*` peut rester ; la route force `no-store, max-age=0`. Pas de cache CDN durable.

## 7. Algorithme client (intégration unique dans `PwaRegister`)

Pas de second système. Pas de nouvelle bibliothèque UI. Même overlay.

1. Au montage : si `serviceWorker` absent, continuer quand même le poll version (SW optionnel).
2. Premier `GET /api/version` avec `cache: "no-store"`, `credentials: "omit"`. Mémoriser l’identité (`gitSha` sinon `buildId`) dans `sessionStorage` `vh-app-version-baseline`.
3. Poll toutes les **120 s** + `focus` + `visibilitychange` (visible). **Une** requête in-flight (promise partagée). `reg.update()` partage le même verrou.
4. Comparaison : `gitSha` si les deux ≠ `unavailable`, sinon `buildId`. **Ne pas** notifier sur `version` seule (`SDK_VERSION` change trop rarement).
5. Afficher « Mise à jour disponible » si identité distante ≠ baseline **et** ≠ `vh-app-version-dismissed`. Complément SW : si identité **inconnue** et worker `waiting`, conserver le signal SW actuel.
6. « Plus tard » : écrire l’identité dismissed, passer UX `deferred`, **ne pas** recharger, **ne pas** renvoyer `SKIP_WAITING`. Nouvelle notif seulement si le build change.
7. « Mettre à jour » : si blocker actif → UX `blocked` + raison + réessai, **aucun** reload. Sinon UX `installing`, **un** `SKIP_WAITING` (`skipWaitingSent`), puis attendre `controllerchange`. Si pas de worker waiting : **un** `location.reload()`. Flag `reloaded` existant conserve l’anti-double reload.
8. Aucun reload automatique sans consentement.
9. Hors ligne : UX `offline`, skip poll, non bloquant. Erreur réseau : UX `check-error`, non bloquant.
10. Démontage : clearInterval, abort fetch, retirer listeners, fermer `BroadcastChannel`.

## 8. Machine d’états UX

| État | UI |
|---|---|
| `idle` | pas de modale |
| `checking` | pas de modale (poll silencieux) |
| `available` | modale actuelle + Mettre à jour / Plus tard |
| `installing` | même modale, bouton Mettre à jour disabled « Installation… » |
| `deferred` | pas de modale jusqu’à un autre build |
| `blocked` | même modale, texte d’explication, bouton Réessayer |
| `offline` | pas de modale ; pas d’erreur bloquante |
| `check-error` | pas de modale |
| `applied` | reload en cours / après `controllerchange` |

## 9. Coordination SW / version

Le SW actuel est **conservé**. Il n’intercepte pas `/api/*` → le poll n’est pas caché. `updateViaCache: "none"` reste. On n’ajoute pas un second worker.

Ordre d’application après consentement :

1. `registration.update()` (best-effort).
2. Si `waiting` : un `SKIP_WAITING` → `controllerchange` → un reload.
3. Sinon : un reload network-first (HTML déjà network-first).

Un deploy qui change le SHA sans changer `sw.js` est détecté par `/api/version`. Un waiting SW sans SHA (endpoint down) reste le filet actuel.

## 10. Actions sensibles

Aucune infrastructure commune n’existe. Contrat minimal extensible, **non implémenté** ici :

Module futur `studio/src/lib/update-blockers.ts` :

- `registerUpdateBlocker(id, reason): () => void`
- `hasActiveUpdateBlockers()` / `getActiveUpdateBlockerReasons()`

Signaux **réels** (locaux, à brancher plus tard, hors AICCOS dirty) :

- génération Studio : `loading` (`/image`, voix, vidéo, carousel)
- director : `busy` / processing
- login submit
- Human Review : fetch de décision en cours
- AICCOS `step === "sending"` **hors** première implémentation (fichiers dirty protégés)

Le bouton Mettre à jour refuse le reload, explique la raison, permet de réessayer. Jamais de discard silencieux d’une saisie.

Limitation multi-onglets : un onglet peut `skipWaiting` pendant qu’un autre génère. Mitigation : `BroadcastChannel` + fenêtre d’ACK 300 ms ; sans canal, blockers **locaux seulement** (documenté, pas un veto distribué parfait).

## 11. Multi-onglets

`BroadcastChannel("vhs-app-update")` si disponible.

Messages : `available` · `later` · `applying` · `blocked` · `applied`.

Onglet qui applique : `applying`, attendre 300 ms d’ACK `blocked`. Si bloqué : abort `SKIP_WAITING`, UX `blocked`. Les autres ferment la modale et attendent `controllerchange` **ou** un seul reload s’ils ont déjà consenti.

Fallback sans BroadcastChannel : `sessionStorage` tab id + event `storage` best-effort. Ne **pas** forcer la fermeture d’un onglet.

## 12. Fichiers de la future implémentation

**Créer :** `studio/src/app/api/version/route.ts` · `studio/src/lib/app-version.ts` · `studio/src/lib/update-blockers.ts` · tests associés.

**Modifier :** `proxy.ts` (allowlist GET) · `rate-limit.ts` · `file-tracing.ts` + `next.config.ts` (include borné) · `pwa-register.tsx` · tests tracing.

**Interdit :** `sw.js` · manifest · `layout.tsx` (déjà un mount) · les deux fichiers AICCOS.

Aucun flag Vercel. Aucune migration.

## 13. Plan de tests (porte d’implémentation)

**Endpoint :** version/SHA présents ; fallback `unavailable` ; headers `no-store` ; clés interdites absentes ; POST → 405 ; GET public sans cookie ; tracing `../SDK_VERSION` seulement.

**Client :** pas de notif même build ; notif build différent ; dédup polls ; Plus tard sans reload ; `SKIP_WAITING` une fois ; `controllerchange` une fois ; blocker empêche le reload ; erreur réseau non bloquante ; hors ligne ; SW indisponible ; cleanup timers.

**Intégration :** ancienne → nouvelle → consentement → reload ; SW n’intercepte pas `/api/*`.

Cette porte verrouille le contrat (7 tests) sans exécuter ce plan runtime.

## 14. Décision

**`READY`** — implémentable sans nouveau flag et sans migration. Env Vercel déjà injectées (`VERCEL_GIT_COMMIT_SHA`, `VERCEL_ENV`, éventuellement `VERCEL_DEPLOYMENT_ID`). Tracing local déjà capable d’inclure `../SDK_VERSION`. Proxy allowlist = changement de code, pas un flag.

## 15. Contrôles

- Tests ciblés preflight.
- Suite unitaire complète après ajout.
- Typecheck (module TS contrat non-runtime).
- Secret scan officiel (`findSecretHits`) + scan fichiers stagés.
- 0 fichier runtime PWA/API modifié.
- AICCOS absents du staging.

## 16. Compteurs

```text
RUNTIME_FILES_CHANGED=0
API_ROUTES_CREATED=0
SERVICE_WORKER_WRITES=0
DEPLOY_CALLS=0
FLAG_WRITES=0
PRODUCTION_WRITES=0
SUPABASE_MUTATIONS=0
PROVIDER_CALLS=0
TTS_CALLS=0
MEDIA_READS=0
MEDIA_WRITES=0
STORAGE_UPLOADS=0
BUDGET_WRITES=0
PHASE_COST=0¢
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
```

## 17. Prochaine Auth exacte — non exécutée

```text
AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_IMPLEMENT_NO_DEPLOY_NO_FLAG_WRITE
```

Implémentera le mécanisme validé, avec tests, **sans** déploiement ni changement de flag.
