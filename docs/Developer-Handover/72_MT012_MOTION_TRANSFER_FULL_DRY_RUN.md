# 72 — MT-012 Motion Transfer Full Dry-Run & Synthetic E2E Suite

**Date :** 11 août 2026  
**Capability :** `video.motion_transfer`  
**Statut :** `IMPLEMENTED` · Gate MT-012 **PASS**

```text
MOTION_SYNTHETIC_E2E_READY
MT_012_GATE = PASS
REAL_PROVIDER_CALLS = 0
RUNTIME_CAPABILITY = UNAVAILABLE
PRIVACY_DECISIONS = NOT_YET_AUTHORIZED
REMOTE_MIGRATION = NOT_APPLIED
PAID_BENCHMARK = NOT_AUTHORIZED
```

## 1. Mission

Prouver les contrats et transitions du pipeline Motion Transfer **complet** sans fal, sans média réel et sans écriture distante :

```text
Input → validation → media → Registry → Router → Plan → enqueue →
reservation fake → claim → submit fake → poll fake → output → ingest fake →
Motion QC → Human Review → approval/rejection/retry intent → terminal
```

**Hors scope :** appel provider réel, upload/download, migration distante, deploy Vercel, benchmark payant, auto-approve/retry/merge/export.

## 2. Artefacts

| Artefact | Rôle |
|---|---|
| `application/motion/motion-transfer-e2e-harness.ts` | Harness canonique — compose MT-001…011, ne réimplémente pas |
| `application/motion/motion-transfer-dry-run.ts` | Dry-run public redacted (`runMotionTransferPublicDryRun`) |
| `application/motion/__tests__/fixtures/mv001-like-opaque-input.ts` | Fixture coaching opaque (pas de logique Tai-Chi) |
| `application/motion/__tests__/mt012-motion-e2e.test.ts` | Scénarios A–L + ledger + obs + invariants |

## 3. Harness — résultat redacted

Chaque run retourne : phases, IDs internes, fingerprints, ledger (estimate/reserve/commit/release), submit/poll counts, QC, décisions humaines, événements, état final, `providerCalled=false`, `productionWrites=0`.

Invariants quantifiés :

```text
maximumJobsPerInvocation = 1
providerSubmitCount      = 1 (nominal)
pollResubmitCount        = 0
automaticRetryCount      = 0
automaticApprovalCount   = 0
automaticMergeCount      = 0
automaticExportCount     = 0
realProviderCalls        = 0
productionWrites         = 0
```

## 4. Scénario nominal (MV-001 synthétique)

Fidélité `critical` → QC `needs_review` → APPROVE humaine explicite → `approved_pending_ingest`.  
Un enqueue, un claim, un submit, polls ≥ 1 sans resubmit, ledger réglé une fois, replay sans second submit.

## 5. Scénarios E2E (A–L)

| ID | Couverture |
|---|---|
| A | Nominal async + APPROVE |
| B | QC retryable → `retry_same_reference` (0 job) |
| C | `REQUEST_NEW_REFERENCE` append-only |
| D | Rejet technique → REJECT (APPROVE interdite) |
| E | Budget router / réservation insuffisante |
| F | Privacy manquante/expirée (5 clés) |
| G | Registry UNVERIFIED |
| H | `submission_unknown` (crash post-submit) |
| I | Timeout + late quarantine ; cancel_unsupported |
| J | Failures provider (submit/poll/rate/quota/timeout/unknown) |
| K | Idempotence / replay |
| L | Redaction hostile E2E |

## 6. Dry-run public

`runMotionTransferPublicDryRun` :

- Production-like → `runtimeCapability=unavailable` ;
- Harness + registry synthétique → `synthetic_executable` (estimate, fingerprints, QC flags) ;
- MT-005 remote signalé (`remote_migration_absent`) mais **non bloquant** pour le dry-run synthétique ;
- Jamais d’URL, prompt, secret, média.

## 7. Migration

```text
LOCAL_ONLY
NOT APPLIED IN PRODUCTION
Local migrations = 30 · Production = 29 · Drift = MT-005 uniquement
```

## 8. Tests

31 ciblés MT-012 PASS. Suites MT-001…011 + motion providers verts.  
**Ne pas déclarer Production-ready.**

## 9. Suite

**MT-013A** — MV-001 governance readiness — **DONE** (`73_`) · verdict `READY_FOR_HUMAN_GOVERNANCE_DECISIONS`.  
**MT-013B** — Controlled benchmark (1 call max) — **NOT STARTED** · Auth privacy + restore + paid requises.
