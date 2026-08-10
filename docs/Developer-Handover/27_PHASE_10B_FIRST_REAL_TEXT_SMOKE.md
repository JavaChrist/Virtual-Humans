# 27 — Phase 10B — First Real Text Provider Smoke Test

**Date :** 10 août 2026  
**Entrée :** `26_PHASE_10AD_LOCAL_DB_SAFE_REDEPLOY.md` (`GO_FOR_10B`)  
**Directeur :** Marketing uniquement  
**Provider :** OpenAI (adapter Marketing existant)  
**Plafond :** USD 1.00 · **Appels max :** 1

---

## Executive Summary

### Verdict

```text
PASS
```

| Critère | Résultat |
|---|---|
| Exactement 1 appel provider texte réel | **PASS** (`attempt_number=1`, 1 run marketing) |
| Marketing Director seulement | **PASS** (aucun Creative/Script/Art/Storyboard) |
| `MarketingPlan` Zod valide | **PASS** (artifact persisté) |
| Artifact + revision active | **PASS** (revision 1) |
| Provenance (correlation / createdBy / run) | **PASS** |
| Budget ≤ $1 + réserve avant appel | **PASS** (E=R=24¢) |
| Coût rapproché | **PASS** (D=A=4¢) |
| Aucun média / worker | **PASS** |
| Flags remis OFF + redeploy | **PASS** (`CURRENT_RUNTIME_REAL_AI=OFF`) |

```text
CURRENT_RUNTIME_REAL_AI = OFF
```

---

## Preflight

```text
Director = Marketing
real provider = enabled (temporaire)
Creative = disabled
Script = disabled
Art = disabled
Storyboard = disabled
worker = disabled
paid media = disabled
maxAttempts = 1
budget cap <= $1.00
```

Dry-run Production (avant appel) :

| Champ | Valeur |
|---|---|
| executable | true |
| executionAvailable | true |
| providerCalled | false |
| pricingConfigured | true |
| estimatedCostMinor | **24** |
| model | `gpt-5.6` |
| promptVersion | `marketing-analyzer-v2` |
| schemaVersion | `1.0.0` |

```text
READY_FOR_SINGLE_REAL_PROVIDER_CALL
provider=openai model=gpt-5.6 estimatedCostMinor=24 capMinor=100 maxCalls=1
```

---

## Flags Temporarily Enabled

Production uniquement (Preview inchangé à `0`).

| Flag | Avant | Valeur 10B | Pourquoi |
|---|---|---|---|
| `DIRECTOR_V2_ENABLED` | 0 | **1** | Gate API Director |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | 0 | **1** | Projet + artifact |
| `DIRECTOR_V2_PAID_AI_ENABLED` | 0 | **1** | `canExecuteMarketingAi` |
| `DIRECTOR_V2_MARKETING_AI_ENABLED` | 0 | **1** | Adapter Marketing |
| `DIRECTOR_V2_CREATIVE_AI_ENABLED` | 0 | **0** | Pas d’enchaînement |
| `DIRECTOR_V2_SCRIPT_AI_ENABLED` | 0 | **0** | Pas d’enchaînement |
| `DIRECTOR_V2_ART_AI_ENABLED` | 0 | **0** | Pas d’enchaînement |
| `DIRECTOR_V2_STORYBOARD_AI_ENABLED` | 0 | **0** | Pas d’enchaînement |
| `DIRECTOR_V2_WORKER_ENABLED` | 0 | **0** | Pas de worker |
| `DIRECTOR_V2_PAID_GENERATION_ENABLED` | 0 | **0** | Pas de média |

Redeploy ON : `virtual-humans-cse31rdtp-…` → alias `virtual-humans.vercel.app` (~6m).

Aucun secret / clé provider / variable Supabase modifié.

---

## Provider / Model

| Champ | Valeur |
|---|---|
| Provider | `openai` |
| Modèle | `gpt-5.6` |
| Chemin | Director Marketing → `createOpenAIMarketingAnalyzerAdapter` → Responses API |
| Attempt | 1 |

---

## Budget

| Étape | Minor (USD¢) |
|---|---:|
| Cap porte | 100 |
| Estimate dry-run (E) | 24 |
| Reservation (R) | 24 |
| Actual / derived (D) | 4 |
| Ledger commit (A) | 4 |
| Ledger release remainder | 20 |

```text
BUDGET_BLOCKED = NO
BUDGET_GUARD_NOT_PROVEN = NO
```

---

## Execution

| Champ | Valeur |
|---|---|
| Base | `https://virtual-humans.vercel.app` |
| projectId | `984507af-a89e-4644-8ea3-344797baa974` |
| correlationId | `corr-10b-1786322400744-exec` |
| runId | `7353a60b-ed0d-4f4c-9400-48b0f1498d0b` |
| HTTP | 200 |
| status | `completed` |
| duration (approx.) | ~21 s (run → artifact) |
| usage | in=1110 out=1583 reasoning=277 total=2693 |

Brief : présentation LinkedIn Virtual Humans Studio (30s, ton professionnel) — **MarketingPlan seulement**.

Scripts locaux utilisés (non commit requis) :

- `studio/scripts/phase-10b-set-marketing-flags.mjs`
- `studio/scripts/smoke-phase-10b-marketing-vercel.mjs`
- `studio/scripts/phase-10b-validate-plan.mjs`
- `studio/scripts/phase-10b-replay-idempotence.mjs`
- `studio/scripts/phase-10b-verify-flags-off.mjs`

---

## MarketingPlan Validation

```text
MarketingPlanSchema.safeParse(artifact.value) → zodOk=true
```

| Champ | Valeur |
|---|---|
| artifact id | `199284d6-7126-4383-b85f-1ecd74d9528e` |
| revision | 1 (active) |
| marketingObjective | awareness |
| tone | professional |
| videoStyle | educational |
| keyMessages | 3 |
| schemaVersion | 1.0.0 |

---

## Persistence / Provenance

| Élément | Preuve |
|---|---|
| Brief actif | revision 1, `created_by=shared-password-user` |
| Marketing plan actif | revision 1, même projet |
| correlation | `corr-10b-1786322400744-exec` |
| createdBy | `shared-password-user` |
| director_run | `marketing` / `completed` / `cost_status=committed` |
| output_artifact_id | = artifact marketing |
| production_jobs / assets | **0** |

---

## Cost Reconciliation

```text
E = 24
R = 24
D = 4   (director_runs.actual_cost_minor + usage tokens × price book runtime)
A = 4   (cost_ledger entry_type=commit)

delta(E,D) = 20
delta(R,A) = 20
```

```text
COST_RECONCILIATION = PASS
```

Reservation id : `fb9fef88-172d-4181-b4f9-7451529d190b` (status `committed`).

---

## Idempotence

Replay `POST …/marketing` `mode=execute` (même projet / brief revision 1) :

```text
status=existing
directorRunId=7353a60b-ed0d-4f4c-9400-48b0f1498d0b  (identique)
durationMs≈1876
marketing_runs count = 1
ledger commits = 1
```

→ **aucun second appel provider**.

---

## Flags Returned To Safe State

1. Écriture explicite des 10 kill switches Production → `0` (`SUCCESS_OPS=10`).
2. Redeploy sécurité → `virtual-humans-2519egyfp-…` alias Production.
3. Vérification authentifiée : `GET /api/director/projects` → **404** « Persistance Director désactivée. »

```text
CURRENT_RUNTIME_REAL_AI = OFF
```

---

## Evidence

- Dry-run estimate 24¢ + pricingConfigured.
- Execute HTTP 200 completed.
- DB : 1 run marketing, usage tokens, actual 4¢, ledger reserve/commit/release.
- Zod PASS sur artifact.
- Replay existing sans nouvel appel.
- Runtime OFF confirmé.

---

## Risks / Follow-ups

| ID | Sévérité | Note |
|---|---|---|
| R-10A-04 Backup restore | P1 | Toujours `BACKUP_PRESENT_RESTORE_UNPROVEN` — ne bloque pas ce smoke ; bloque ops distantes invasives |
| Collateral | info | Projet dry-only `60fc06cc-…` créé pendant préflight (brief seul, 0 appel provider) |
| Observabilité | P2 | Pas de dashboard VHS-005 ; fiche manuelle suffisante pour 1 appel |

**Aucun P0 ouvert par 10B.**

---

## Operations NOT performed

```text
media provider call = NO
worker execution = NO
media job = NO
remote migration apply = NO
Storage media write = NO
Creative real call = NO
Script real call = NO
Art real call = NO
Storyboard real call = NO
commit = NO
push = NO
```

---

## STOP

Phase 10B terminée. Attente autorisation humaine pour toute suite (Creative, média, etc.).
