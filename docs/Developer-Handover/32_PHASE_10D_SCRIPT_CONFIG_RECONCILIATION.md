# 32 — Phase 10D-RECONCILE — Script Model & Estimate Alignment

**Date :** 10 août 2026  
**Entrée :** `31_PHASE_10D_FIRST_REAL_SCRIPT_SMOKE.md` (`BLOCKED`, commit `5787c9c`)  
**Provider calls :** **0**  
**Écritures Vercel :** **0**

---

## Verdict

```text
READY_FOR_REAUTH
```

Aucune modification Vercel requise. La config Production Script est déjà intentionnelle ; le PREP local était faux.

---

## Cause racine

| Couche | Comportement |
|---|---|
| Variables | `OPENAI_SCRIPT_MODEL`, `OPENAI_SCRIPT_REASONING_EFFORT`, `OPENAI_SCRIPT_MAX_OUTPUT_TOKENS` |
| Vercel Production | Présentes (Encrypted) — pull CLI redacte les valeurs |
| Code defaults | `gpt-5.6-terra` / `low` / `2400` |
| PREP 10D (bug) | Fallback sur **code defaults** (pas de `PRODUCTION_DOCUMENTED_*` comme 10C) → estimate **7¢** |
| Runtime Production (observé 10D) | `model=gpt-5.6`, estimate **12¢** |

Calcul (price book `manual-2026-08-porte7-sol`, 500 / 3000 minor / 1M) :

```text
approxInputTokens ≈ 1488 → floor(1488×500/1e6) = 0
maxOut 2400 → floor(2400×3000/1e6) = 7   ← PREP erroné
maxOut 4096 → floor(4096×3000/1e6) = 12  ← Production live
```

Le modèle `gpt-5.6` n’influence pas le montant (même price book) ; l’écart 7→12 vient du **plafond de sortie**.

---

## Configuration canonique 10D

| Knob | Variable | Canon |
|---|---|---|
| Modèle | `OPENAI_SCRIPT_MODEL` | `gpt-5.6` |
| Reasoning | `OPENAI_SCRIPT_REASONING_EFFORT` | `medium` |
| Max output | `OPENAI_SCRIPT_MAX_OUTPUT_TOKENS` | `4096` |
| Price book | `OPENAI_MARKETING_PRICE_*` (partagé) | 500 / 3000, version `manual-2026-08-porte7-sol` |
| Estimate / réservation | — | **12¢** |
| Plafond auth | — | **100¢** |

Justification : cohérent avec Marketing/Creative Production (10B/10C), adapter Script compatible, estimate live déjà observée, coût borné, pas de migration.

Notes :

- `reasoningEffort=medium` : aligné Porte 8E / Creative ; non exposé dans le dry-run Script avant cette réconciliation — à confirmer au prochain dry-run Production (champ désormais renvoyé).
- Défauts code `gpt-5.6-terra` / `low` / `2400` **conservés** pour le local hors Production ; seuls PREP/guards 10D utilisent le canon documenté.

---

## Corrections locales

- `phase-10d-prep-script-dry-run.mjs` : fallback `PRODUCTION_DOCUMENTED_SCRIPT` (comme 10C Creative).
- Dry-run Script : expose `reasoningEffort` + `maxOutputTokens` (AI + API projet).
- Tests `phase-10d-prep-guards` : matrice Production-aligned + preuve 12¢ vs 7¢.
- Smoke Vercel : capture knobs dans l’evidence.

**Aucune écriture Vercel. Aucun redeploy.**

---

## Preuves non payantes

| Check | Résultat |
|---|---|
| Tests unitaires | **1029/1029** |
| Typecheck | PASS |
| Lint | 0 erreur (warnings préexistants) |
| Build | PASS |
| Dry-run PREP (artifacts Production) | `gpt-5.6` / `medium` / `4096` / estimate **12¢** / `providerCalled=false` |
| Dry-run Production live (fenêtre) | non rouverte (runtime OFF) ; aligné via observation 10D + PREP corrigé |
| Runtime final | `CURRENT_RUNTIME_REAL_AI=OFF` |
| Artifacts / ledger Script | inchangés / absents |

---

## Nouvelle autorisation humaine (execute 10D)

```text
J’autorise la Phase 10D (réauth) : un seul appel Script, modèle gpt-5.6,
estimate/réservation 12¢, plafond absolu 100¢, écritures Production bornées
et fermeture immédiate des flags.
```

Confirmations :

```text
PHASE_10D_SMOKE_CONFIRM=ONE_SCRIPT_CALL_MAX_100_CENTS
PHASE_10D_ALLOW_EXECUTE=1
PHASE_10D_DRY_ONLY=0
CONFIRM_PHASE_10D_VERCEL_FLAGS=1
```

Avant l’appel : dry-run Production doit montrer `model=gpt-5.6`, `maxOutputTokens=4096`, `estimatedCostMinor=12`. Divergence → BLOCKED.
