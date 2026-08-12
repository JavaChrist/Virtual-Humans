# 102 — Phase 11A-WIRE — OpenAI Image Allowlist (VHS-124)

**Date :** 2026-08-13  
**Nature :** câblage Production Director · **0** appel OpenAI · **0** dépense · **0** job/asset/ledger write  
**Auth humaine :** `11A-WIRE-OPENAI-IMAGE-ALLOWLIST`

```text
VERDICT = OPENAI_IMAGE_PRODUCTION_PATH_WIRED_DISABLED
VHS124_OPENAI_IMAGE_EXCEPTION_WIRED = YES
OPENAI_IMAGE_PRODUCTION_PATH = WIRED_DISABLED
REAL_MEDIA_CALLS = 0
PRODUCTION_MEDIA_WRITES = 0
FLAGS = OFF
RUNTIME_PAID_MEDIA = OFF
PHASE_11A_REQUIRES_NEW_DEPLOY_PREFLIGHT = YES
MV002 = DEFERRED
MOTION_PRODUCTION = DISABLED
```

---

## 1. Verdict

**`OPENAI_IMAGE_PRODUCTION_PATH_WIRED_DISABLED`**

Le chemin canonique Production Director peut désormais résoudre un adapter OpenAI
image **uniquement** derrière l’exception `VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION`
(disabled par défaut).  
`providerMode=real` (wildcard) reste **interdit**.  
Aucun smoke réel, aucun deploy-preflight, aucun flag ouvert dans cette phase.

---

## 2. Pipeline canonique

```text
StoryboardProject (existant, non régénéré)
  → ScenePackageSet (Prompt Director déterministe — dry-run ready)
  → GenerationPlan single-step (scene-2 / image.text_to_image)
  → approval/gates (future Auth execute)
  → Production run/job/attempt
  → worker canonique run-once
  → OpenAI image adapter (allowlist)
  → output mémoire → Storage privé director-final-assets
  → QC technique → Human Review (obligatoire)
  → activation manuelle seulement
```

**Interdit :** `/api/generate/image` · script provider · worker/queue parallèle ·
Motion · fake comme PASS Production · `providerMode=real`.

---

## 3. Exception VHS-124

| Champ | Valeur |
|---|---|
| Id | `VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION` |
| Env | `VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION` (`1`/`true` only) |
| Default | **OFF** |
| Capability | `image.text_to_image` only |
| Provider | `openai` only |
| Model | `gpt-image-1` only |
| Quality / size | `low` / `1024x1024` |
| Project | `984507af-a89e-4644-8ea3-344797baa974` |
| Scene | `scene-2` · intent `text_motion` |
| Expiry | `2026-09-30T23:59:59.000Z` |
| Max calls/jobs/outputs | 1/1/1 |
| Max reservation | **2¢** |
| Retry / fallback / downstream | **0 / 0 / OFF** |
| Motion / video / voice / lipsync / compose | **impossible** via cette exception |
| Registry claim | **ne déclare pas** la compatibilité globale providers réels |

Code :  
`studio/src/application/production/phase-11a-openai-image-allowlist.ts`  
`studio/src/infrastructure/providers/vhs124-openai-image-exception.ts`  
Wiring : `createDirectorPersistenceStack` → `resolveDirectorProviderAdapters`.

---

## 4. Artifacts déterministes

| Artifact | Statut code | Note |
|---|---|---|
| ScenePackageSet | Prompt Director existant + sélection scene-2 | dry-run sans provider |
| GenerationPlan single-step | `buildPhase11ASingleStepGenerationPlan` | stratégie lib `product_demo` **image only** |
| Prompt structuré | `buildPhase11AImagePromptFromScenePackage` | hash persistable ; prompt full memory-only |
| Marketing…Storyboard | **non régénérés** | lecture seule |

Fingerprint stable : hash (project, scene, model, quality, size, promptHash, revisions).

---

## 5. Adapter / pricing / worker

| Item | Détail |
|---|---|
| Adapter | `createOpenAIImageAdapter` + wrap allowlist |
| Client | `createCallTimeOpenAIImageClient` — clé **call-time only** |
| Sync | oui (pas de poll) |
| Estimate | `estimateImage(1024x1024, low)` → **1¢** ($0.011) |
| Réservation future max | **2¢** |
| Submit max | **1** |
| Base64 | décodé mémoire bornée → jamais DB/log/events |
| Storage path | `{ws}/{project}/media/image/{assetId}.png` bucket privé |
| Asset lifecycle | non actif jusqu’à HR approve |
| Ledger | reserve/commit/release contrat existant — **0 write cette phase** |
| QC | technique MIME/dims/size/checksum ; visual = `unavailable_humanOnly` |
| Human Review | obligatoire ; append-only ; pas d’auto-activation |

Compteurs smoke : `providerSubmitCount` · `outputDownloadCount` ·
`storageWriteCount` · `assetInsertCount` · `ledgerSettlementCount` (max 1 chacun).

---

## 6. Isolation

- Legacy `/api/generate/image` : guard `legacyEndpoint`  
- Motion : `phase-11a-motion-isolation` + allowlist refuse `motion_transfer`  
- MV-002 reste **DEFERRED**  
- Fake interdit sur chemin réel allowlist  
- `assertDirectorProductionUsesFakes("real")` throw inchangé

---

## 7. Dry-run local (sans provider)

`phase11AOpenAIImageAllowlistDryRun()` →  
`providerCalled=false` · `executable=true` · `pathStatus=WIRED_DISABLED` (défaut) ·
estimate/reservation exposés depuis catalogue réel (pas de forçage artificiel).

---

## 8. Tests

| Suite | Résultat |
|---|---|
| `phase-11a-openai-image-allowlist` | **PASS** |
| `phase-11a-media-prep-guards` / resume-isolation | **PASS** |
| Unitaires studio | **1521/1521** |
| typecheck | **PASS** |
| lint | **0 errors** (warnings préexistants) |
| build | (voir CI locale) |
| migrations-static | **PASS** |
| REAL_MEDIA_CALLS | **0** |
| PRODUCTION_MEDIA_WRITES | **0** |

---

## 9. Prochaine porte exacte

```text
NEXT = 11A-PREFLIGHT-LIVE-NO-PROVIDER
THEN  = 11A-HUMAN-AUTH-OPENAI-IMAGE-SMOKE (appel réel 1× — Auth séparée)
DO_NOT = OpenAI call · reserve · flags ON · deploy manuel · MV-002 · Motion
```

Préflight live **sans** provider, puis Auth distincte pour l’appel OpenAI réel.

---

## 10. Fichiers clés

- `phase-11a-openai-image-allowlist.ts`
- `phase-11a-single-step-plan.ts`
- `phase-11a-image-prompt.ts`
- `phase-11a-image-technical-qc.ts` / `phase-11a-image-quality-port.ts`
- `phase-11a-human-review-gate.ts`
- `vhs124-openai-image-exception.ts`
- `openai-image-adapter.ts` (quality/forceSize/estimate)
- `director-server.ts` (resolve adapters + scoped engine + QC)
