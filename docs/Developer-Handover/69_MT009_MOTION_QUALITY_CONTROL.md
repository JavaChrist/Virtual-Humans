# 69 — MT-009 Motion Quality Control

**Date :** 11 août 2026  
**Capability :** `video.motion_transfer`  
**Statut :** `IMPLEMENTED` · Gate MT-7 Motion QC **PASS**

```text
Motion QC contracts/orchestration = implemented
measurement adapter real = 0
fake = test only
human review auto = no
paid provider calls = 0
runtime = unavailable
```

## 1. Mission

Architecture Motion QC générique VHS : à partir de métadonnées source, descriptor de sortie, `MotionReferenceSpec`, `MotionQcRequirement[]` et provenance provider/model, produire un `MotionQcResult` versionné (`pass` | `retry` | `human_review` | `reject`).

**Hors scope MT-009 :** moteur OpenPose/DWPose, adaptateur CV/IA réel, appels fal, upload Storage, auto-approval, retry jobs, merge/export, DB distante.

## 2. QC canonique réutilisé / étendu

| Composant | Décision |
|---|---|
| `MotionQcResult` / `MotionReferenceSpec` (MT-001) | **EXTEND** — issues classifiées (`layer`, `requirementClass`, `retryClass`, `reviewIntent`) |
| Artifact `quality_report` (VHS-125 / MT-005) | **MAP** — `kind: motion_qc_result` en mémoire (fake store) |
| Intents review MT-005 | **REUSE** — `RETRY_WITH_*`, `REQUEST_NEW_REFERENCE`, `REJECT`, `APPROVE` (classification only) |
| Worker MT-008 `qc_pending` | **HANDOFF** — phases `qc_passed` / `qc_rejected` / `retry_recommended` |
| `QualityValidatorPort` générique | **NON DUPLIQUÉ** — Motion QC = module dédié composé après `qc_pending` |

Aucun second framework QC Motion parallèle.

## 3. Couches

```text
Technical QC
Motion Fidelity QC
Identity Fidelity QC
Outfit Fidelity QC
Body Integrity QC
Temporal Consistency QC
Camera Compliance QC
Project-Specific Checkpoints (opaques)
Human Review Requirement
```

Pour chaque couche : inputs → measurements → thresholds policy → statut → issues → evidence → comportement si mesure absente (jamais score inventé).

## 4. Technical QC

Fichier : `studio/src/domain/motion/qc/technical.ts`

Vérifie **uniquement** métadonnées (MIME, durée, dimensions, fps, taille, checksum, descriptor complet, contraintes sortie, tolérance durée source/output, ref opaque, pas d’URL publique).  
Ne prétend **pas** vérifier le mouvement.

## 5. Measurement port

```ts
interface MotionQcMeasurementPort {
  measure(input, context): Promise<MotionQcMeasurementSet>;
}
```

- Port : `application/motion/motion-qc-measurement-port.ts`
- Fake configurable : `fake-motion-qc-measurement.ts` — **interdit** Vercel/Production hors harness
- Métriques versionnées : `mt009-measurement-1.0.0`
- **0** adapter réel

## 6. Checkpoints opaques

`evaluateOpaqueCheckpoints` matche les IDs (`checkpointId` / `relationId`), applique seuil/confiance policy, produit PASS/FAIL/UNAVAILABLE.  
Aucune logique métier nommé Tai-Chi / genou / transfert de poids.

## 7. Required / advisory / human_only

| Classe | Effet |
|---|---|
| required FAIL | pas de PASS → `retry` (retryable) ou `reject` |
| required UNAVAILABLE | `human_review` (ou `reject` si policy) |
| advisory FAIL | issue warning, pas de rejet auto |
| human_only | human review obligatoire |
| critical fidelity | human review même si mesures PASS |

## 8. Table de décision (agrégateur)

Priorité :

1. technical invalid → **reject**
2. required FAIL non-retryable → **reject**
3. required FAIL retryable → **retry**
4. required UNAVAILABLE → **human_review** (ou reject per policy)
5. human_only / critical / `humanValidationRequired` → **human_review**
6. all automatic pass + no human → **pass**
7. `pass` + `humanValidationRequired=true` → handoff **needs_review** (`qc_pending`)

## 9. Retry classification → intents MT-005

| `retryClass` | Intent typique |
|---|---|
| retryable | `RETRY_WITH_SAME_REFERENCE` |
| requiresUpdatedConstraints | `RETRY_WITH_UPDATED_CONSTRAINTS` |
| requiresNewReference | `REQUEST_NEW_REFERENCE` |
| nonRetryable | `REJECT` |
| humanOnly | (review) |

MT-009 **ne crée aucun** retry/job.

## 10. Evidence / quality_report

- Descriptors privés `motion_qc_evidence` (pas d’inline média, pas d’URL signée)
- `buildMotionQcQualityReport` + `createMemoryMotionQcReportStore`
- Report immuable (`deepFreeze`) ; évaluation duplicate → idempotente (fingerprint)

## 11. Worker handoff (logique)

```text
qc_pending → QC evaluation → quality_report
  → qc_passed | needs_review | rejected | retry_recommended
```

Tests/fake orchestration uniquement — **pas** de worker Production QC activé.

## 12. Policy

`createSyntheticMotionQcPolicy()` — seuils de test, **pas** de seuils Tai-Chi globaux.  
Policy absente / measurementVersion inconnue → **pas de PASS**.

## 13. Observabilité

Événements redacted : `motion.qc.started|technical.completed|measurements.completed|checkpoint.failed|completed|needs_review|rejected|retry_recommended`.

## 14. Fichiers clés

```text
studio/src/domain/motion/qc/*
studio/src/application/motion/motion-qc-*.ts
studio/src/application/motion/fake-motion-qc-measurement.ts
studio/src/application/motion/assert-motion-qc-fake-allowed.ts
studio/src/application/motion/__tests__/mt009-motion-qc.test.ts
```

## 15. Tests

35 ciblés MT-009 PASS (technical, layers, checkpoints, policy, idempotence, fake guard, redaction, no retry/approve/merge).

## 16. Suite

**MT-010** — Human review UI/API (pas démarré). Aucun appel provider / benchmark.
