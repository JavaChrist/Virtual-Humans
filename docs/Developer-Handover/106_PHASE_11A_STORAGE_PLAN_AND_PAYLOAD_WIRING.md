# 106 — Phase 11A — Storage, Plan Materialize & Payload Sanitization

**Date :** 2026-08-13  
**Auth :** `AUTH_11A_WIRE_STORAGE_STRIP_BASE64_AND_MATERIALIZE_PLAN`  
**Nature :** câblage applicatif · **0** appel OpenAI · **0** write Production · flags **OFF**  
**Ops 14 août 2026 :** overlay déterministe / provider no-text = WIRED_DISABLED (`111_`) · copy overlay retiré du variant (`113_`) — ce rapport historique n’est pas réécrit.

```text
VERDICT = READY_FOR_NEW_11A_LIVE_PREFLIGHT
PHASE_11A_CANONICAL_PLAN_MATERIALIZED = YES
OPENAI_IMAGE_PRIVATE_STORAGE_INGEST_WIRED = YES
PERSISTED_BASE64_POSSIBLE = NO
OPENAI_IMAGE_PRODUCTION_PATH = WIRED_DISABLED
REAL_MEDIA_CALLS = 0
PRODUCTION_MEDIA_WRITES = 0
FLAGS = OFF
RUNTIME_PAID_MEDIA = OFF
NEW_LIVE_PREFLIGHT_REQUIRED = YES
COMPOSITION_VERSION = phase-11a-storage-plan-materialize-1.0.0
COMPOSITION_FINGERPRINT = c532c400334f5b22
```

---

## 1. Verdict

**`READY_FOR_NEW_11A_LIVE_PREFLIGHT`**

Le pipeline Production canonique matérialise désormais un GenerationPlan
single-step via `POST /routing`, ingère l’image en Storage privé, et empêche
la persistance de base64 / data URL dans `production_runs.state`.

Aucun flag ouvert. Aucun provider. Aucune écriture métier Production dans cette phase.

---

## 2. Pipeline canonique

```text
Storyboard actif
  → ScenePackageSet déterministe (Prompt Director)
  → POST /routing (branche VHS-124 → buildPhase11ASingleStepGenerationPlan)
  → GenerationPlan single-step (scene-2 / openai / gpt-image-1 / low / 1024)
  → approvals / gates
  → production_run / job / attempt
  → worker run-once
  → adapter OpenAI Image (mémoire)
  → decode + QC technique
  → ingest director-final-assets (media/image/{assetId}.png)
  → asset active=false + HR needs_review
  → aucun downstream
```

---

## 3. Changements clés

| Zone | Fichiers |
|---|---|
| Routing | `route-for-project.ts` → `tryPhase11ASingleStep` |
| Plan | `phase-11a-single-step-plan.ts` (UUID déterministe) |
| Sanitize | `phase-11a-persisted-state-sanitize.ts` + `production-run-store.ts` |
| Ingest | `phase-11a-image-storage-ingest.ts` + `supabase-phase11a-image-content-port.ts` |
| Worker path | `production-director.ts` `handleEngineResult` + `director-server.ts` |
| Counters / FP | `phase-11a-openai-image-allowlist.ts` |
| Dry-run | `scripts/phase-11a-storage-plan-materialize-dry-run.mjs` |
| Tests | `phase-11a-storage-plan-materialize.test.ts` |

---

## 4. Vérification runtime (preflight futur)

Ne **pas** traiter un commit docs-only comme preuve de composition.

Méthode fiable :

1. SHA applicatif exact du commit de cette phase (après push) ;
2. **et** `compositionFingerprint = c532c400334f5b22`  
   (`phase11ARuntimeCompositionFingerprint()` / dry-run local / champ routing dry) ;
3. build logs Vercel : `Commit: <sha applicatif>` ;
4. dry-run local : `storageIngestWired=true` · `persistedMediaPayloadPossible=false`.

Si un commit documentaire auto-déploie après coup, le fingerprint fonctionnel
reste le critère de composition ; le preflight doit exiger le SHA applicatif
**ou** prouver que le build embarque ce fingerprint.

---

## 5. Dry-run local (extrait)

```text
providerCalled=false
executable=true
canonicalRouting=true
generationPlanMaterialized=true
singleStep=true
storageIngestWired=true
persistedMediaPayloadPossible=false
assetActive=false
humanReviewRequired=true
estimateMinor=1
reservationMinor=2
```

---

## 6. Crash / idempotence

| Fenêtre | Comportement |
|---|---|
| Avant provider | aucun output |
| Après provider, avant Storage | `provider_result_not_durably_ingested` · **pas** de resubmit auto |
| Après Storage, avant asset | reconcile checksum/path · pas de rewrite divergent |
| Après asset | replay → même asset · counters ≤ 1 |

---

## 7. Interdictions respectées

- 0 OpenAI · 0 réservation · 0 run/job/attempt Production  
- 0 Storage Production · flags OFF · pas de deploy manuel  
- Auth payante précédente **non consommée** et **non réutilisable** sans nouveau preflight + Auth

---

## 8. Prochaine porte

```text
NEXT = DONE → voir `107_` (READY_FOR_11A_PAID_AUTH · 7a67c77)
THEN = 11A-PAID-OPENAI-IMAGE-SMOKE-ONCE (nouvelle Auth)
DO_NOT = OpenAI sans Auth payante · legacy · Motion
```
