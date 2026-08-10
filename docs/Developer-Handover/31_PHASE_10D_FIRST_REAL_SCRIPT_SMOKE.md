# 31 — Phase 10D — First Real Script Provider Smoke Test

**Date :** 10 août 2026  
**Entrée :** `30_PHASE_10D_SCRIPT_SMOKE_PREP.md` (`READY_FOR_HUMAN_AUTH`, commit `ff18439`)  
**Directeur :** Script uniquement  
**Provider prévu :** OpenAI  
**Plafond autorisé :** USD 1.00 (100¢) · **Appels max :** 1

---

## Executive Summary

### Verdict

```text
BLOCKED
```

Aucun appel Script provider. Aucun artifact VideoScript créé. Runtime AI refermé et prouvé OFF.

| Critère | Résultat |
|---|---|
| Préconditions locales (amont / pas de VideoScript / dry-run local 7¢) | **PASS** |
| Ouverture flags + redeploy ON | **FAIT** (temporaire) |
| Matrice runtime après redeploy (Script ON, Marketing/Creative OFF) | **PASS** comportemental |
| Estimate Production == estimate PREP (7¢) | **FAIL** → **12¢** live |
| Modèle Production == PREP (`gpt-5.6-terra`) | **FAIL** → `gpt-5.6` live |
| Appel provider Script | **NON EXÉCUTÉ** (blocage pré-appel) |
| Fermeture flags + redeploy OFF | **PASS** |
| `CURRENT_RUNTIME_REAL_AI=OFF` | **PASS** (HTTP 404 persistance) |
| 0 média / 0 worker | **PASS** (aucun job lancé) |

---

## Autorisation

```text
PHASE_10D_SMOKE_CONFIRM=ONE_SCRIPT_CALL_MAX_100_CENTS
PHASE_10D_ALLOW_EXECUTE=1
PHASE_10D_DRY_ONLY=0
CONFIRM_PHASE_10D_VERCEL_FLAGS=1
```

Autorisation humaine : un seul appel Script, plafond absolu 100¢, écritures Production bornées, fermeture immédiate des flags.

---

## Cause du blocage

Après redeploy ON, dry-run Production Script :

| Champ | Attendu (entrée 10D / PREP) | Observé (Production live) |
|---|---|---|
| providerCalled | false | false |
| executable | true | true |
| executionAvailable | true | true |
| estimatedCostMinor | **7** | **12** |
| model | `gpt-5.6-terra` | `gpt-5.6` |
| estimate ≤ 100¢ | oui | oui |

Divergence estimate/modèle vs état d’entrée → **BLOCKED** sans appel provider, conformément §3 (« Toute divergence doit produire BLOCKED »).

Marketing / Creative dry-run après redeploy ON : `executionAvailable=false` (matrice Script-only respectée).

---

## Artifacts amont (inchangés)

| Artifact | id | rev | actif |
|---|---|---:|---|
| MarketingPlan | `199284d6-7126-4383-b85f-1ecd74d9528e` | 1 | oui |
| CreativeConcept | `11f8f8e0-a280-43aa-a7ea-5e6b0401b72a` | 1 | oui |
| VideoScript | — | — | **absent** (aucun execute) |

Projet : `984507af-a89e-4644-8ea3-344797baa974`

---

## Flags (fenêtre temporaire)

| Flag | ON temporaire | OFF final |
|---|---|---|
| `DIRECTOR_V2_ENABLED` | 1 | 0 |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | 1 | 0 |
| `DIRECTOR_V2_PAID_AI_ENABLED` | 1 | 0 |
| `DIRECTOR_V2_SCRIPT_AI_ENABLED` | 1 | 0 |
| Marketing / Creative / Art / Storyboard / Worker / Paid generation | 0 | 0 |

Redeploys :

1. **ON** : `virtual-humans-6mynten76-…` (alias Production)
2. **OFF** : `virtual-humans-dussau505-…` (alias Production)

Fermeture :

```text
CONFIRM_PHASE_10D_VERCEL_FLAGS=1 node scripts/phase-10d-set-script-flags.mjs off
# redeploy Production
node scripts/phase-10d-verify-flags-off.mjs
→ CURRENT_RUNTIME_REAL_AI=OFF
```

---

## Exécution / ledger / idempotence

| Élément | Statut |
|---|---|
| Appels Script provider | **0** |
| Replay Marketing / Creative | **non** |
| Art / Storyboard / média / worker | **0** |
| Ledger Script | **aucune écriture** (pas d’execute) |
| Idempotence replay | **N/A** (pas de premier run) |

---

## P0 / P1

- **P0** : aucun (`RUNTIME_FLAGS_NOT_PROVEN_OFF` évité — OFF prouvé).
- **P1** conservé : `BACKUP_PRESENT_RESTORE_UNPROVEN`.
- **Écart PREP vs Production** : knobs modèle/prix Script Production (`gpt-5.6` / estimate 12¢) ≠ dry-run PREP local (`gpt-5.6-terra` / 7¢). À réconcilier avant nouvel execute autorisé.

---

## Suite

Réconciliation configuration : `32_PHASE_10D_SCRIPT_CONFIG_RECONCILIATION.md` (`READY_FOR_REAUTH`).

Canon Production confirmé : `gpt-5.6` / `medium` / `4096` / estimate **12¢** (le PREP 7¢/`gpt-5.6-terra` était un fallback code erroné).  
Nouvel execute Script uniquement après réautorisation humaine explicite. **Pas de Phase 10E.**
