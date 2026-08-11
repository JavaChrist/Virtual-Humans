# 68 — MT-008 Motion Transfer Worker & Polling Orchestration

**Date :** 11 août 2026  
**Gate :** MT-6 Worker  
**Verdict :** **PASS**

```text
worker motion orchestration = implemented
fake end-to-end async = PASS
real fal calls = impossible (flags OFF / privacy blocked / Registry disabled)
Registry = UNVERIFIED / enabled=false
privacy gate = blocked (default)
flags = OFF
runtime = unavailable
Production jobs created = 0
migration required = no
```

## 1. Mission

Étendre le worker Production canonique `run-once` pour orchestrer `action = motion_transfer` avec un provider port injecté (fake en tests).

## 2. Fichiers étendus / créés

| Fichier | Rôle |
|---|---|
| `application/worker/claimed-job-processor.ts` | Branche `motion_transfer` → orchestrateur |
| `application/worker/production-worker.ts` | Inject `motionTransfer` ; max **1** job motion / invocation |
| `application/production/enqueue.ts` | `MotionTransferJobPayloadMeta` / phases (JSONB) |
| `application/motion/motion-transfer-worker-orchestrator.ts` | Lifecycle submit/poll/ledger/QC handoff |
| `application/motion/motion-transfer-worker-gates.ts` | Gates fail-closed + harness local |
| `application/motion/motion-transfer-worker-events.ts` | Observabilité redacted |
| `application/motion/__tests__/mt008-worker-orchestration.test.ts` | Suite MT-008 |

**Réutilisé :** `JobQueuePort` (claim/lease/reschedule/complete/fail), `BudgetReservationPort` + `settleAttemptBudget` / `releaseFullReservation`, `MotionTransferProviderPort` (fake + fal adapter fake transport), route `POST /api/internal/director-worker/run-once`.

**Pas** de worker Motion parallèle / cron.

## 3. Gates

Avant submit (hors harness) :

```text
MOTION_TRANSFER_ENABLED
MOTION_TRANSFER_PAID_ENABLED
MOTION_TRANSFER_FAL_ENABLED
MOTION_TRANSFER_WORKER_ENABLED
privacy gate accepted
Registry enabled + verified + paid
firm estimate · reservation · media · human review · route
```

Harness local uniquement : `MOTION_TRANSFER_FAKE_HARNESS=1|true` et **interdit** sur Vercel/Production.

État actuel Production : flags OFF → worker refuse motion (orchestrateur absent ⇒ `motion_capability_unavailable`).

## 4. Lifecycle (payload.motion.phase)

Sans migration SQL — mapping sur `production_jobs` générique + meta JSONB :

```text
submitting → submitted → polling → qc_pending
                              ↘ provider_failed | timed_out | submission_unknown | late_quarantined
```

Queue status : `queued` / `leased` / `completed` / `failed` (inchangé).

## 5. Exactly-once (honnête)

```text
fal native idempotency = NO
DB intent → phase=submitting → provider.submit → persist providerJobId
```

Fenêtre critique (accepté provider, crash avant persist) → **`submission_unknown`** :

- `needs_review`
- **NO AUTOMATIC RESUBMIT**
- audit `motion.submit.unknown`
- réconciliation humaine/provider

## 6. Submit / Poll

- `submitCount` max logique = 1 ; `resubmitCount` = 0
- Poll exige `providerJobId` ; jamais de submit
- Backoff borné 500ms–60s ; `maxPolls` ; deadline optionnelle
- Succès → descriptor opaque · ledger commit/release · **`qc_pending`** (`needs_review`)
- **Pas** d’asset final / approval auto / merge / export

## 7. Ledger

```text
reservation must exist before submit
success → commit actual (≤ reserved) + release remainder
failure before accept → full release
timeout / unknown usage → reconciliationRequired (no silent commit)
duplicate terminal → already_done (no double settle)
actual > reserved → reconciliationRequired
```

Exemple synthétique : estimate **135¢** / reserve **162¢**.

## 8. Cancel / late result

Cancel provider → `cancel_unsupported` ; late result → `quarantineMotionLateResult` (`late_quarantined`) ; ne réouvre pas un run terminal.

## 9. Observabilité

Événements `motion.*` redacted (correlationId, run/job/attempt, provider/model, adapter version, providerJobId fingerprint, status, usage/cost). Aucune URL/clé.

## 10. Migration

```text
migration required = no
```

## 11. Tests

17 ciblés MT-008 PASS (claim, concurrence, submit/poll, crash window, ledger, timeout, late result, flags, redaction, max 1 job, fal fake transport).

## 12. Suite

**MT-009** — Motion QC (pas démarré). Aucun appel fal / benchmark.
