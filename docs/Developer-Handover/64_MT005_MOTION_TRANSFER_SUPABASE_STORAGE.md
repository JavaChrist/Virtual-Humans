# 64 — MT-005 Motion Transfer Supabase & Storage

**Date :** 11 août 2026
**Gate :** MT-3 Persistence/Storage
**Verdict :** **PASS**

```text
MT-005 = IMPLEMENTED (local contracts + additive migration)
Gate MT-3 Persistence/Storage = PASS
MT-006 Provider Port = NOT STARTED
remote migration = NOT APPLIED
provider calls = 0
remote writes = 0
runtime = unavailable
P1 = BACKUP_PRESENT_RESTORE_UNPROVEN (ouvert — bloque apply distant / restore drill)
```

## Principe

```text
REUSE existing schema and repositories
→ EXTEND existing contracts/repositories
→ ADD local migration only if a proven invariant cannot be represented
```

Aucune table `motion_*`. Aucun bucket nouveau. Aucun apply Production.

## Audit — matrice

| Besoin | Classification | Représentation |
|---|---|---|
| MotionTransferInput | EXTEND_CODE_ONLY | job.payload fingerprints + assets |
| MotionReferenceSpec | EXTEND_CODE_ONLY | fingerprint / payload (sans média) |
| MotionTransferGenerationPlan | REUSE_AS_IS | `project_artifacts` `generation_plan` |
| MotionTransferRun | REUSE_AS_IS | `production_runs` |
| MotionTransferJob | REUSE_AS_IS | `production_jobs` `action=motion_transfer` |
| MotionTransferAttempt | REUSE_AS_IS | `generation_attempts` |
| MotionTransferResult | REUSE_AS_IS | `production_result` + assets |
| MotionQcResult | EXTEND_CODE_ONLY | `quality_report` value jsonb |
| HumanReviewDecision (retry intents) | LOCAL_MIGRATION_REQUIRED | `human_review_decisions.decision` |
| Tables motion_* / bucket dédié | FUTURE_ONLY | non V1 |
| Ledger / idempotency / audit / outbox | REUSE_AS_IS | inchangé |
| Storage bucket | REUSE_AS_IS | `director-final-assets` (privé) |
| Path builder Motion | EXTEND_CODE_ONLY | 5 segments `/motion/{role}/` |

## Migration locale

```text
studio/supabase/migrations/20260811180000_vhs_mt005_human_review_decision_extend.sql
```

- DROP/ADD CHECK sur `human_review_decisions.decision`
- Allowlist : `approved|rejected|retry_same_reference|retry_updated_constraints|request_new_reference`
- `CREATE OR REPLACE` `persist_human_review_decision` + grants `service_role` only
- **NOT APPLIED** to Production

### Rollback / compatibilité

- Rollback : rétablir CHECK `approved|rejected` uniquement si aucune ligne retry n’existe ; sinon bloquer.
- Compat app : delivery API Director reste `approved|rejected` ; Motion utilise les intents étendus.
- Colonne réelle = `decision` (doc 59_ disait parfois `status` — corrigé).

## Asset roles (provenance)

```text
motion_source_video
motion_identity_reference
motion_outfit_reference
motion_provider_output
motion_qc_evidence
motion_approved_output
```

Stockés dans `assets.provenance.motionRole` — pas de CHECK SQL `kind`.

MIME bornés (alignés bucket) ; plafond générique 50 MiB bucket ; pas de limite provider-specific.

## Path Storage

```text
{workspaceId}/{projectId}/motion/{source|identity|outfit|output|qc|final}/{assetId}.{ext}
bucket = director-final-assets (privé)
```

- UUID only ; pas de nom utilisateur ; anti-`..` ; isolation workspace/project
- Signed URLs : TTL court à la frontière uniquement — jamais dans JSONB/logs/fingerprints

## Lifecycles

**Source :** registered → validated → available → consumed_by_run → retained|expired|quarantined|deleted  
(pas de purge destructive dans MT-005)

**Provider output :** provider_completed → downloaded → checksum_verified → storage_ingested → metadata_persisted → qc_pending → human_review_pending → approved|rejected ; late → `late_quarantined` (pas d’activation auto)

## Code

| Fichier | Rôle |
|---|---|
| `domain/motion/persistence.ts` | matrice, rôles, lifecycles, MIME |
| `application/motion/motion-asset-path.ts` | path builder |
| `application/motion/motion-persistence-port.ts` | port + fake mémoire |
| `domain/postproduction/human-review.ts` | decisions étendues |
| Migration + pgTAP `vhs_mt005_human_review_decision.sql` | CHECK/RPC |

## Interdits respectés

```text
NO PROVIDER PORT/ADAPTER/CALL
NO REAL RUN/JOB/ASSET/LEDGER
NO REMOTE MIGRATION / STORAGE WRITE
NO API/UI / DEPLOY / PUSH
NO DESTRUCTIVE CLEANUP
```

## Suite

**MT-006** — Provider Port (contrat adapter) — **NOT STARTED**.
