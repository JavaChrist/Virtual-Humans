# MT-013K-QC-CONSUMER — Production Motion output ingest, QC & Human Review

**Date :** 2026-08-12  
**Auth :** câbler la reprise durable depuis `provider_completed` → Human Review, sans fal réel, flags OFF, 0 écriture Production.

---

## Statut

```text
PRODUCTION_MOTION_POST_QC_CONSUMER_WIRED = YES
FRESH_PROCESS_DRAIN_RECOVERY = PASS
REAL_PROVIDER_CALLS = 0
PRODUCTION_MEDIA_WRITES = 0
FLAGS = OFF
RUNTIME_MOTION = UNAVAILABLE
NEW_DEPLOY_PREFLIGHT_REQUIRED = YES
```

## Chemin canonique

```text
provider terminal completed
→ output descriptor opaque durable (payload.motion)
→ mode=drain reschedule
→ download privé (URL mémoire only / fake en tests)
→ checksum
→ Storage privé director-final-assets …/motion/output/{assetId}.mp4
→ asset motion_provider_output (non actif)
→ quality_report
→ QC technique + mesures Motion unavailable (honnête)
→ needs_review + seed session MT-010
```

Aucune approbation / activation / relance / merge / export automatique.

## Consumer

- Worker / queue existants uniquement (`mode: "drain"`).
- Pas de seconde queue, cron, route parallèle.
- Authority = `production_jobs.payload` (+ `external_job_id`).
- Process Map / stores drain = caches reconstructibles.

## Admission / poll / drain

| Phase | Admission | Submit | Poll | Drain |
|-------|-----------|--------|------|-------|
| Avant submit | ON (si flags) | ON | — | — |
| Après providerJobId persist | OFF | OFF | ON | ON |
| Après Human Review seed | OFF | OFF | OFF (job completed) | OFF |

## QC honnête

- Port Production : `createUnavailableMotionQcMeasurementPort` (`kind: "unavailable"`).
- Fake measurement **interdit** Vercel/Production.
- Mesures Motion / identity / outfit / body / checkpoints → `unavailable`.
- Fidelity `critical` ⇒ `overallStatus = human_review`, `humanValidationRequired = true`.
- Compteur `automaticApproval = 0`.

## Human Review (MT-010)

- Session seedée une fois (`humanReviewHandoffStatus = seeded`).
- Contexte redacted : QC, mesures unavailable, coût, run/job/attempt.
- **APPROVE** : éligible si issues `humanOnly` + attestation (contrat MT-010 existant).  
  Bloqué si `nonRetryable` / `.fail` required non substituable.
- Retry decisions : intent-only (0 job / 0 réservation / 0 provider).

## Idempotence (fresh-process A→B→C→D)

| Compteur | Valeur |
|----------|--------|
| providerSubmitCount | 1 |
| providerPollResubmit | 0 |
| downloadCount | 1 |
| storageObjectCount | 1 |
| assetCount | 1 |
| qualityReportCount | 1 |
| reviewContextCount | 1 |
| automaticApproval | 0 |
| mergeExportCount | 0 |

## Fichiers clés

- `motion-output-drain.ts` — drain steps
- `motion-output-download-port.ts` — fake download
- `unavailable-motion-qc-measurement.ts` — QC Production
- `gated-motion-output-download.ts` — fail-closed hors harness
- `motion-transfer-worker-orchestrator.ts` — `mode=drain`
- `production-motion-transfer.ts` — composition DI
- Tests : `mt013k-qc-consumer.test.ts`

## Migration

**Non requise.**

## Prochaine porte

1. **New deploy-preflight** (wire + durability + QC consumer) — **ne pas lancer dans cette Auth**.  
2. Puis dry-run live complet / Auth payante contrôlée.
