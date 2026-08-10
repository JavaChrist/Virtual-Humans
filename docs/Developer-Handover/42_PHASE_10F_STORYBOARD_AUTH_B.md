# 42 — Phase 10F-AUTH-B — Storyboard Text Execute after Budget Auth A

**Date :** 10 août 2026  
**Entrée :** Auth A PASS (`41_…`, commit `28be6b6`) · budget ready (hard 113 / available 20)  
**Directeur :** Storyboard texte uniquement  
**Provider :** OpenAI (non atteint)  
**Plafond smoke :** USD 1.00 (100¢) · **Appels provider max :** 1 · **Appels effectués :** **0**

---

## Verdict

```text
BLOCKED
```

| Critère | Résultat |
|---|---|
| Préconditions + budget-ready | **PASS** |
| Dry-run live = contrat (13¢ / gpt-5.6 / medium / 4096 / v2) | **PASS** |
| Exactement 1 appel provider Storyboard | **NON** — HTTP 500 avant begin durable |
| Nouvelle clé salée ≠ run `budget_exceeded` | **prouvée localement** ; **non appliquée runtime** (deploy stale) |
| `storyboard_project` | **absent** |
| Ledger / réservation Auth B | **0** |
| Run `b446a0ed` immuable | **PASS** |
| Flags OFF + runtime OFF | **PASS** |
| Idempotence | **N/A** (pas de succès) |

### Cause racine

Le redeploy d’ouverture a réutilisé le déploiement Production **stale** `45tyuovgx` (fermeture 10F initiale, **sans** code `DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT`), au lieu du build push `ln0zu25ql` (`28be6b6` + salt).

Conséquence : le runtime execute a recalculé la **même** clé que `b446a0ed` → RPC `director_run_terminal_reuse` → exception non mappée → HTTP **500** `internal_error` · `directorRunId=null`.

Le salt Production `10f-auth-b-20260810` était bien posé en env, mais le binaire déployé ne l’utilisait pas.

---

## Autorisation humaine

```text
J’autorise la Phase 10F-AUTH-B : un seul nouvel appel Storyboard texte,
modèle gpt-5.6, estimate/réservation 13¢ sous réserve de confirmation identique
au dry-run live, plafond absolu 100¢, nouvelle clé d’idempotence distincte du
run budget_exceeded, écritures Production bornées, Directors amont,
PAID_GENERATION et worker maintenus OFF, et fermeture immédiate des flags.
```

Variables :

```text
PHASE_10F_SMOKE_CONFIRM=ONE_STORYBOARD_CALL_MAX_100_CENTS
PHASE_10F_ALLOW_EXECUTE=1
PHASE_10F_DRY_ONLY=0
PHASE_10F_BUDGET_AUTH_DONE=1
DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT=10f-auth-b-20260810
CONFIRM_PHASE_10F_VERCEL_FLAGS=1
```

---

## Préconditions

| Check | Résultat |
|---|---|
| `main` = `origin/main` = `28be6b6`, tree clean | PASS |
| Runtime OFF avant ouverture | PASS |
| hard=113 / committed=93 / reserved=0 / available=20 | PASS |
| `verify-budget-ready` | PASS (`readyForStoryboardAuthB=true`) |
| Amont Marketing/Creative/Script/Visual rev.1 · 5/5 segments | PASS |
| `storyboard_project` absent | PASS |
| Run `b446a0ed` `failed`/`budget_exceeded`/actual null | PASS |
| Clés distinctes (local) oldFp≠newFp, fingerprint commande inchangé | PASS |
| Match clé DB old = local unsalted | PASS (`1f592d40…`) |

Salt Auth B (non secret) : `10f-auth-b-20260810`  
Empreintes clés (sha256 prefix) : old `abaa9c2886ef3d59` · new `3f39f808e266649c` · fingerprint commande `1605c803daec9c2c`

---

## Matrice / redeploys

| Étape | Déploiement |
|---|---|
| Ouverture (stale, erreur) | `virtual-humans-ra6ulinwn-…` (redeploy de `45tyuovgx`) |
| Fermeture flags OFF | script `phase-10f-set-storyboard-flags.mjs off` · SUCCESS_OPS=10 |
| Redeploy OFF | `virtual-humans-mh5n3ihij-…` |
| Promote HEAD code OFF (salt-ready, flags 0) | `virtual-humans-d2mth5hp7-…` (alias Production) |
| Build push salt-ready | `virtual-humans-ln0zu25ql-…` (source du promote) |

Matrice demandée : Storyboard ON temporairement ; Marketing/Creative/Script/Art/PAID_GENERATION/Worker **0**.

---

## Dry-run live (conforme)

| Champ | Valeur |
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
| estimatedCostMinor / réservation | **13** / **13** |
| available | **20** ≥ 13 |

Evidence dry : `studio/.tmp/phase-10f-smoke-dry-1786374019638.json`

---

## Tentative d’exécution (unique — non relancée)

| Champ | Valeur |
|---|---|
| correlationId | `corr-10f-1786374046558-exec` |
| HTTP | **500** |
| status / code | `failed` / `internal_error` |
| message | Échec du storyboard. |
| directorRunId | **null** |
| runs DB pour ce corr | **0** |
| ledger / réservations | **0** |
| provider calls | **0** |
| storyboard_project | **aucun** |

Evidence exec : `studio/.tmp/phase-10f-smoke-exec.json`

Diagnostic : `director_run_terminal_reuse` probable (clé non salée sur binaire stale) ; Storyboard ne mappe pas encore ce diagnostic vers une erreur métier (contrairement à Marketing) → 500 catch route.

---

## Validations métier / Zod / idempotence

Non exécutées (échec avant provider / candidat). **Aucune** relance.

---

## Budget après

| Champ | Valeur |
|---|---:|
| hard_limit_minor | 113 |
| committed | 93 |
| active reservations | 0 |
| available | 20 |

Inchangé vs Auth A.

---

## Artifacts amont (inchangés)

| Artifact | id | rev | hash prefix |
|---|---|---:|---|
| MarketingPlan | `199284d6-…` | 1 | `fa0097b80e1b662d` |
| CreativeConcept | `11f8f8e0-…` | 1 | `c7cb65fda9f51182` |
| VideoScript | `349e2792-…` | 1 | `6650d46ad6fee581` |
| VisualDirection | `49481462-…` | 1 | `0763ee2771c408c3` |
| StoryboardProject | — | — | absent |

---

## Fermeture

| Check | Résultat |
|---|---|
| Flags Director AI | OFF / empty |
| PAID_GENERATION | 0 |
| Worker | 0 |
| `CURRENT_RUNTIME_REAL_AI` | **OFF** (HTTP 404 persistance) |
| Storyboard unavailable | **PASS** |

---

## Suite (hors scope — autorisation séparée)

1. Ouvrir Auth B **uniquement** depuis un déploiement **HEAD/salt-ready** (ex. lignée `ln0zu25ql` / `d2mth5hp7`), jamais depuis un redeploy d’un vieux OFF pre-salt.  
2. Avant execute : dry-run live doit exposer `idempotencySaltPresent=true`.  
3. Conserver le salt `10f-auth-b-20260810` (déjà en Production) pour stabilité execute↔replay.  
4. Optionnel P1 : mapper `director_run_terminal_reuse` côté Storyboard (comme Marketing) pour éviter un 500 opaque.
