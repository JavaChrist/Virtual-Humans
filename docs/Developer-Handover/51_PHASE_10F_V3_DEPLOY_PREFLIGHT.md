# 51 — Phase 10F-V3-DEPLOY-PREFLIGHT

**Date :** 10 août 2026  
**Entrée :** `50_PHASE_10F_V3_BUDGET_AND_PUSH.md` + runtime source `a82b9cf`  
**Provider calls :** **0**  
**Execute / réservation / ledger / artifact :** **0**

---

## Verdict

```text
READY_FOR_PROVIDER_REAUTH
```

Salt v3 posé ; code `a82b9cf` déployé ; dry-run live gates v3 verts ; runtime refermé OFF.

---

## Commit docs Budget/Push (local, non poussé)

| Champ | Valeur |
|---|---|
| Commit | `b283383` — `docs(studio): record phase 10F v3 budget and push` |
| Fichiers | `50_…`, BACKLOG, CHANGELOG, CHECKLIST |
| Source runtime | **`a82b9cf` uniquement** (docs local non déployé) |

---

## Préconditions

| Check | Résultat |
|---|---|
| `origin/main` = `a82b9cf` | PASS |
| hard=115 / committed=101 / reserved=0 / available=14 | PASS |
| Runtime OFF avant fenêtre | PASS |
| Storyboard actif | **absent** |
| Runs failed immuables | `b446a0ed` / `f5b75018` / `4914c203` |

---

## Salt

```text
DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT = 10f-storyboard-v3-20260810
```

| Champ | Valeur |
|---|---|
| present (dry-run) | **true** |
| salt fingerprint (sha256[:16]) | `9c9caf71f362b178` |
| distinct vs Retry2 salt fp | `950090f284c9907f` — **oui** |
| newKeyFingerprint | `1bf9daeb68eb6432` |
| distinct vs 3 failed | `abaa…` / `3f39…` / `0b7e…` |

Valeur salt non affichée hors preuve fingerprint.

---

## Déploiements

| Étape | URL courte | Notes |
|---|---|---|
| Source git-main `a82b9cf` | `rmssnc3pk` | build post-push |
| Redeploy ON (salt + flags) | **`ag1l12sst`** | alias Production pendant dry-run |
| Redeploy OFF | **`iqw0b8di0`** | alias Production final |
| Root Directory | **studio** | confirmé (Next.js / entrypoint `.`) |
| Stale interdit | `ra6ulinwn` / `45tyuovgx` | **non utilisés** |

Preuve code v3 live : dry-run expose `promptVersion=storyboard-analyzer-v3`, `requiredLocationKeyCount=5`, `requiredLocationKeyCoverage=complete`, `structuredSchemaOneOfCount=0`, `structuredSchemaProjection=anyOf-compatible`, `providerErrorMetadataCapture=ready`.

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
| correlationId | `corr-10f-v3-1786397956540-dry` |
| HTTP | 200 |
| providerCalled | **false** |
| executable / executionAvailable | **true** |
| prompt / schemas | `storyboard-analyzer-v3` / `1.0.0` |
| idempotencyKeyVersion | `storyboard-analyzer-v3:1.0.0` |
| provider / model / reasoning / maxTokens | openai / `gpt-5.6` / medium / 4096 |
| estimate / réservation prévue | **13¢** / **13¢** |
| budget | hard **115** / committed **101** / reserved **0** / available **14** |
| requiredLocationKeyCount / coverage | **5** / **complete** |
| required key (Production VD) | `location:espace-numerique-principal` |
| oneOf / anyOf / metadata | 0 / anyOf-compatible / ready |
| salt present | true |
| newKeyFingerprint | `1bf9daeb68eb6432` |
| existingStoryboard | false |

Script : `studio/scripts/phase-10f-v3-deploy-dry-proof.mjs`  
Evidence : `studio/.tmp/phase-10f-v3-deploy-dry.json`

### DB post dry-run

| Check | Résultat |
|---|---|
| Nouveaux director_runs (corr / 30 min) | **0** |
| Nouveaux ledger (30 min) | **0** |
| storyboard actif | **0** |
| Budget | 115 / 101 / 0 / 14 **inchangé** |
| Runs prior | inchangés |

---

## Fermeture

| Check | Résultat |
|---|---|
| Flags OFF script | SUCCESS_OPS=10 |
| Redeploy OFF | `iqw0b8di0` |
| `CURRENT_RUNTIME_REAL_AI` | **OFF** |
| Storyboard execution | unavailable (404 persistence) |
| Salt | peut rester présent (OK) |

---

## Suite

Autorisation provider Storyboard v3 encore requise :

- 1 appel max ;
- salt `10f-storyboard-v3-20260810` ;
- attempt 1 / retry_of null ;
- estimate/réservation 13¢ ;
- fermeture OFF systématique.

**Aucun execute dans cette phase.**
