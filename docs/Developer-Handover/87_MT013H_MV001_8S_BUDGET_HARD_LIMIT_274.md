# 87 — MT-013H MV-001 8s Budget Hard Limit 174 → 274

**Date :** 12 août 2026  
**Auth :** `AUTH_MV001_8S_RAISE_HARD_LIMIT_174_TO_274`  
**Cible :** Virtual Humans Studio · `ejdb…nmvi` · workspace `3c308f57-…6d01`

```text
HARD_LIMIT_MINOR              = 274
COMMITTED_MINOR               = 112  (inchangé)
RESERVED_MINOR                = 0    (inchangé)
AVAILABLE_MINOR               = 162
SHORTFALL_MINOR               = 0    (= 162 − 162)
AUDIT_LOG_HARD_LIMIT_RAISED   = 1
RUNTIME_MOTION                = UNAVAILABLE
PROVIDER_CALLS                = 0
RESERVATIONS_CREATED          = 0
DEPLOY                        = NOT_ATTEMPTED
```

---

## 1. Préflight (PASS)

| Check | Attendu | Observé |
|---|---|---|
| hard | 174 | **174** |
| committed (`cost_ledger` entry_type=commit) | 112 | **112** |
| reserved (active/reserved) | 0 | **0** |
| available | 62 | **62** |
| MV-001 duration / estimate / reservation / cap | 8s / 135 / 162 / 200 | **oui** (`86_`) |
| Médias validés | oui | **oui** (`86_`) |
| Runtime Motion | UNAVAILABLE | **oui** |
| Policies rows | 1 | **1** |
| Prior audit `mt013h-…` | 0 | **0** |

Tentative audit sans `resource_type` → **ROLLBACK** (NOT NULL) · hard resté 174 · retry OK.

---

## 2. Écritures autorisées (seules)

1. `UPDATE workspace_budget_policies SET hard_limit_minor = 274 WHERE … AND hard_limit_minor = 174`  
2. `INSERT audit_log` action `budget.hard_limit_raised` · correlationId `mt013h-mv001-hard-174-to-274`  
   - `resource_type` = `workspace_budget_policy`  
   - `actor_type` = `system`  
   - `actor_id` / author = `AUTH_MV001_8S_RAISE_HARD_LIMIT_174_TO_274`  
   - metadata : previous=174, new=274, delta=100, MV-001 8s / 135 / 162 / 200

---

## 3. Post-vérification

| Check | Résultat |
|---|---|
| hard | **274** |
| committed | **112** |
| reserved | **0** |
| available | **162** (= 274 − 112 − 0) |
| audit `mt013h-mv001-hard-174-to-274` | **exactement 1** |
| ledger rows | **59** (inchangé) |
| production_jobs / active runs | **0** / **0** |
| Runtime Motion | **UNAVAILABLE** |

---

## 4. Interdictions respectées

Pas de réservation · pas de modification committed · pas d’upload/asset/run/job/fal · pas de deploy/Vercel · pas d’activation Motion · aucune autre politique touchée.

---

## 5. Suite

Cette Auth **n’autorise pas** la réservation MV-001 ni l’appel fal.  
Prochaines Auth distinctes : **private upload** → **deploy/flags** → **paid single call** (réserve ≤162¢).
