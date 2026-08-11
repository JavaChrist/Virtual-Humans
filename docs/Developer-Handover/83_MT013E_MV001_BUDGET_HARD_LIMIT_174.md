# 83 — MT-013E MV-001 Budget Hard Limit 122 → 174

**Date :** 11 août 2026  
**Auth :** `AUTH_MV001_RAISE_HARD_LIMIT_122_TO_174`  
**Cible :** Virtual Humans Studio · `ejdb…nmvi` · workspace `3c308f57-…6d01`

```text
HARD_LIMIT_MINOR              = 174
COMMITTED_MINOR               = 112  (inchangé)
RESERVED_MINOR                = 0    (inchangé)
AVAILABLE_MINOR               = 62
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
| hard | 122 | **122** |
| committed (`cost_ledger` entry_type=commit) | 112 | **112** |
| reserved (status=reserved) | 0 | **0** |
| available | 10 | **10** |
| Privacy | `ACCEPTED_LIMITED_MV001` | **oui** (`81_`) |
| Migrations | 30/30 | **30** |
| Runtime Motion | UNAVAILABLE | **oui** |
| Policies rows | 1 workspace | **1** |

---

## 2. Écritures autorisées (seules)

1. `UPDATE workspace_budget_policies SET hard_limit_minor = 174 WHERE … AND hard_limit_minor = 122`  
2. `INSERT audit_log` action `budget.hard_limit_raised` · correlationId `mt013e-mv001-hard-122-to-174`  
   - metadata : previous=122, new=174, delta=52, auth, reason MV-001  
   - `actor_type` = `system` (contrainte CHECK Production : `shared_password|system|worker`)  
   - `actor_id` = `AUTH_MV001_RAISE_HARD_LIMIT_122_TO_174`

Tentative initiale avec `actor_type=human_auth` → **ROLLBACK** (CHECK) · hard resté 122 · puis retry OK.

---

## 3. Post-vérification

| Check | Résultat |
|---|---|
| hard | **174** |
| committed | **112** |
| reserved | **0** |
| available | **62** (= 174 − 112 − 0) |
| audit `budget.hard_limit_raised` / corr. | **exactement 1** |
| production_jobs / runs / assets | **0** / **0** / **0** |
| cost_ledger count | **59** (inchangé) |
| active reservations | **0** |
| migrations | **30** |
| Production | **ACTIVE_HEALTHY** |
| Runtime Motion | **UNAVAILABLE** |

---

## 4. Interdictions respectées

Pas de réservation ledger · pas de modification committed · pas de provider/upload/run/job/asset · pas de deploy/Vercel · pas d’activation Motion · aucune autre politique budgétaire touchée.

---

## 5. Suite

Cette Auth **n’autorise pas** la réservation MV-001 ni l’appel fal.  
Prochaines Auth distinctes : deploy/flags (si requis) · **paid single call MV-001** (réserve ≤ 62¢).
