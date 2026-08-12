# 94 — MT-013L MV-001 Full Production Deploy Preflight (No Provider)

**Date :** 12 août 2026  
**Auth :** `AUTH_MV001_FULL_PRODUCTION_PREFLIGHT_NO_PROVIDER`  
**Source :** `39a79d20bfcde70fa03cc73721a256bf10694230` (`39a79d2`) · root `studio/`  
**origin/main :** synchronisé sur ce commit avant exécution

```text
VERDICT                         = READY_FOR_FINAL_PAID_AUTH
EXECUTABLE (future paid)        = true
PROVIDER_CALLED                 = false
RESULT_FETCH_COUNT              = 0
MEDIA_DOWNLOAD_COUNT            = 0
SUBMIT_COUNT / POLL_COUNT       = 0 / 0
WORKER_ENABLED (fenêtre)        = false
RUNTIME_MOTION_FINAL            = UNAVAILABLE
REGISTRY_GLOBAL                 = disabled
EXCEPTION_WINDOW                = active during ON only → OFF after finally
HTTP                            = login 200 · GET project 422 (invalid_artifact, no brief — expected)
IDEMPOTENCY_FINGERPRINT         = 905b53a28e26fe92  (≠ MT-013J f4e12e6de57402c9)
ASSETS                          = 2 (inchangé)
LEDGER / JOBS / RUNS / ATTEMPTS = 59 / 0 / 0 / 0
BUDGET                          = 274 / 112 / 0 / 162
MIGRATIONS                      = 30/30
PRIVACY                         = 5/5 · exp 2026-09-10
DEPLOY_ON                       = virtual-humans-evaznxfm3-… (39a79d2)
DEPLOY_OFF_FINAL                = virtual-humans-jzgif4t6i-… (39a79d2) · alias Production Ready
```

---

## 1. Vérifications initiales

| Check | Résultat |
|-------|----------|
| Commit local / `origin/main` | `39a79d2` exact |
| Production Ready avant Auth | `virtual-humans-rphjbs9u5-…` · Commit `39a79d2` |
| `FAL_KEY` | present=true (valeur jamais lue/affichée) |
| Transport fal / getResult / download gated | composition WIRED (`93_`) |
| Bucket privé | `director-final-assets` · public=false |
| Assets | source `12c4bd0b-…` · identity `f42393ae-…` · `source_kind=internal` · checksums OK · scopes OK |
| Budget / migrations / privacy | 274/112/0/162 · 30/30 · 5/5 non expiré |
| Jobs / runs / attempts / réservations actives | 0 / 0 / 0 / 0 |

Aucun déploiement manuel de source différente : la source Ready était déjà `39a79d2`.

---

## 2. Fenêtre ON (temporaire)

Flags écrits puis redeploy Production (**même commit** `39a79d2`) :

| Variable | ON | OFF final |
|---|---|---|
| `DIRECTOR_V2_ENABLED` | 1 | 0 |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | 1 | 0 |
| `DIRECTOR_V2_PAID_GENERATION_ENABLED` | 1 | 0 |
| `MOTION_TRANSFER_ENABLED` | 1 | 0 |
| `MOTION_TRANSFER_PAID_ENABLED` | 1 | 0 |
| `MOTION_TRANSFER_FAL_ENABLED` | 1 | 0 |
| `MOTION_TRANSFER_WORKER_ENABLED` | **0** | **0** |
| `MV001_REGISTRY_EXCEPTION_ACTIVE` | 1 | 0 |
| `MV001_PRIVACY_PACK_ACCEPTED` | 1 | 0 |
| Flags AI / Director worker | 0 | 0 |

Salt idempotence MT-013L : nouvelle valeur (fingerprint `905b53a28e26fe92` seulement — valeur non loguée).

Cron / retry / fallback / merge / export : OFF. Worker réel non invoqué.

---

## 3. Dry-run live (sans provider)

- Login Production **200**
- `GET /api/director/projects/390c25db-…` → **422** `invalid_artifact` (projet sans brief — attendu)
- Évaluation `evaluateMv001FullProductionPreflight` → **`READY_FOR_FINAL_PAID_AUTH`**
- Gates projected (worker ON pour future Auth) → **`executable=true`**
- Worker observé pendant la fenêtre → **false**
- `providerCalled=false` · `resultFetchCount=0` · `mediaDownloadCount=0`
- 0 fal (status/result inclus) · 0 URL signée/fal · 0 run/job/attempt/réserve/asset

### Composition prouvée

- `motionTransfer` Production wired  
- provider resolver réel + lazy  
- fal transport configuré (`getResult`)  
- polling durable + recovery fresh-process  
- drain consumer (`mode=drain`)  
- result fetch par `providerJobId`  
- output downloader Production + allowlist/SSRF  
- ingest privé + QC technique  
- fake Motion QC absent en Production  
- mesures unavailable → Human Review obligatoire  
- review handoff présent  
- Registry générale disabled · exception MV-001 seule (ON window)  
- admission / submit / poll / drain séparés  

Profil : 8s · critical · `fal-ai/kling-video/v3/pro/motion-control` · 135 / 162 / 200 · max 1/1/1 · retry/fallback 0/0 · review obligatoire · merge/export OFF.

---

## 4. Fermeture (finally)

Tous les flags Motion/Director/Paid/exception/privacy latch → **0** · redeploy OFF Ready sur **`39a79d2`**.  
Runtime Motion **UNAVAILABLE**.  
DB après : assets **2** · jobs/runs/attempts **0** · ledger **59** · hard **274**.

---

## 5. Artifacts

| Artifact | Chemin |
|----------|--------|
| Script | `studio/scripts/mt013l-mv001-full-production-preflight.mjs` |
| Contrat | `studio/src/application/motion/mv001/mv001-full-production-preflight.ts` |
| Rapport JSON | `studio/.tmp/mt013l-full-production-preflight.json` (hors Git) |
| Confirm | `CONFIRM_MT013L_FULL_PRODUCTION_PREFLIGHT=1` |

---

## 6. Suite (autorisation exacte)

**Prochaine autorisation exacte :**

`AUTH_MV001_FINAL_PAID_SINGLE_CALL` sur source **`39a79d2`** (ou redeploy Ready de cette lignée) :

- réserve ≤ **162¢**  
- max **1** submit fal payant  
- worker borné **1 job**  
- poll / result fetch / download / ingest / QC / Human Review  
- **0** retry / fallback / merge / export  
- fermeture OFF garantie après exécution  

Ne pas fusionner avec ce preflight.  
Le commit documentaire de ce rapport **ne doit pas** déclencher un nouveau deploy-preflight obligatoire de la lignée runtime `39a79d2` déjà prouvée.
