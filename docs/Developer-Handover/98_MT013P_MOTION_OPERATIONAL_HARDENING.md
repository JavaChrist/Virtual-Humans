# MT-013P — MOTION OPERATIONAL HARDENING

**Date :** 2026-08-12  
**Auth scope :** post-benchmark operational hardening (fakes / synthetic only)  
**Production media / fal / MV-001 decision :** untouched

---

## Verdict

```text
MOTION_OPERATIONAL_RECOVERY_HARDENED
PROVIDER_SUBMIT_MAX = 1
MULTI_INVOCATION_POLL_DRAIN = PASS
PRODUCTION_STUB_HYDRATION = REMOVED
REAL_PROVIDER_CALLS = 0
RUNTIME_MOTION = UNAVAILABLE
```

---

## Problem (MV-001 incident class)

After cold start, `hydrateMotionTransferAttemptFromJob` used `pollHydrateMotionInput`  
(`durable-hydrate-*` + `qcRequirements=[technical.decode]` only).

Drain QC evaluated that stub → false `qc_rejected`, while business policy for  
unavailable Motion metrics is `human_review`.

Separately, `production_jobs.max_attempts=1` was misused as “one provider attempt”;  
it is **queue lease reclaim** capacity and blocked further poll claims.

---

## Changes

### 1. Claim count ≠ provider attempt

| Counter | Meaning |
|---|---|
| `production_jobs.attempt_count` / `max_attempts` | Worker lease reclaim budget |
| `payload.motion.submitCount` | Provider submit (max **1**) |
| `generation_attempts` | Generation attempt rows |

Default for `action=motion_transfer` enqueue:  
`MOTION_TRANSFER_QUEUE_RECLAIM_MAX_ATTEMPTS = 64`  
(`production-job-queue.ts` + `EnqueueProductionJobCommand.maxAttempts`).

### 2. Durable `resumeInput`

- `payload.motion.resumeInput` = redacted `MotionTransferInput`  
  (internal media refs, full `qcRequirements` + `referenceSpec`, no signed URL / prompt)
- Written by `serializeMotionAttemptAuthority` / `buildDurableMotionPayload`
- Hydrate reconstructs QC-capable input from `resumeInput` only

### 3. Production stub removed

- `pollHydrateMotionInput` **deleted** from Production path
- Missing / incomplete resume → placeholder + `reconciliationRequired`
- Drain fail-closes with `motion_resume_input_missing` — **never** invents `qc_rejected`

### 4. Multi-invocation poll/drain

- Cold start + N claims → `submitCount` stays 1
- Poll/drain resume from durable payload only
- Submit still blocked when `mediaBoundary = durable:omitted`

---

## Tests (fake / synthetic)

`studio/src/application/motion/__tests__/mt013p-motion-operational-recovery.test.ts`

- resumeInput redact + QC gates preserved  
- serialize → cold hydrate complete  
- cold-start drain → HR `seeded`, not `qc_rejected`  
- incomplete resume → `motion_resume_input_missing`  
- multi-invocation poll with process clears → submit=1  
- no signed URL / prompt leak in durable payload  

Regression: MT-013K durability / QC consumer / output transport / wire — green.

---

## Non-goals confirmed

- 0 fal / 0 nouvelle génération  
- 0 lecture/écriture média Production  
- 0 mutation décision MV-001 Human Review  
- flags OFF / runtime Motion UNAVAILABLE  
- 0 migration distante  
- historique MV-001 `qc_rejected` **non réécrit** (incident legacy documenté 95/96/97)

---

## Files

| Path | Role |
|---|---|
| `studio/src/application/motion/durable-resume-motion-input.ts` | resumeInput + reclaim constant |
| `studio/src/application/motion/motion-transfer-attempt-durability.ts` | serialize/hydrate sans stub |
| `studio/src/application/motion/motion-output-drain.ts` | garde anti-faux reject |
| `studio/src/application/production/enqueue.ts` | `resumeInput` + `maxAttempts` |
| `studio/src/infrastructure/db/queue/production-job-queue.ts` | default reclaim 64 |
| `studio/src/infrastructure/worker/queue-adapter.ts` | forward `maxAttempts` |
| `studio/src/application/motion/__tests__/mt013p-*.test.ts` | suite P |

---

## Next

Capability Production Motion remains **NOT_YET_ENABLED**.  
Any remote migration or Production media touch requires separate Auth.
