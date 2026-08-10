# 41 — Phase 10F-BUDGET-AUTH-A — Raise Workspace Hard Limit Only

**Date :** 10 août 2026  
**Entrée :** `40_PHASE_10F_WORKSPACE_BUDGET_AUDIT.md` (`READY_FOR_BUDGET_AUTH`, commit `82a6424`)  
**Portée :** `workspace_budget_policies.hard_limit_minor` uniquement + `audit_log`  
**Provider / Storyboard / flags / ledger / réservation :** **0**

---

## Verdict

```text
PASS
```

Hard limit relevé **100¢ → 113¢** (+13¢). Disponible **7 → 20**. Exposure commits inchangée (**93¢**). Aucune réservation. Runtime AI OFF. Auth B Storyboard encore requise.

---

## Autorisation humaine

```text
J’autorise la Phase 10F-BUDGET-AUTH-A : relever
workspace_budget_policies.hard_limit_minor de 100¢ à 113¢ (+13¢)
sur le workspace du projet 984507af-…, avec audit_log,
sans ouvrir aucun flag Director, sans provider, sans Storyboard,
sans média et sans worker.
```

---

## Préconditions (lecture seule) — PASS

| Check | Observé |
|---|---|
| Workspace projet `984507af-…` | `3c308f57-…` |
| hard_limit_minor | **100** |
| committed exposure | **93** |
| active reservations | **0** |
| available | **7** |
| runtime AI | **OFF** |
| Director AI flags | **all 0 / empty** |
| PAID_GENERATION | **0** |
| Worker | **0** |
| Réservations orphelines | **0** |
| Run `b446a0ed-…` | `failed` / `budget_exceeded` / actual **null** |
| `storyboard_project` | **0** |

---

## Écriture

| Champ | Valeur |
|---|---|
| Script | `studio/scripts/phase-10f-raise-workspace-hard-limit.mjs` |
| Confirm | `CONFIRM_PHASE_10F_BUDGET_AUTH=1` |
| `PHASE_10F_NEW_HARD_LIMIT_MINOR` | **113** |
| Condition update | `hard_limit_minor = 100` |
| Nouvelle valeur | **113** |
| Autres politiques | inchangées |
| Rollback si audit échoue | hard limit remis à l’ancienne valeur |

### Audit log (exactement 1)

| Champ | Valeur |
|---|---|
| action | `workspace.budget_hard_limit.raised` |
| correlationId | `corr-10f-budget-auth-a-1786372980642` |
| actor_id | `phase-10f-budget-auth-a` |
| actor_type | `shared_password` |
| oldHardLimitMinor | **100** |
| newHardLimitMinor | **113** |
| deltaMinor | **13** |
| motif | `phase_10f_storyboard_budget_authorization` |
| created_at | `2026-08-10T14:43:00.447Z` |

Evidence locale (non commitée) : `studio/.tmp/phase-10f-budget-auth-a-done.json`.

---

## Post-écriture (lecture seule) — PASS

| Check | Observé |
|---|---:|
| hard_limit_minor | **113** |
| committed exposure | **93** |
| active reservations | **0** |
| available | **20** |
| audit_log Auth A | **1** |
| ledger depuis Auth A | **0** |
| director_runs depuis Auth A | **0** |
| project_artifacts depuis Auth A | **0** |
| storyboard_project | **0** |
| provider calls | **0** |
| runtime AI | **OFF** |

Run `b446a0ed-…` inchangé : `failed` / `budget_exceeded` / `actual_cost_minor=null` / attempt **1**.

### verify-budget-ready (non payant)

```text
CONFIRM_PHASE_10F_REMOTE_READ=1
node --import tsx scripts/phase-10f-verify-budget-ready.mjs
→ readyForStoryboardAuthB: true (available 20 ≥ need 13)
→ aucune réservation effectuée
```

---

## Interdictions respectées

```text
NO PROVIDER CALL
NO RESERVATION
NO LEDGER WRITE
NO STORYBOARD RUN
NO ARTIFACT WRITE
NO DIRECTOR FLAG CHANGE
NO VERCEL ENV WRITE
NO DEPLOY
NO MEDIA
NO WORKER
NO MIGRATION
NO PUSH
```

---

## Suite

Auth B Storyboard (execute réel sous flags bornés + salt idempotence) **encore requise** — autorisation séparée. Ne pas lancer Storyboard sans Auth B.
