# 105 — Phase 11A — First Real OpenAI Image Smoke

**Date :** 2026-08-13  
**Auth :** `AUTH_11A_PAID_OPENAI_IMAGE_SMOKE_ONCE`  
**Nature :** gate précondition · **0** appel OpenAI · **0** réservation · **0** job/asset

```text
VERDICT = BLOCKED_PRECONDITION
PROVIDER_AUTH_CONSUMED = NO
SOURCE_RUNTIME_REQUIRED = 9952380
SOURCE_RUNTIME_OBSERVED = 67187b8 (Production Ready auto-deploy docs)
REAL_MEDIA_CALLS = 0
PRODUCTION_MEDIA_WRITES = 0
RUNTIME_PAID_MEDIA = OFF (non ouvert)
OPENAI_IMAGE_REAL_EXECUTION = UNAVAILABLE
MOTION_RUNTIME = UNAVAILABLE
```

---

## 1. Verdict

**`BLOCKED_PRECONDITION`**

Aucun flag Paid/Worker/VHS-124 n’a été ouvert.  
Aucun appel OpenAI, aucune réservation, aucun run/job/attempt/asset.

L’autorisation provider **n’est pas consommée**.

---

## 2. STOP avant provider — préconditions en échec

### 2.1 Runtime Production ≠ `9952380`

| Attendu | Observé |
|---|---|
| Commit runtime **`9952380`** | Production Ready **`67187b8`** (`virtual-humans-ahb2wbjch-…`, clone `Commit: 67187b8`) |

`67187b8` est le commit **documentaire** du final preflight (`104_` + script).  
Auth interdit de promouvoir une autre source applicative et exige explicitement **`9952380`**.

> Note : le delta `9952380…67187b8` ne change pas le TS Production image, mais la contrainte Auth de commit exact reste bloquante.

### 2.2 Ingest Storage privé non câblé

Sur la source applicative `9952380` (et donc aussi `67187b8`) :

| Élément | Statut |
|---|---|
| `buildPhase11AImageStoragePath` | **défini** (helper + tests) |
| Caller Production / worker / engine | **aucun** hors tests |
| Upload `director-final-assets` | **non branché** |
| Compteurs `storageWriteCount` / `assetInsertCount` | helper only — **non appliqués** au runtime worker |

Adapter OpenAI → `inline_data_url` (base64 mémoire).  
`production_runs.state` jsonb persiste l’état run **complet** (`createSupabaseProductionRunStore`) — un smoke « tel quel » **persisterait le base64**, ce que l’Auth interdit.

### 2.3 Plan single-step hors route HTTP

`buildPhase11ASingleStepGenerationPlan` n’est **pas** branché sur `POST /routing`.  
Le Router full-plan reste `no_eligible_strategy` (cf. `58_` / preflights).  
Un execute Production nécessite une insertion/persistance de plan hors chemin HTTP canonique — écart documenté, non compensé par Auth (pas de promotion de code).

### 2.4 Préconditions respectées / non ouvertes

| Check | Résultat |
|---|---|
| Dernier preflight `104_` | `READY_FOR_11A_PAID_AUTH` |
| Correctif prompt-gate `[DATA:…]` | présent dans `9952380` |
| Flags Paid/Worker/VHS-124 | **non ouverts** (STOP) |
| Motion | isolé / OFF |
| Legacy `/api/generate/image` | non utilisé |
| Provider calls | **0** |

---

## 3. Déploiements

| Host | Commit | Rôle |
|---|---|---|
| `virtual-humans-ahb2wbjch-…` | **67187b8** | Production Ready courant (auto-deploy docs) |
| `virtual-humans-29avc9o8l-…` | **9952380** | dernier OFF preflight final |

Aucun redeploy exécuté dans cette Auth (fenêtre ON non ouverte).

---

## 4. Écritures / provider

| Compteur | Valeur |
|---|---:|
| providerSubmitCount | **0** |
| new runs / jobs / attempts | **0** |
| reservations / ledger smoke | **0** |
| Storage writes | **0** |
| assets / HR decisions | **0** |

Budget / hard limit : **non modifiés** (aucune réservation).

---

## 5. Travail requis avant re-Auth payante

Auth de wiring (pas un smoke payant) pour, au minimum :

1. **Materialize** output OpenAI → bytes mémoire → put privé `director-final-assets`  
   path `{ws}/{project}/media/image/{assetId}.png` · no overwrite · strip `inline_data_url` avant `production_runs.state`.
2. Créer **1** `media_assets` (`active=false`) + quality report + HR context.
3. Brancher **GenerationPlan** single-step 11A sur le chemin Production (route ou insert contrôlé documenté).
4. Appliquer `assertPhase11AWorkerCountersWithinSmoke` sur le worker.
5. Redeploy Production Ready exact **`9952380`** (ou nouveau commit applicatif Auth-é) · flags OFF.
6. Rejouer un preflight no-provider sur cette source, puis Auth smoke once.

---

## 6. Prochaine décision humaine

```text
NEXT = 11A-WIRE-STORAGE-AND-PLAN-MATERIALIZE (Auth séparée)
THEN = redeploy runtime exact + preflight no-provider
THEN = 11A-PAID-OPENAI-IMAGE-SMOKE-ONCE (nouvelle Auth ; provider non consommé)
DO_NOT = appeler OpenAI sur 67187b8 · persister base64 · legacy · Motion
```
