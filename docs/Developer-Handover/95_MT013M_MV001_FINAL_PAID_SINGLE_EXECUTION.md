# MT-013M — MV-001 FINAL PAID SINGLE EXECUTION

**Date :** 2026-08-12  
**Auth :** `AUTH_MV001_FINAL_PAID_SINGLE_CALL`  
**Runtime source :** `39a79d2`  
**Documentary HEAD at Auth :** `61d1b18`

---

## Verdict

```text
VERDICT = PAID_SUBMIT_CONSUMED_PRIVATE_OUTPUT_INGESTED_NEEDS_HUMAN_REVIEW
AUTHORIZATION_CONSUMED = YES (submitCount=1)
SECOND_SUBMIT = 0
HUMAN_DECISION_APPLIED = 0
MERGE_EXPORT = 0
RUNTIME_MOTION_FINAL = UNAVAILABLE (flags closed + redeploy OFF from 39a79d2)
```

---

## What completed

1. Production restored / kept on commit `39a79d2` for the paid window.
2. Dry-run gate `READY_FOR_FINAL_PAID_AUTH` (fingerprint exec `75d645ebef1712f8`, distinct from L `905b53a28e26fe92`).
3. Exact writes: 1 reserve 162¢ · 1 `production_run` · 1 `production_job` · 1 `generation_attempt`.
4. Exactly **one** fal submit → `providerJobId` durable (`019f…b8ee`).
5. Poll / result-fetch / secure download / private ingest of **one** `motion_provider_output` (non-active).
6. Ledger: reserve 162 → commit **135** → release remainder **27** (no double settle).
7. Motion metric ports honest-unavailable; no auto-approval / merge / export.

## Incidents during Auth (same submit — no resubmit)

| Issue | Effect | Remediation |
| --- | --- | --- |
| `production_jobs.max_attempts=1` | blocked poll reclaims after first claim (`production_jobs_attempts_bounds`) | raised queue `max_attempts` for reclaim capacity only (still 1 generation_attempt) |
| Process deadline 20 min + reclaim bug | `provider_timeout` before enough polls | resume poll/drain same `providerJobId` with extended deadline |
| Vercel worker ON during one resume | risk of claim steal | subsequent resumes kept Vercel workers OFF; local executor only |
| Drain `qc_rejected` | hydrate stub `motionInput` checkpoints ≠ MV-001 human_review path; HR not seeded by drain | private output kept; HR artifact seed script prepared — **no human decision applied** |

## Scripts

- `studio/scripts/mt013m-mv001-final-paid-single-execution.ts` — primary paid path
- `studio/scripts/mt013m-resume-poll-drain.ts` — poll/drain only (no second submit)
- `studio/scripts/mt013m-seed-hr-context.mjs` — persist `quality_report` + HR handoff audit (no decision)
- `studio/scripts/mt013m-inspect-*.mjs` — read-only diagnostics

## Operator next step (human)

1. Review private output asset `2d7ffcad-…` in `director-final-assets` (non-active).
2. If HR artifact not yet persisted, run:
   `CONFIRM_MT013M_SEED_HR_CONTEXT=1 node scripts/mt013m-seed-hr-context.mjs`
3. Apply **Human Review decision** under a **new Auth** only.
4. Do **not** resubmit fal under this Auth.
