# 46 — Phase 10F-RETRY2-DEPLOY-PREFLIGHT

**Date :** 10 août 2026  
**Entrée :** `45_PHASE_10F_STORYBOARD_RETRY2_PREP.md` + push contrôlé `a849e03`  
**Provider calls :** **0**  
**Execute / réservation / ledger / artifact :** **0**

---

## Verdict

```text
READY_FOR_PROVIDER_REAUTH
```

Correctif structured output déployé ; salt RETRY2 posé ; dry-run live gates verts ; runtime refermé OFF.

---

## Préconditions

| Check | Résultat |
|---|---|
| `main` = `origin/main` = `a849e03`, tree clean | PASS |
| Runtime OFF avant ouverture | PASS |
| hard=113 / committed=93 / reserved=0 / available=20 | PASS |
| Runs `b446a0ed` / `f5b75018` immuables | PASS |
| `storyboard_project` actif | **absent** |

---

## Salt

```text
DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT = 10f-auth-b-retry2-20260810
```

| Champ | Valeur |
|---|---|
| present (dry-run) | **true** |
| salt fingerprint (sha256[:16]) | `950090f284c9907f` |
| newKeyFingerprint | `0b7e8fb44e0acd4d` |
| distinct vs none / Auth B | `abaa…` / `3f39…` |

Valeur salt redacted hors preuve locale ; aucun autre knob Storyboard modifié.

---

## Déploiements

| Étape | URL courte | Notes |
|---|---|---|
| Push source `a849e03` | `gvv7acvzm` | build git-main |
| Redeploy ON (salt + flags) | **`brclc3a6c`** | alias Production pendant dry-run |
| Redeploy OFF | **`oa57qfz26`** | alias Production final |
| Root Directory | **studio** | confirmé |
| Stale interdit | `ra6ulinwn` / `45tyuovgx` | **non utilisés** |

Preuve code post-fix live : dry-run expose `structuredSchemaOneOfCount=0`, `structuredSchemaProjection=anyOf-compatible`, `providerErrorMetadataCapture=ready` (champs introduits en `a849e03`).

---

## Matrice temporaire

| Flag | Pendant dry-run | Après fermeture |
|---|---|---|
| Marketing / Creative / Script / Art AI | 0 | 0 |
| Storyboard AI + Director + Persistence + Paid AI | 1 | 0 |
| PAID_GENERATION / Worker | 0 | 0 |

---

## Dry-run live

| Champ | Observé |
|---|---|
| correlationId | `corr-10f-retry2-1786379954188-dry` |
| HTTP | 200 |
| providerCalled | **false** |
| executable / executionAvailable | **true** |
| prompt / schemas | `storyboard-analyzer-v2` / `1.0.0` |
| provider / model / reasoning / maxTokens | openai / `gpt-5.6` / medium / 4096 |
| estimate / réservation prévue | **13¢** / **13¢** |
| pricingConfigured | true |
| oneOf / anyOf / metadata | 0 / anyOf-compatible / ready |
| salt present | true |
| existingStoryboard | false |

Script : `studio/scripts/phase-10f-retry2-deploy-dry-proof.mjs`  
Evidence : `studio/.tmp/phase-10f-retry2-deploy-dry.json`

### DB post dry-run

| Check | Résultat |
|---|---|
| Nouveaux director_runs (corr / 30 min) | **0** |
| Nouveaux ledger (30 min) | **0** |
| storyboard actif | **0** |
| Budget | 113 / 93 / 0 / 20 **inchangé** |
| Runs prior | inchangés |

---

## Fermeture

| Check | Résultat |
|---|---|
| Flags OFF script | SUCCESS_OPS=10 |
| Redeploy OFF | `oa57qfz26` |
| `CURRENT_RUNTIME_REAL_AI` | **OFF** |
| Storyboard execution | unavailable (404 persistence) |
| Salt | peut rester présent (OK) |

---

## Suite autorisée

Execute RETRY2 : **faite** → `47_PHASE_10F_STORYBOARD_RETRY2_EXECUTE.md` (**BLOCKED** `invalid_candidate`).  
Autorisation provider **consommée**. Suite = DIAG continuité + nouveau salt + éventuelle Auth budget.
