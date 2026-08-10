# 47 — Phase 10F-RETRY2-EXECUTE — Storyboard texte

**Date :** 10 août 2026  
**Entrée :** `46_PHASE_10F_RETRY2_DEPLOY_PREFLIGHT.md` (`READY_FOR_PROVIDER_REAUTH`)  
**Source runtime :** `a849e03` (ON `dtn8ucylp` → OFF `gb5fi4973`)  
**Appels Storyboard :** **1** (autorisation consommée)  
**Relance :** **aucune**

---

## Verdict

```text
BLOCKED
```

Cause : candidat provider rejeté métier — `invalid_candidate` / continuité  
`Clé de continuité manquante: location:espace-numerique-principal`.  
**0** `storyboard_project` ; ledger réconcilié (13 reserve / 8 commit / 5 release) ; runtime OFF.

| Critère | Résultat |
|---|---|
| Préconditions + dry-run gates | **PASS** |
| 1 appel max, 0 relance | **PASS** |
| Schema projection post-fix | **PASS** (appel provider abouti) |
| Storyboard persisté | **NON** |
| Runtime OFF après fermeture | **PASS** |

---

## Autorisation

Confirmations utilisées :

```text
PHASE_10F_SMOKE_CONFIRM=ONE_STORYBOARD_CALL_MAX_100_CENTS
PHASE_10F_ALLOW_EXECUTE=1
PHASE_10F_DRY_ONLY=0
DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT=10f-auth-b-retry2-20260810
```

Salt / empreinte clé : `10f-auth-b-retry2-20260810` / `0b7e8fb44e0acd4d`  
**Autorisation provider consommée.** Salt lié au run terminal `4914c203`.

---

## Préconditions / dry-run final

| Check | Résultat |
|---|---|
| Runtime OFF avant | PASS |
| Budget avant | 113 / 93 / 0 / **20** |
| Amont Marketing/Creative/Script/Visual rev.1 · 5 segments | PASS |
| Storyboard absent | PASS |
| Runs `b446a0ed` / `f5b75018` immuables | PASS |
| Dry-run `corr-10f-retry2-1786387564863-dry` | PASS |
| oneOf=0 / anyOf-compatible / metadata ready | PASS |
| gpt-5.6 / medium / 4096 / estimate 13 | PASS |

---

## Matrice / redeploys

| Étape | Déploiement |
|---|---|
| Redeploy ON | `dtn8ucylp` (depuis `oa57qfz26`) |
| Redeploy OFF | **`gb5fi4973`** |
| Root Directory | studio |
| Stale | non utilisés |

Matrice : Storyboard ON temporaire ; Marketing/Creative/Script/Art/PAID_GENERATION/Worker **0**.

---

## Execute unique

| Champ | Valeur |
|---|---|
| correlationId | `corr-10f-1786387588078-exec` |
| HTTP | **422** |
| status / code | `failed` / `invalid_candidate` |
| message | Clé de continuité manquante: `location:espace-numerique-principal` |
| runId | `4914c203-3be0-4f62-8529-a9b3db25448e` |
| attempt / retry_of | **1** / **null** |
| prompt / schema | `storyboard-analyzer-v2` / `1.0.0` |
| model | `gpt-5.6` |
| estimated / actual | 13¢ / **8¢** |
| cost_status | committed |
| idempotency key fp | `0b7e8fb44e0acd4d` |
| storyboard_project | **absent** |
| wall | ~55 s (`created_at` → `completed_at`) |

### Usage (redacted)

| Champ | Valeur |
|---|---:|
| inputTokens | 3229 |
| outputTokens | 2381 |
| reasoningTokens | 1372 |
| totalTokens | 5610 |
| cachedInputTokens | 0 |

### Métadonnées provider

Appel provider **réussi** (usage présent) ; échec = validation métier post-parse (`candidate` / continuité).  
Pas de second appel. Route HTTP 422 `invalid_candidate` (non `request_failed`).

### Ledger

| entry_type | amount |
|---|---:|
| reservation | 13 |
| commit | **8** |
| release | **5** |

Réservation `70c1ef55-…` status **committed**. Exposure commits workspace **93 → 101** (+8).

### Budget après

```text
hard = 113¢
committed = 101¢
reserved = 0
available = 12¢
```

---

## Validation métier

| Check | Résultat |
|---|---|
| Zod candidat | rejeté métier (continuité) avant persist |
| Coverage 5 segments | N/A (échec) |
| Continuité | **FAIL** — clé `location:espace-numerique-principal` manquante |
| Spoken / timing / refs | N/A |
| Provenance | N/A |
| Idempotence replay | **non exécuté** (échec) |

---

## Runs immuables

| Run | Statut |
|---|---|
| `b446a0ed-…` | failed / budget_exceeded — inchangé |
| `f5b75018-…` | failed / request_failed — inchangé |
| `4914c203-…` | failed / invalid_candidate — **nouveau, terminal** |

Artifacts amont inchangés (rev.1). **0** média / worker / job.

---

## Fermeture

| Check | Résultat |
|---|---|
| Flags OFF | SUCCESS_OPS=10 |
| Redeploy OFF | `gb5fi4973` |
| `CURRENT_RUNTIME_REAL_AI` | **OFF** |
| Storyboard execution | unavailable |

---

## Suite

Diagnostic : `48_PHASE_10F_STORYBOARD_CONTINUITY_DIAG.md` — cause = prompt v2 insuffisant ; fix local **`storyboard-analyzer-v3`** + map `REQUIRED_LOCATION_CONTINUITY_KEYS_…` ; validateur inchangé.

Avant nouvelle autorisation :

1. RETRY-PREP (nouveau salt, clé ≠ 3 failed, prompt v3) ;
2. budget disponible **12¢** — Auth A si estimate ≥ 13 ;
3. **nouvelle** autorisation provider (1 appel max).

Suite : DIAG `48_…` → PREP v3 `49_…` (`READY_FOR_BUDGET_AND_PUSH_AUTH` ; salt `10f-storyboard-v3-20260810`).

**Aucune relance** dans cette phase.
