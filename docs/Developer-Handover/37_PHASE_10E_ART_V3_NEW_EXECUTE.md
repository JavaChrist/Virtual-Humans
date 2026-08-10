# 37 — Phase 10E-V3 — New Art Text Execute under `art-analyzer-v3`

**Date :** 10 août 2026  
**Entrée :** `36_PHASE_10E_ART_V3_NEW_EXECUTE_PREP.md` (`READY_FOR_HUMAN_AUTH`, commit `286fd9f`)  
**Directeur :** Art texte uniquement — nouvel execute (pas `/art/retry`)  
**Provider :** OpenAI  
**Plafond :** USD 1.00 (100¢) · **Nouveaux appels max :** 1

---

## Executive Summary

### Verdict

```text
PASS
```

| Critère | Résultat |
|---|---|
| Exactement 1 nouvel appel Art réel | **PASS** (`attempt_number=1`) |
| Contrat `art-analyzer-v3` / schema `1.1.0` | **PASS** |
| Dry-run live = PREP (13¢ / medium / 4096) | **PASS** |
| Zod + continuité métier | **PASS** (persisté, 5 segments) |
| `visual_direction` rev.1 actif | **PASS** |
| Run v2 + ledger v2 immuables | **PASS** |
| Amont Marketing/Creative/Script inchangés | **PASS** |
| Ledger v3 13/12/1¢ | **PASS** |
| Replay `existing` sans 2ᵉ appel | **PASS** |
| Flags OFF + runtime OFF | **PASS** |
| 0 Storyboard / média / worker | **PASS** |

---

## Autorisation

```text
PHASE_10E_V3_SMOKE_CONFIRM=ONE_NEW_ART_V3_CALL_MAX_100_CENTS
PHASE_10E_V3_ALLOW_EXECUTE=1
PHASE_10E_V3_DRY_ONLY=0
CONFIRM_PHASE_10E_VERCEL_FLAGS=1
```

```text
J’autorise la Phase 10E-V3 : un seul nouvel appel Art texte sous
art-analyzer-v3, modèle gpt-5.6, estimate/réservation 13¢ sous réserve de
confirmation identique au dry-run live, plafond absolu 100¢, écritures
Production bornées, run v2 failed immuable, sans /art/retry,
PAID_GENERATION et worker OFF, et fermeture immédiate des flags.
```

---

## Run v2 (immuable)

| Champ | Valeur |
|---|---|
| id | `53fb45c3-0d36-43d9-9882-6a96fde2a814` |
| prompt | `art-analyzer-v2` |
| status / error | `failed` / `invalid_candidate` |
| ledger | reserve 13 / commit 12 / release 1 |

---

## Dry-run Production (avant appel)

| Champ | Valeur live |
|---|---|
| providerCalled | false |
| executable / executionAvailable | true |
| provider | openai |
| model | `gpt-5.6` |
| reasoningEffort | `medium` |
| maxOutputTokens | 4096 |
| promptVersion | `art-analyzer-v3` |
| schemaVersion | `1.1.0` |
| idempotencyKeyVersion | `art-analyzer-v3:1.1.0` |
| previousFailedRunIgnoredForNewContract | true |
| estimatedCostMinor | **13** |
| retryCandidate | absent |

---

## Flags / redeploys

Matrice : Art ON ; Marketing/Creative/Script/Storyboard/PAID_GENERATION/Worker **0**.

- Redeploy ON : `virtual-humans-dryhejrac-…` → alias Production  
- Redeploy OFF : `virtual-humans-f55gpdw6k-…` → alias Production  
- Verify : `CURRENT_RUNTIME_REAL_AI=OFF` (HTTP 404 persistance)

---

## Execution

| Champ | Valeur |
|---|---|
| path | `POST /art` (jamais `/art/retry`) |
| correlationId | `corr-10e-v3-1786369471352-exec` |
| runId | `51d47124-54eb-41c1-8d03-3dbb5a8b7b1e` |
| attempt / retry_of | **1** / **null** |
| HTTP / status | 200 / `completed` |
| prompt / schema | `art-analyzer-v3` / `1.1.0` |
| model | `gpt-5.6` |

Corps VisualDirection : **non imprimé**.

---

## VisualDirection

| Champ | Valeur |
|---|---|
| artifact id | `49481462-6444-41f9-8c48-7e7d32c09f1b` |
| revision active | **1** |
| schemaVersion (artifact) | `1.0.0` |
| segments | 5 |
| createdBy | `shared-password-user` |
| correlation | `corr-10e-v3-1786369471352-exec` |

---

## Budget / Ledger v3

| Étape | Minor (USD¢) |
|---|---:|
| Estimate / Reservation | 13 / 13 |
| Actual / commit | **12** |
| Release remainder | **1** |

Usage : in **3311** · out **3671** · reasoning **195** · total **6982**.

---

## Artifacts amont (inchangés)

| Type | id | rev |
|---|---|---:|
| MarketingPlan | `199284d6-7126-4383-b85f-1ecd74d9528e` | 1 |
| CreativeConcept | `11f8f8e0-a280-43aa-a7ea-5e6b0401b72a` | 1 |
| VideoScript | `349e2792-3235-4c00-a1da-9e087b0b4d1c` | 1 |

---

## Idempotence

Replay `POST /art` → HTTP 200, `status=existing`, même `directorRunId` `51d47124-…`.

```text
art director_runs on project = 2 (v2 failed + v3 completed)
production_jobs = 0
```

---

## P1 conservé

```text
BACKUP_PRESENT_RESTORE_UNPROVEN
```

Aucun push. **Pas de Storyboard. Pas de média.**
