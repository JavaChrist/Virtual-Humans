# 57 — Phase 10F-V4-EXECUTE — Storyboard texte v4

**Date :** 11 août 2026  
**Entrée :** `56_PHASE_10F_V4_DEPLOY_PREFLIGHT.md` (`READY_FOR_PROVIDER_REAUTH`)  
**Source runtime :** `90fb6fb` (ON `9ofvzb0hw` → OFF `3h1fdwxr8`)  
**Appels Storyboard :** **1** (autorisation consommée)  
**Relance :** **aucune**

---

## Verdict

```text
PASS
```

Un appel `gpt-5.6` / `storyboard-analyzer-v4` → `storyboard_project` rev.1 actif.  
Continuité mandatory **24/24** (opaque `lighting:studio|cool` exact). Ledger 13/5/8. Runtime OFF.

| Critère | Résultat |
|---|---|
| Préconditions + dry-run gates v4 | **PASS** |
| 1 appel max, 0 relance | **PASS** |
| Zod + continuité 24/9/5 | **PASS** |
| Storyboard persisté rev.1 | **PASS** |
| Idempotence `existing` | **PASS** |
| Runtime OFF après fermeture | **PASS** |

---

## Autorisation

Confirmations utilisées :

```text
PHASE_10F_SMOKE_CONFIRM=ONE_STORYBOARD_CALL_MAX_13_CENTS
PHASE_10F_ALLOW_EXECUTE=1
PHASE_10F_DRY_ONLY=0
PHASE_10F_BUDGET_AUTH_DONE=1
DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT=10f-storyboard-v4-20260811
```

Salt / empreinte clé : `10f-storyboard-v4-20260811` / `801c34a1080bbcf0`  
**Autorisation provider consommée.**

---

## Préconditions / dry-run final

| Check | Résultat |
|---|---|
| Runtime OFF avant | PASS |
| Source | `90fb6fb` |
| Budget avant | 122 / 107 / 0 / **15** |
| Amont Marketing/Creative/Script/Visual rev.1 | PASS (hashes inchangés) |
| Storyboard absent | PASS |
| Runs `b446a0ed` / `f5b75018` / `4914c203` / `60a1d9c6` immuables | PASS |
| Dry-run `corr-10f-v4-1786409282541-dry` | PASS |
| prompt v4 / 24/9/5 / fp `9d34b42ddc3bb85c` / oneOf=0 / anyOf / metadata | PASS |
| gpt-5.6 / medium / 4096 / estimate 13 | PASS |
| salt present / key `801c34a1080bbcf0` | PASS |

---

## Matrice / redeploys

| Étape | Déploiement |
|---|---|
| Redeploy ON | `9ofvzb0hw` (depuis `eeczhjco7`) |
| Redeploy OFF | **`3h1fdwxr8`** |
| Root Directory | studio |
| Stale | non utilisés |

Matrice : Storyboard ON temporaire ; Marketing/Creative/Script/Art/PAID_GENERATION/Worker **0**.

---

## Execute unique

| Champ | Valeur |
|---|---|
| correlationId | `corr-10f-1786409303610-exec` |
| HTTP | **200** |
| status | `completed` |
| runId | `8ca5dfce-1383-45c7-85f1-1ac6baa6dd45` |
| attempt / retry_of | **1** / **null** |
| prompt / schema | `storyboard-analyzer-v4` / `1.0.0` |
| model | `gpt-5.6` |
| estimated / actual | 13¢ / **5¢** |
| cost_status | committed |
| idempotency key fp | `801c34a1080bbcf0` |
| storyboard_project | `7cf183c1-…` rev.**1** |
| wall | ~22 s |

### Usage (redacted)

| Champ | Valeur |
|---|---:|
| inputTokens | 3778 |
| outputTokens | 1466 |
| reasoningTokens | 439 |
| totalTokens | 5244 |
| cachedInputTokens | 0 |

### Validations

| Étape | Résultat |
|---|---|
| Structured Output | **PASS** (completed) |
| Zod | **PASS** |
| Coverage | **PASS** (5 scènes / 5 segments) |
| Continuité | **PASS** 24/24 · 9/9 · 5/5 · opaque exact · 0 inventé · 0 mauvais segment |
| Références | **PASS** (serveur) |
| Spoken content | **PASS** (serveur) |
| Timing | **PASS** (`exact`) |

Scopes : `lighting`, `location`, `palette`, `product`, `screen_direction`.

### Ledger

| Type | Montant |
|---|---:|
| reservation | 13¢ |
| commit | 5¢ |
| release | 8¢ |

Budget après : hard **122** / committed **112** / reserved **0** / available **10**.

---

## Idempotence

| Check | Résultat |
|---|---|
| Replay status | `existing` |
| Même runId | `8ca5dfce-…` |
| Second appel provider | **0** |
| Coût supplémentaire | **0** |

---

## Fermeture

| Check | Résultat |
|---|---|
| Flags OFF | SUCCESS_OPS=10 |
| Redeploy OFF | `3h1fdwxr8` |
| `CURRENT_RUNTIME_REAL_AI` | **OFF** |
| Storyboard execution | unavailable (404 persistence) |
| PAID_GENERATION / Worker | 0 |
| Runs failed antérieurs | inchangés |
| Artifacts amont | inchangés |
| Média / jobs | **0** |

---

## Preuves

- Smoke : `studio/.tmp/phase-10f-smoke-exec.json`
- Capture : `studio/.tmp/phase-10f-v4-execute-capture.json`
- Script capture : `studio/scripts/phase-10f-v4-execute-capture.mjs`

**Corps Storyboard non affiché.**
