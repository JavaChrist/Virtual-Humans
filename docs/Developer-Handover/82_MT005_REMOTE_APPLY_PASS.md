# 82 — MT-005 Remote Apply — PASS

**Date :** 11 août 2026  
**Auth :** `AUTH_MT005_REMOTE_APPLY_ONLY`  
**Cible :** Virtual Humans Studio · `ejdb…nmvi` · `eu-west-3`

```text
MT005_REMOTE_APPLY            = APPLIED
PRODUCTION_STATUS             = ACTIVE_HEALTHY
MIGRATIONS_COUNT              = 30 / 30
MT005_PRESENT_ONCE            = true
RUNTIME_MOTION                = UNAVAILABLE
PROVIDER_CALLS                = 0
UPLOADS                       = 0
DEPLOY                        = NOT_ATTEMPTED
BUDGET_MUTATIONS              = 0
ROLLBACK                      = NOT_ATTEMPTED
```

---

## 1. Préflight (tous PASS avant écriture)

| Check | Résultat |
|---|---|
| Identité Production | `Virtual Humans Studio` · `ejdb…nmvi` · `ACTIVE_HEALTHY` |
| `RESTORE_DRILL` | **PASS** (`78_`) |
| Historique Production | **29** (dernière `vhs_134_…`) |
| Historique local | **30** |
| Seul drift | `…_vhs_mt005_human_review_decision_extend.sql` |
| Checksum fichier | SHA256 `9f3123430fdce82d4ac13d4856b2fbb95a93595de8be0caa0920e220d03daaac` · git blob `88a61048…` = commit intro MT-005 `bebf52d` (inchangé) |
| Working tree / `origin/main` | propre · sync `f09c246` |
| Décisions existantes | **0** lignes (CHECK expand sans conflit) |
| Locks actifs | **0** |
| Autre SQL en attente | **aucun** |

---

## 2. Application

| Champ | Valeur |
|---|---|
| Outil | MCP `apply_migration` |
| project_id | `ejdbksxaswhdtsudnmvi` |
| name | `vhs_mt005_human_review_decision_extend` |
| Version distante générée | **`20260811211757`** (timestamp MCP — comportement connu, cf. `21_`) |
| Succès | **true** |

Réconciliation locale (protocole historique VHS) : fichier renommé  
`20260811180000_…` → **`20260811211757_vhs_mt005_human_review_decision_extend.sql`**  
pour aligner local ↔ Production **30/30** (même version + même name). Contenu SQL inchangé (même blob).

---

## 3. Vérifications post-apply

| Check | Résultat |
|---|---|
| Migrations count | **30** |
| MT-005 une fois | **oui** · `20260811211757` / `vhs_mt005_human_review_decision_extend` |
| CHECK `decision` | 5 valeurs : approved, rejected, retry_same_reference, retry_updated_constraints, request_new_reference |
| Anciennes décisions | N/A (0 rows) — allowlist conserve approved/rejected |
| RPC Motion intents | **oui** (définition contient retry_* / request_new_reference) |
| Grants EXECUTE | `service_role` (+ `postgres`) · **pas** anon/authenticated |
| RLS `human_review_decisions` | **on** · force off (inchangé) |
| production_jobs / runs / assets | **0** / **0** / **0** |
| cost_ledger | **59** (inchangé vs préflight relatif — aucune écriture ledger par la migration) |
| human_review_decisions | **0** |
| Production status | **ACTIVE_HEALTHY** |
| migrations-static tests | **14/14 PASS** |
| `test:integration:db` (local) | **33/33 PASS** |
| Runtime Motion | **UNAVAILABLE** (non activé) |

---

## 4. Interdictions respectées

Aucune autre migration · pas de rollback · pas de deploy/Vercel/budget · pas d’upload/provider/benchmark · pas d’activation runtime Motion.

---

## 5. Suite

- Privacy MV-001 : **ACCEPTED_LIMITED** (`81_` · exp 2026-09-10).  
- Prochaines Auth **non fusionnées** : budget shortfall MV-001 · deploy/flags · paid single call.  
- Ne pas lancer fal sans Auth paid distincte.
