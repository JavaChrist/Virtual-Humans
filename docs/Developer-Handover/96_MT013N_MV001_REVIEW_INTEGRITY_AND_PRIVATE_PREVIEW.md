# MT-013N — MV-001 REVIEW INTEGRITY AUDIT & PRIVATE PREVIEW PREP

**Date :** 2026-08-12  
**Auth :** `AUTH_MV001_REVIEW_INTEGRITY_AND_PRIVATE_PREVIEW_ONLY`  
**Scope :** project `390c25db-69e1-403a-83c5-7afcb4b85e84` only  
**Constraints :** 0 fal · 0 reserve · 0 HR decision · 0 deploy · flags remain OFF

---

## Verdict

```text
INTEGRITY = PASS
PREVIEW = PREPARED_TTL_600S
PROVIDER_CALLS = 0
DECISION_APPLIED = 0
URL_IN_DOC_OR_GIT = 0
```

Reason: `qc_rejected_non_canonical_drain_terminal_preserved_on_job_error;_canon=quality_report+audit+hr_seeded;_run_status_stayed_running_because_needs_review_not_in_sql_check`

---

## Submit / provider uniqueness

- submitCount = **1**
- providerJobId = `019f…b8ee`
- generation_attempts = **1** (attempt_number=1, kind=primary)
- production_jobs = **1**

## Timeline (redacted)

| Entity | Status / phase | Notes |
| --- | --- | --- |
| production_run | `running` | needs_review = business waiting HR |
| production_job | `failed` / phase `qc_pending` | error.code=`qc_rejected` preserved |
| generation_attempt | `completed` | external=`019f…b8ee` |
| queue reclaim | attempt_count=8, max_attempts=200 | ≠ provider attempt |

## max_attempts analysis

Constraint `production_jobs_attempts_bounds`: `attempt_count <= max_attempts + 1`.

With `max_attempts=1`, only the first worker claims succeed; further **poll reclaims** hit the CHECK. This is **queue lease reclaim capacity**, not a second fal `generation_attempt`. Provider submit remained 1.

## qc_rejected analysis

| Question | Answer |
| --- | --- |
| Where recorded? | `production_jobs.error.code=qc_rejected`, `status=failed`; ephemeral in-process `mqr-*` |
| Why not business canon? | Resume hydrate used `pollHydrateMotionInput` stub (`durable-hydrate-*`) — not MV-001 inputs; false reject vs unavailable-metrics→human_review policy |
| Transition to human_review? | MT-013M `mt013m-seed-hr-context.mjs` inserted durable `quality_report` + audit seed; **no** APPROVE/REJECT/RETRY |
| Append-only? | `job.error/status` **not erased**; payload handoff fields updated under that Auth |

## Canonical QC / HR

- quality_report `1516c218…` → `overallStatus=human_review`
- HR decisions table rows = **0**
- audit `motion.mv001.human_review.seeded` present
- payload `humanReviewHandoffStatus=seeded`
- output asset `2d7ffcad…` **active=false**

## Ledger

reserve **162** / commit **135** / release **27** · reconciliationRequired = **false**

## Preview

Private read-only signed URL created with TTL **600s**; transmitted only on operator console channel `PREVIEW_URL_CHANNEL_*` — **not** stored in this document, JSON report, or Git.

## Review sheet (redacted)

See machine report `.tmp/mt013n-review-integrity.json` → `reviewSheet` (checklist + allowed decisions). No URL inside.

## Provider calls / writes (this Auth)

- fal / poll / resultFetch = **0**
- budget writes = **0**
- Vercel / migration = **0**
- signed URL creates = **1** (ephemeral)

## Next human action

Examine private preview (TTL≤10m) using review sheet; then Auth Human Review decision only
