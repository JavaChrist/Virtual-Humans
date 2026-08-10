# 39 — Phase 10F — First Real Storyboard Director Text Smoke

**Date :** 10 août 2026  
**Entrée :** `38_PHASE_10F_STORYBOARD_TEXT_SMOKE_PREP.md` (`READY_FOR_HUMAN_AUTH`, commit `58f7984`)  
**Directeur :** Storyboard texte uniquement  
**Provider :** OpenAI (non atteint)  
**Plafond smoke :** USD 1.00 (100¢) · **Appels provider max :** 1 · **Appels effectués :** **0**

---

## Executive Summary

### Verdict

```text
BLOCKED
```

| Critère | Résultat |
|---|---|
| Préconditions + dry-run local | **PASS** |
| Dry-run live = PREP (`gpt-5.6` / `medium` / `4096` / 13¢ / v2) | **PASS** |
| Exactement 1 appel provider Storyboard réel | **NON** — réservation budget refusée **avant** provider |
| `storyboard_project` actif | **absent** |
| Artifacts amont inchangés | **PASS** |
| 0 retry / 0 fallback / 0 média / 0 worker | **PASS** |
| Flags remis OFF + redeploy | **PASS** (`CURRENT_RUNTIME_REAL_AI=OFF`) |
| Replay idempotent | **N/A** (pas de succès) |

Cause : `workspace_budget_policies.hard_limit_minor=100`, commits cumulés **93¢**, reste **7¢** ; réservation Storyboard **13¢** → HTTP 402 `budget_exceeded`. Aucun appel OpenAI. Aucun ledger 10F. Fermeture runtime prouvée.

**Note réauth :** run failed `b446a0ed-…` avec clé d’idempotence v2 termine en `director_run_terminal_reuse` si rejoué à l’identique — une réauth exigera hausse de plafond workspace **et** stratégie d’identité (nouvelle clé / procédure dédiée), **sans** second appel provider non autorisé.

---

## Autorisation

```text
PHASE_10F_SMOKE_CONFIRM=ONE_STORYBOARD_CALL_MAX_100_CENTS
PHASE_10F_ALLOW_EXECUTE=1
PHASE_10F_DRY_ONLY=0
CONFIRM_PHASE_10F_VERCEL_FLAGS=1
```

```text
J’autorise la Phase 10F : un seul appel Storyboard texte, modèle gpt-5.6,
estimate/réservation 13¢ sous réserve de confirmation identique au dry-run live,
plafond absolu 100¢, écritures Production bornées,
Marketing/Creative/Script/Art AI maintenus OFF,
PAID_GENERATION et worker maintenus OFF,
et fermeture immédiate des flags.
```

---

## Préconditions

| Check | Résultat |
|---|---|
| Working tree propre @ `58f7984` | PASS |
| Runtime AI OFF | PASS |
| Marketing / Creative / Script / VisualDirection rev.1 actifs | PASS |
| Segments 5/5 | PASS |
| `storyboard_project` actif absent | PASS |
| Dry-run local sans provider | PASS (13¢) |
| Hashes amont | Marketing `fa0097b80e1b662d` · Creative `c7cb65fda9f51182` · Script `6650d46ad6fee581` · Visual `0763ee2771c408c3` |

---

## Matrice / knobs

Avant ouverture : knobs `OPENAI_STORYBOARD_*` **absents** → ajoutés Production pour aligner le contrat autorisé (`gpt-5.6` / `medium` / `4096` / `REQUIRE_PRICING=1`).

Matrice : Storyboard AI ON ; Marketing/Creative/Script/Art/PAID_GENERATION/Worker **0**.

---

## Dry-run Production (avant tentative)

| Champ | Valeur live |
|---|---|
| providerCalled | false |
| executable / executionAvailable | true |
| provider | openai |
| model | `gpt-5.6` |
| reasoningEffort | `medium` |
| maxOutputTokens | 4096 |
| promptVersion | `storyboard-analyzer-v2` |
| schemaVersion | `1.0.0` |
| idempotencyKeyVersion | `storyboard-analyzer-v2:1.0.0` |
| estimatedCostMinor | **13** |
| existingStoryboard | absent |

Evidence dry : `studio/.tmp/phase-10f-smoke-dry-1786371684618.json`

---

## Tentative d’exécution

| Champ | Valeur |
|---|---|
| path | `POST /storyboard` |
| correlationId | `corr-10f-1786371692999-exec` |
| HTTP | **402** |
| status / code | `failed` / `budget_exceeded` |
| runId | `b446a0ed-0005-40ed-b134-b7ab769bd819` |
| attempt | 1 |
| prompt / schema | `storyboard-analyzer-v2` / `1.0.0` |
| model | `gpt-5.6` |
| estimated | 13¢ |
| actual / ledger 10F | **null** / **0 entrées** |
| provider calls | **0** |
| storyboard_project | **aucun** |

Evidence exec : `studio/.tmp/phase-10f-smoke-exec.json`

### Budget workspace

| Champ | Valeur |
|---|---|
| hard_limit_minor | 100 |
| committed (ledger) | 93 |
| open reservations | 0 |
| remaining | **7** |
| required reserve | **13** |

---

## Validations métier / Zod

Non exécutées (échec avant provider / candidat).

---

## Artifacts amont (après)

| Artifact | id | rev |
|---|---|---:|
| MarketingPlan | `199284d6-7126-4383-b85f-1ecd74d9528e` | 1 |
| CreativeConcept | `11f8f8e0-a280-43aa-a7ea-5e6b0401b72a` | 1 |
| VideoScript | `349e2792-3235-4c00-a1da-9e087b0b4d1c` | 1 |
| VisualDirection | `49481462-6444-41f9-8c48-7e7d32c09f1b` | 1 |
| StoryboardProject | — | **absent** |

Aucun upstream replay. Aucun média / job / worker.

---

## Flags / redeploys

- Redeploy ON : `virtual-humans-a45edtwlc-…` (`dpl_3WfYg6DJ9PftW9pAaQu5Rnxm536E`) → alias Production  
- Redeploy OFF : `virtual-humans-45tyuovgx-…` (`dpl_AC7roTETWURUuyBf1atDq9YYbeEa`) → alias Production  
- Verify : `CURRENT_RUNTIME_REAL_AI=OFF` (HTTP 404 persistance)

---

## Suite recommandée (hors scope)

Voir audit non payant : `40_PHASE_10F_WORKSPACE_BUDGET_AUDIT.md` (`READY_FOR_BUDGET_AUTH`).

1. **Auth A** : relever `hard_limit_minor` 100 → **113** (+13) — script préparé, non exécuté.
2. **Auth B** : dry-run live + salt d’idempotence (contrat v2 inchangé) + **un** appel Storyboard.
3. Ne pas réutiliser la clé du run `b446a0ed` (`director_run_terminal_reuse`).

---

## Push

**Aucun push.**
