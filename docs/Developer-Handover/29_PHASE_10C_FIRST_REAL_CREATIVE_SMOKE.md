# 29 — Phase 10C — First Real Creative Provider Smoke Test

**Date :** 10 août 2026  
**Entrée :** `28_PHASE_10C_CREATIVE_SMOKE_PREP.md` (`READY_FOR_HUMAN_AUTH`)  
**Directeur :** Creative uniquement  
**Provider :** OpenAI (adapter Creative existant)  
**Plafond :** USD 1.00 (100¢) · **Appels max :** 1

---

## Executive Summary

### Verdict

```text
PASS
```

| Critère | Résultat |
|---|---|
| Exactement 1 appel provider texte réel | **PASS** (`attempt_number=1`, 1 run creative) |
| Creative Director seulement | **PASS** (Marketing non rejoué ; Script/Art/Storyboard absents) |
| `CreativeConcept` Zod valide | **PASS** (artifact persisté) |
| Artifact + revision active | **PASS** (revision 1) |
| Provenance (correlation / createdBy / run) | **PASS** |
| Budget ≤ 100¢ + réserve = estimate | **PASS** (12¢ réservés / 5¢ commit / 7¢ release) |
| Replay idempotent sans 2ᵉ appel | **PASS** (`status=existing`, même `directorRunId`) |
| Flags remis OFF + redeploy | **PASS** (`CURRENT_RUNTIME_REAL_AI=OFF`) |
| 0 média / 0 worker | **PASS** (`production_jobs=0`) |

---

## Autorisation

```text
PHASE_10C_SMOKE_CONFIRM=ONE_CREATIVE_CALL_MAX_100_CENTS
PHASE_10C_ALLOW_EXECUTE=1
PHASE_10C_DRY_ONLY=0
CONFIRM_PHASE_10C_VERCEL_FLAGS=1
```

Autorisation humaine : un seul appel Creative, plafond absolu 100¢, écritures Production bornées, fermeture immédiate des flags.

---

## Dry-run Production (avant appel)

| Champ | Valeur |
|---|---|
| executable | true |
| executionAvailable | true |
| providerCalled | false |
| pricingConfigured | true |
| estimatedCostMinor | **12** |
| model | `gpt-5.6` |
| promptVersion | `creative-analyzer-v5` |
| schemaVersion | `1.2.0` |
| marketingPlanArtifactId | `199284d6-7126-4383-b85f-1ecd74d9528e` |
| marketingPlanRevision | 1 |

---

## Flags temporairement activés

Production uniquement.

| Flag | Valeur 10C |
|---|---|
| `DIRECTOR_V2_ENABLED` | 1 |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | 1 |
| `DIRECTOR_V2_PAID_AI_ENABLED` | 1 |
| `DIRECTOR_V2_CREATIVE_AI_ENABLED` | 1 |
| `DIRECTOR_V2_MARKETING_AI_ENABLED` | **0** |
| `DIRECTOR_V2_SCRIPT_AI_ENABLED` | **0** |
| `DIRECTOR_V2_ART_AI_ENABLED` | **0** |
| `DIRECTOR_V2_STORYBOARD_AI_ENABLED` | **0** |
| `DIRECTOR_V2_WORKER_ENABLED` | **0** |
| `DIRECTOR_V2_PAID_GENERATION_ENABLED` | **0** |

Redeploy ON : `virtual-humans-qat2uy9v4-…` → alias `virtual-humans.vercel.app`.

---

## Execution

| Champ | Valeur |
|---|---|
| Base | `https://virtual-humans.vercel.app` |
| projectId | `984507af-a89e-4644-8ea3-344797baa974` |
| correlationId | `corr-10c-1786361553365-exec` |
| runId | `f398d325-9af4-476f-a126-a85fcf8fdb13` |
| HTTP | 200 |
| status | `completed` |
| model | `gpt-5.6` |
| attempt | 1 |

MarketingPlan réutilisé : **identique** (`199284d6-…` rev.1). Aucun nouveau MarketingPlan.

---

## Budget / Ledger

| Étape | Minor (USD¢) |
|---|---:|
| Cap porte | 100 |
| Estimate dry-run (E) | 12 |
| Reservation (R) | 12 |
| Actual / commit (A) | 5 |
| Release remainder | 7 |

```text
BUDGET_BLOCKED = NO
reservation == estimate = YES
actual <= reservation = YES
```

---

## CreativeConcept Validation

```text
CreativeConceptSchema.safeParse(artifact.value) → zodOk=true
```

| Champ | Valeur |
|---|---|
| artifact id | `11f8f8e0-a280-43aa-a7ea-5e6b0401b72a` |
| revision | 1 (active) |
| createdBy | `shared-password-user` |
| correlation | `corr-10c-1786361553365-exec` |
| emotionalArc beats | 5 |
| schemaVersion (artifact) | 1.0.0 |

---

## Idempotence

Replay execute → HTTP 200, `status=existing`, même `directorRunId` (`f398d325-…`), durée ~1.8 s.

```text
creative_runs total on project = 1
attempt_number = 1
```

---

## Fermeture

1. `phase-10c-set-creative-flags.mjs off` → SUCCESS_OPS=10  
2. Redeploy OFF : `virtual-humans-jhgfhs544-…` → alias Production  
3. `phase-10c-verify-flags-off.mjs` → HTTP 404 + `CURRENT_RUNTIME_REAL_AI=OFF`

---

## Preuves locales (gitignorées)

- `studio/.tmp/phase-10c-smoke-exec.json`
- Scripts : `smoke-phase-10c-creative-vercel.mjs`, `phase-10c-set-creative-flags.mjs`, `phase-10c-replay-idempotence.mjs`, `phase-10c-verify-flags-off.mjs`, `phase-10c-validate-concept.mjs`

---

## P1 conservé

```text
BACKUP_PRESENT_RESTORE_UNPROVEN
```

Aucun push.
