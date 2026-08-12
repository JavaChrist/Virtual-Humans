# MT-013O — MV-001 HUMAN REVIEW APPROVE

**Date :** 2026-08-12  
**Auth :** `AUTH_MV001_HUMAN_REVIEW_APPROVE_ONCE`  
**Decision :** `approved` (exactly once)

---

## Verdict

```text
MV001_BENCHMARK = PASS_WITH_HUMAN_APPROVAL
HUMAN_REVIEW_DECISIONS = 1 (approved)
OUTPUT_LIFECYCLE = approved (private, active=false)
PRODUCTION_CAPABILITY = NOT_YET_ENABLED
PROVIDER_CALLS = 0
MERGE_EXPORT = 0
RUNTIME_MOTION = UNAVAILABLE
TECHNICAL_HISTORY_PRESERVED = job.failed/qc_rejected
```

## Decision

- reviewRequestId: `mv001-hr-approve-74f78820ddcf7337734f5da1`
- decisionId: `bc4612c1…`
- quality_report: `1516c218…` rev 1
- expectedRevision (production_result): **1**
- persist: `created` · replay: `existing`
- attestation: recorded (redacted comment on decision row)

## Output

- asset `2d7ffcad…` · lifecycle **approved** · **active=false** · bucket privé

## Non-goals confirmed

- no fal / submit / poll / resultFetch
- no retry / fallback
- no ledger mutation
- no merge/export
- no signed URL
- no Registry promotion
- `qc_rejected` job error **retained**

## Verified Production (post)

| Check | Result |
|---|---|
| `human_review_decisions` | **1×** `approved` |
| `production_result` active | rev **2** (post-decision) |
| `quality_report` active | rev **1** `human_review` |
| job | `failed` / `qc_rejected` **preserved** · payload `hr=decided` |
| run | `completed` · verdict `PASS_WITH_HUMAN_APPROVAL` |
| asset | lifecycle `approved` · `active=false` |
| audit + domain_events | `director.quality.review_recorded` + `motion.mv001.human_review.approved` |
| ledger | unchanged 162 / 135 / 27 |

## Script

`studio/scripts/mt013o-mv001-human-review-approve.ts`  
(idempotent via `idempotency_key` ; replay → `existing`)

## Next

Capability Production Motion remains **NOT_YET_ENABLED**. Separate Auth required for any enablement, merge, or export.
