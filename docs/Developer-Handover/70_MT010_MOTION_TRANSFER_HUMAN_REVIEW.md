# 70 — MT-010 Motion Transfer Human Review (API + UI)

**Date :** 11 août 2026  
**Capability :** `video.motion_transfer`  
**Statut :** `IMPLEMENTED` · Gate MT-8 Human Review **PASS**

```text
code API/UI = implemented
local DB tests = (see validation)
remote migration = NOT APPLIED
motion runtime = unavailable
real results to review = 0
provider calls = 0
```

## 1. Mission

API + UI de validation humaine Motion Transfer, réutilisant `human_review_decisions` / Director.

Décisions SQL :

```text
approved | rejected | retry_same_reference | retry_updated_constraints | request_new_reference
```

**Hors scope :** retry job, provider, merge, export, migration Production, média réel.

## 2. Système étendu (pas un second framework)

| Composant | Décision |
|---|---|
| `human_review_decisions` + RPC MT-005 | **REUSE** |
| `/quality/review` | **EXTEND** — enum 5 décisions + `reviewRequestId` |
| `PostProductionDirector.recordHumanReview` | **EXTEND** — retries → `blocked` (pas merge_ready) |
| `DeliverySection` | inchangé (QC générique) |
| **NEW** `/motion/review` | contexte Motion QC + décisions (GET/POST) |
| **NEW** `MotionReviewSection` | panneau Director (même shell livraison) |
| MT-009 `MotionQcResult` / quality_report | **CONSUME** via harness sessions |

## 3. Routes API

```text
GET  /api/director/projects/[projectId]/motion/review
POST /api/director/projects/[projectId]/motion/review
POST /api/director/projects/[projectId]/quality/review  (étendues 5 décisions)
```

Auth : proxy Director fail-closed. Scope workspace/project. Capability Motioff / harness vide → 404.

## 4. Helper

`allowedHumanReviewDecisions(qcResult, policy, state)` — pur, déterministe.

## 5. Invariants

- APPROVE : QC ≠ reject ; pas d’issue required non résolue ; attestation si requise ; pas stale
- REJECT / REQUEST_NEW_REFERENCE : justification obligatoire
- RETRY_UPDATED : ref contraintes versionnée (pas inline/URL)
- Retry : `production_jobs delta = 0`, `ledger delta = 0`, `provider calls = 0`
- Idempotence : `reviewRequestId` avant gate révision
- Append-only ; quality report immuable

## 6. UI

`MotionReviewSection` : couches, issues, checkpoints, evidence, coût/provenance redacted, boutons selon allow-list, `useConfirm`, états loading/error/conflict/existing/success. Accessible clavier/labels.

## 7. Migration

```text
20260811180000_vhs_mt005_human_review_decision_extend.sql
status = LOCAL_ONLY
Production apply = NO
```

Aucune nouvelle migration MT-010.

## 8. Fichiers clés

```text
studio/src/domain/motion/review/*
studio/src/application/motion/motion-review-*.ts
studio/src/app/api/director/projects/[projectId]/motion/review/route.ts
studio/src/app/director/_components/motion-review-section.tsx
studio/src/infrastructure/motion/motion-review-harness.ts
studio/src/application/motion/__tests__/mt010-motion-review.test.ts
```

## 9. Suite

**MT-011** Observability/security ou dry-run MT-012 — pas de benchmark payant.
