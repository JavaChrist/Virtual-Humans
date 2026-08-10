# 34 — Phase 10E — First Real Art Director Text Smoke

**Date :** 10 août 2026  
**Entrée :** `33_PHASE_10E_ART_TEXT_SMOKE_PREP.md` (`READY_FOR_HUMAN_AUTH`, commit `513f31f`)  
**Directeur :** Art texte uniquement  
**Provider :** OpenAI  
**Plafond :** USD 1.00 (100¢) · **Appels max :** 1

---

## Executive Summary

### Verdict

```text
BLOCKED
```

| Critère | Résultat |
|---|---|
| Préconditions + dry-run local | **PASS** |
| Dry-run live = PREP (`gpt-5.6` / `medium` / `4096` / 13¢) | **PASS** |
| Exactement 1 appel provider Art réel | **PASS** (`attempt_number=1`) |
| `VisualDirection` Zod / artifact actif | **FAIL** (`invalid_candidate`, aucun artifact) |
| Artifacts amont inchangés | **PASS** |
| Budget ≤ 100¢ + réserve = estimate | **PASS** (13¢ / 12¢ commit / 1¢ release) |
| 0 retry / 0 fallback / 0 Storyboard / 0 média / 0 worker | **PASS** |
| Flags remis OFF + redeploy | **PASS** (`CURRENT_RUNTIME_REAL_AI=OFF`) |
| Replay idempotent | **N/A** (réservé au succès) |

Le provider a répondu ; la validation domaine a rejeté le candidat (`Continuité lieu required non respectée.`). Aucun second appel. Fermeture runtime prouvée.

---

## Autorisation

```text
PHASE_10E_SMOKE_CONFIRM=ONE_ART_TEXT_CALL_MAX_100_CENTS
PHASE_10E_ALLOW_EXECUTE=1
PHASE_10E_DRY_ONLY=0
CONFIRM_PHASE_10E_VERCEL_FLAGS=1
```

```text
J’autorise la Phase 10E : un seul appel Art texte, modèle gpt-5.6,
estimate/réservation 13¢ sous réserve de confirmation identique au dry-run live,
plafond absolu 100¢, écritures Production bornées, PAID_GENERATION et worker
maintenus OFF, et fermeture immédiate des flags.
```

---

## Préconditions

| Check | Résultat |
|---|---|
| Working tree propre @ `513f31f` | PASS |
| Runtime AI OFF | PASS |
| MarketingPlan / CreativeConcept / VideoScript rev.1 Zod actifs | PASS |
| `visual_direction` actif absent | PASS |
| Snapshot personnage / assets critiques | **N/A** (`characterId=null`) |
| Dry-run local sans provider | PASS (13¢) |

---

## Dry-run Production (avant appel)

| Champ | Valeur (live) |
|---|---|
| providerCalled | false |
| executable | true |
| executionAvailable | true |
| pricingConfigured | true |
| model | `gpt-5.6` |
| reasoningEffort | `medium` |
| maxOutputTokens | 4096 |
| estimatedCostMinor | **13** |
| Marketing / Creative / Script executionAvailable | **false** |
| existingVisualDirection | false |

Preuve : `studio/.tmp/phase-10e-live-gate.json`.

---

## Flags temporairement activés

| Flag | Valeur 10E |
|---|---|
| `DIRECTOR_V2_ENABLED` | 1 |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | 1 |
| `DIRECTOR_V2_PAID_AI_ENABLED` | 1 |
| `DIRECTOR_V2_ART_AI_ENABLED` | 1 |
| Marketing / Creative / Script / Storyboard / Worker / Paid generation | **0** |

Redeploy ON : `virtual-humans-fktrgn9zm-…` → alias Production.  
Redeploy OFF : `virtual-humans-312q9i167-…` → alias Production (`dpl_C7UjvkSyAwTCVE48jWg2hJ1ANvo8`).

---

## Execution

| Champ | Valeur |
|---|---|
| Base | `https://virtual-humans.vercel.app` |
| projectId | `984507af-a89e-4644-8ea3-344797baa974` |
| correlationId | `corr-10e-1786366222453-exec` |
| runId | `53fb45c3-0d36-43d9-9882-6a96fde2a814` |
| HTTP | **422** |
| status | `failed` |
| error.code | `invalid_candidate` (retryable=false) |
| message | Continuité lieu required non respectée. |
| model | `gpt-5.6` |
| attempt | 1 |
| outputArtifactId | null |
| hasVisualDirection | false |

Corps `VisualDirection` : **non produit / non imprimé**.  
`/art/retry` : **non utilisé**. Aucun fallback. Aucun Storyboard. Aucun média.

---

## Budget / Ledger

| Étape | Minor (USD¢) |
|---|---:|
| Cap porte | 100 |
| Estimate dry-run (E) | 13 |
| Reservation (R) | 13 |
| Actual / commit (A) | **12** |
| Release remainder | **1** |

```text
BUDGET_BLOCKED = NO
reservation == estimate = YES
actual <= reservation = YES
```

Usage (redacted) : input **3092** · output **3889** · reasoning **332** · total **6981**.

Ledger keys :

- `dir-reserve-53fb45c3-…`
- `dir-fail-commit-53fb45c3-…`
- `dir-fail-release-rem-53fb45c3-…`

---

## VisualDirection Validation

```text
VisualDirectionSchema → N/A (aucun artifact persisté)
active visual_direction → absent
```

---

## Artifacts amont (inchangés)

| Type | artifact_id | revision |
|---|---|---:|
| MarketingPlan | `199284d6-7126-4383-b85f-1ecd74d9528e` | 1 |
| CreativeConcept | `11f8f8e0-a280-43aa-a7ea-5e6b0401b72a` | 1 |
| VideoScript | `349e2792-3235-4c00-a1da-9e087b0b4d1c` | 1 |

---

## Idempotence

Non exécutée (réservée au succès uniquement). Second appel provider évité par règle dure (pas de retry).

```text
art director_runs on project (cette fenêtre) = 1
attempt_number = 1
```

---

## Fermeture

1. `CONFIRM_PHASE_10E_VERCEL_FLAGS=1 node scripts/phase-10e-set-art-flags.mjs off` → SUCCESS_OPS=10  
2. Redeploy OFF : `virtual-humans-312q9i167-…`  
3. `phase-10e-verify-flags-off.mjs` → HTTP 404 `Persistance Director désactivée.` + `CURRENT_RUNTIME_REAL_AI=OFF`  
4. Snapshot flags : tous Director AI / paid generation / worker **0** (vides / off)

---

## Preuves locales (gitignorées)

- `studio/.tmp/phase-10e-live-gate.json`
- `studio/.tmp/phase-10e-smoke-exec.json`
- `studio/.tmp/phase-10e-post-fail-evidence.json`

---

## P0 / P1

```text
P0 = none (runtime OFF prouvé)
P1 = BACKUP_PRESENT_RESTORE_UNPROVEN (conservé)
P1 = ART_INVALID_CANDIDATE_CONTINUITE_LIEU (smoke Art texte non validé — réauth / correctif domaine requis avant nouvel appel)
```

Aucun push. **Pas de Storyboard. Pas de média.**
