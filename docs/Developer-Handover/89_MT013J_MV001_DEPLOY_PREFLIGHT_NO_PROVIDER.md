# 89 — MT-013J MV-001 Deploy Preflight (No Provider)

**Date :** 12 août 2026  
**Auth :** `AUTH_MV001_DEPLOY_PREFLIGHT_NO_PROVIDER`  
**Source :** `db1d64c4c78b27cc63e52595815b77f04a3c86f9` · root `studio/`

```text
VERDICT                     = READY_FOR_PAID_AUTH
EXECUTABLE (future paid)    = true
PROVIDER_CALLED             = false
WORKER_ENABLED              = false
RUNTIME_MOTION_FINAL        = UNAVAILABLE
REGISTRY_GLOBAL             = disabled
EXCEPTION_WINDOW            = active during ON only → OFF after finally
HTTP                        = login 200 · GET project 422 (invalid_artifact, no brief — expected)
IDEMPOTENCY_FINGERPRINT     = f4e12e6de57402c9
ASSETS                      = 2 (inchangé)
LEDGER / JOBS / RUNS        = 59 / 0 / 0
DEPLOY_ON                   = virtual-humans-h71dskbf8-… (db1d64c)
DEPLOY_OFF_FINAL            = virtual-humans-bhd0a92fs-… (db1d64c) · alias Production
```

---

## 1. Fenêtre ON (temporaire)

Flags écrits puis redeploy Production (même commit) :

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
| Text AI / Director worker | 0 | 0 |

Salt idempotence MV-001 : nouvelle valeur (fingerprint `f4e12e6de57402c9` seulement — valeur non loguée).  
`FAL_KEY` : **present=true** (valeur jamais lue/affichée).

---

## 2. Dry-run live

- Login Production **200**  
- `GET /api/director/projects/390c25db-…` → **422** `invalid_artifact`  
  (projet MV-001 sans brief — création I-A sans artifact ; prouve persistence ON)  
- Évaluation locale `evaluateMv001DryRunLivePrep` → **`READY_FOR_PAID_AUTH`**  
- Gates projected (worker ON pour future Auth) → **`executable=true`**  
- Worker observé pendant la fenêtre → **false**  
- `providerCalled=false` · 0 fal · 0 signed URL · 0 run/job/attempt/réserve

Profil vérifié : 8s · fal Kling v3 pro motion-control · 135 / 162 / 200 · budget 274/112/0/162 · Privacy 5/5 exp 2026-09-10 · migrations 30/30 · assets 2 internal privés.

---

## 3. Fermeture (finally)

Tous les flags Motion/Director/Paid benchmark → **0** · exception OFF · redeploy OFF Ready sur `db1d64c`.  
Runtime Motion **UNAVAILABLE**.

---

## 4. Script

`studio/scripts/mt013j-mv001-deploy-preflight.mjs`  
(`CONFIRM_MT013J_DEPLOY_PREFLIGHT=1`)

---

## 5. Suite

Auth **paid single call MV-001** distincte — réserve ≤162¢ · max 1 fal · worker borné 1 job.  
Ne pas fusionner avec ce preflight.
