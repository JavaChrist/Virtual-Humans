# 173 — VHS app update versioning and notification implement

**Date :** 2026-08-27  
**Auth :** `AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_IMPLEMENT_NO_DEPLOY_NO_FLAG_WRITE`  
**Nature :** implémentation locale `/api/version` + `PwaRegister` · **0** push · **0** deploy · **0** flag write  
**HEAD au départ :** `5ebf73c` (`172_` SHA record)  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_IMPLEMENT_READY
API_VERSION_ROUTES_CREATED = 1
UPDATE_BLOCKER_REGISTRIES_CREATED = 1
SERVICE_WORKER_WRITES = 0
MANIFEST_WRITES = 0
LAYOUT_WRITES = 0
DEPLOY_CALLS = 0
GIT_PUSHES = 0
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
NEXT_AUTH = AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_SYNC_AND_DEPLOY_ONCE_NO_FLAG_WRITE
```

---

## 1. Autorisation consommée

`AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_IMPLEMENT_NO_DEPLOY_NO_FLAG_WRITE` — Christian, chat courant.

Implémentation + tests + commits **locaux**. Aucun `git push`. Aucun appel Vercel. Aucun flag. Aucune mutation Production/Supabase. `sw.js`, manifest, `layout.tsx` et les deux fichiers AICCOS **intacts** (AICCOS toujours dirty hors staging). RideCloud apply non consommée. La porte de sync/deploy n’est pas exécutée.

`157_`–`172_` restent des snapshots immuables.

## 2. Git

| Champ | Attendu Auth | Réel initial | Réel final |
|---|---|---|---|
| Branche | `main` | `main` | `main` |
| HEAD | `5ebf73c` | `5ebf73c` | commit fonctionnel + SHA record (local) |
| origin/main | `5ebf73c` | `5ebf73c` | **`5ebf73c` inchangé** |
| ahead/behind | `0/0` puis `2/0` | `0/0` | **`2/0`** |
| Dirty protégés | 2 AICCOS | 2 AICCOS | 2 AICCOS, non stagés |

Aucun reset, restore, stash ou push.

## 3. Architecture implémentée

Un seul système PWA : `PwaRegister` existant. Pas de second overlay.

| Couche | Fichier | Rôle |
|---|---|---|
| Contrat JSON | `studio/src/lib/app-version.ts` | shape, parse strict, comparaison |
| Lecture `SDK_VERSION` | `studio/src/lib/app-version-fs.ts` | fs Node seulement |
| Route | `studio/src/app/api/version/route.ts` | `GET` public, Node, no-store |
| Proxy | `studio/src/proxy.ts` | allowlist **exacte** `GET /api/version` |
| Rate limit | `RATE_LIMITS.version` = 240/min | GET seulement, IP partagée |
| Tracing | `versionApiTracingIncludes()` | `/api/version/**` → `../SDK_VERSION` |
| Blockers | `studio/src/lib/update-blockers.ts` | registre mémoire, SSR-safe |
| Client | `studio/src/lib/app-update-client.ts` | poll, Plus tard, apply, channel |
| UI | `studio/src/components/pwa-register.tsx` | même modale |

AICCOS **non câblé** au registre.

## 4. Contrat réel `GET /api/version`

```json
{
  "version": "1.0.0",
  "gitSha": "<40 hex | unavailable>",
  "gitShaShort": "<7 hex | unavailable>",
  "buildId": "<VERCEL_DEPLOYMENT_ID | gitSha | unavailable>",
  "environment": "production|preview|development",
  "deployedAt": null
}
```

Sources : `SDK_VERSION` · `VERCEL_GIT_COMMIT_SHA` · `VERCEL_DEPLOYMENT_ID` · `VERCEL_ENV`. Jamais de timestamp inventé. Jamais de dump d’env.

Headers : `Cache-Control: no-store, max-age=0` · `CDN-Cache-Control: no-store` · `Vercel-CDN-Cache-Control: no-store`. Pas de cookie.

Proxy : `isPublicPath` accepte uniquement `GET /api/version`. `/api/budget` et le reste restent 401 sans session.

Rate limit : 240 GET/min/IP (poll 120 s + plusieurs onglets derrière NAT). Les autres politiques sont inchangées.

## 5. Détection et UX

Baseline au premier fetch réussi : **pas de modale**. Poll 120 s + focus + visibilité, une requête in-flight, `cache: "no-store"`, `credentials: "omit"`.

Comparaison : SHA si les deux sont valides ; sinon `buildId` ; **jamais** `version` seule.

Affichage si worker `waiting` **ou** nouveau build. Nouveau build → `registration.update()` **une fois** par identité. Sans worker waiting : état `preparing`, apply = un reload consenti (pas de `SKIP_WAITING`).

Plus tard : `sessionStorage` `vh-app-version-dismissed` (+ fallback mémoire). Nouvelle identité = nouvelle notif.

Apply : blockers → refuse + raisons texte (pas d’HTML). Sinon un `SKIP_WAITING` puis `controllerchange` → un reload (`reloaded`). Aucun timeout de reload.

États : `idle` · `checking` · `available` · `preparing` · `installing` · `deferred` · `blocked` · `offline` · `check-error` · `applied`.

## 6. Multi-onglets

`BroadcastChannel("vhs-app-update")` si dispo. Fallback `localStorage` `vhs-app-update`. ACK 300 ms avant `SKIP_WAITING`. Un onglet avec blockers annonce `blocked` et n’est pas forcé. Aucune fermeture d’onglet.

## 7. Tracing / NFT

Build Production local **PASS**. Route `/api/version` présente.

NFT `studio/.next/server/app/api/version/route.js.nft.json` contient `SDK_VERSION`. NFT `/api/budget` ne le contient pas. Routes character inchangées. Aucun `../**`.

## 8. Tests

Suite unitaire **1940/1940**. Typecheck PASS. Build local PASS. Secret scan officiel sur les fichiers de la porte.

Couverture : lecture/fallback `SDK_VERSION`, SHA valide/invalide, `buildId`, environnements, `deployedAt=null`, headers, GET public, autres API protégées, tracing borné, blockers (refcount, sub, SSR), baseline, SHA nouveau, buildId, version ignorée, dédup, offline, erreur, Plus tard, blocker, `SKIP_WAITING` unique, reload unique, channel, SW absent, source PWA.

## 9. Limites

- Blockers non branchés sur generate / director / AICCOS (registre seulement).
- `clients.claim()` peut encore recharger les autres onglets après un `SKIP_WAITING` réussi (SW inchangé).
- `deployedAt` reste `null`.
- Mécanisme **non déployé** tant que la prochaine Auth n’a pas poussé `main`.

## 10. Compteurs

```text
API_VERSION_ROUTES_CREATED=1
UPDATE_BLOCKER_REGISTRIES_CREATED=1
SERVICE_WORKER_WRITES=0
MANIFEST_WRITES=0
LAYOUT_WRITES=0
DEPLOY_CALLS=0
GIT_PUSHES=0
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

## 11. Prochaine Auth exacte — non exécutée

```text
AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_SYNC_AND_DEPLOY_ONCE_NO_FLAG_WRITE
```

Vérifiera les commits locaux, poussera **une fois**, attendra l’auto-déploiement GitHub et testera le mécanisme en Production. Ne pas l’exécuter pendant cette Auth.
