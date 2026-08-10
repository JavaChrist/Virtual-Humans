# 31 — Phase 10D — First Real Script Provider Smoke Test

**Date :** 10 août 2026  
**Entrée :** `32_PHASE_10D_SCRIPT_CONFIG_RECONCILIATION.md` (`READY_FOR_REAUTH`, commit `7c64ac7`)  
**Directeur :** Script uniquement  
**Provider :** OpenAI  
**Plafond :** USD 1.00 (100¢) · **Appels max :** 1

---

## Executive Summary

### Verdict

```text
PASS
```

| Critère | Résultat |
|---|---|
| Exactement 1 appel provider Script réel | **PASS** (`attempt_number=1`, 1 run script) |
| Modèle / knobs canon | **PASS** (`gpt-5.6` ; estimate live 12¢ ⇒ maxOut 4096) |
| `VideoScript` Zod valide | **PASS** (artifact persisté, 5 segments) |
| Artifact + revision actifs | **PASS** (revision 1) |
| MarketingPlan + CreativeConcept inchangés | **PASS** |
| Provenance (correlation / createdBy / run) | **PASS** |
| Budget ≤ 100¢ + réserve = estimate | **PASS** (12¢ réservés / 3¢ commit / 9¢ release) |
| Replay idempotent sans 2ᵉ appel | **PASS** (`status=existing`, même `directorRunId`) |
| Flags remis OFF + redeploy | **PASS** (`CURRENT_RUNTIME_REAL_AI=OFF`) |
| 0 média / 0 worker | **PASS** (`production_jobs=0`) |

Tentative initiale (avant RECONCILE) : **BLOCKED** sans provider — PREP local 7¢/`gpt-5.6-terra` ≠ Production 12¢/`gpt-5.6` (voir historique + `32_…`).

---

## Autorisation (réauth)

```text
PHASE_10D_SMOKE_CONFIRM=ONE_SCRIPT_CALL_MAX_100_CENTS
PHASE_10D_ALLOW_EXECUTE=1
PHASE_10D_DRY_ONLY=0
CONFIRM_PHASE_10D_VERCEL_FLAGS=1
```

```text
J’autorise la Phase 10D (réauth) : un seul appel Script, modèle gpt-5.6,
estimate/réservation 12¢, plafond absolu 100¢, écritures Production bornées
et fermeture immédiate des flags.
```

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
| reasoningEffort / maxOutputTokens (API déployée) | absents sur build ; inferés 4096 via estimate |
| marketingPlanArtifactId | `199284d6-7126-4383-b85f-1ecd74d9528e` rev.1 |
| creativeConceptArtifactId | `11f8f8e0-a280-43aa-a7ea-5e6b0401b72a` rev.1 |
| Marketing/Creative executionAvailable | **false** |

---

## Flags temporairement activés

| Flag | Valeur 10D |
|---|---|
| `DIRECTOR_V2_ENABLED` | 1 |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | 1 |
| `DIRECTOR_V2_PAID_AI_ENABLED` | 1 |
| `DIRECTOR_V2_SCRIPT_AI_ENABLED` | 1 |
| Marketing / Creative / Art / Storyboard / Worker / Paid generation | **0** |

Redeploy ON : `virtual-humans-jny7y0drb-…` → alias Production.  
Redeploy OFF : `virtual-humans-6h75ocswm-…` → alias Production.

---

## Execution

| Champ | Valeur |
|---|---|
| Base | `https://virtual-humans.vercel.app` |
| projectId | `984507af-a89e-4644-8ea3-344797baa974` |
| correlationId | `corr-10d-1786364541945-exec` |
| runId | `b33eb4ba-a39e-48ac-a481-ff29c388df1d` |
| HTTP | 200 |
| status | `completed` |
| model | `gpt-5.6` |
| attempt | 1 |

MarketingPlan / CreativeConcept : **identiques** (rev.1). Aucun replay amont.

---

## Budget / Ledger

| Étape | Minor (USD¢) |
|---|---:|
| Cap porte | 100 |
| Estimate dry-run (E) | 12 |
| Reservation (R) | 12 |
| Actual / commit (A) | **3** |
| Release remainder | **9** |

```text
BUDGET_BLOCKED = NO
reservation == estimate = YES
actual <= reservation = YES
```

Usage (redacted) : input **1831** · output **1190** · reasoning **270** · total **3021**.

---

## VideoScript Validation

```text
VideoScriptSchema.safeParse(artifact.value) → zodOk=true
```

| Champ | Valeur |
|---|---|
| artifact id | `349e2792-3235-4c00-a1da-9e087b0b4d1c` |
| revision | 1 (active) |
| createdBy | `shared-password-user` |
| correlation | `corr-10d-1786364541945-exec` |
| segments | 5 |
| schemaVersion (artifact) | 1.0.0 |

Corps du script : **non imprimé**.

---

## Idempotence

Replay execute → HTTP 200, `status=existing`, même `directorRunId` (`b33eb4ba-…`).

```text
script director_runs on project = 1
attempt_number = 1
```

---

## Fermeture

1. `phase-10d-set-script-flags.mjs off` → SUCCESS_OPS=10  
2. Redeploy OFF : `virtual-humans-6h75ocswm-…`  
3. `phase-10d-verify-flags-off.mjs` → HTTP 404 + `CURRENT_RUNTIME_REAL_AI=OFF`

---

## Preuves locales (gitignorées)

- `studio/.tmp/phase-10d-smoke-exec.json`
- `studio/.tmp/phase-10d-validate-script.json` (si généré)

---

## P1 conservé

```text
BACKUP_PRESENT_RESTORE_UNPROVEN
```

Aucun push. **Pas de Phase 10E.**
