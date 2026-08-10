# 52 — Phase 10F-V3-EXECUTE — Storyboard texte v3

**Date :** 10 août 2026  
**Entrée :** `51_PHASE_10F_V3_DEPLOY_PREFLIGHT.md` (`READY_FOR_PROVIDER_REAUTH`)  
**Source runtime :** `a82b9cf` (ON `iy3uhvm31` → OFF `eq0cql3di`)  
**Appels Storyboard :** **1** (autorisation consommée)  
**Relance :** **aucune**

---

## Verdict

```text
BLOCKED
```

Cause : candidat provider rejeté métier — `invalid_candidate` / continuité  
`Clé de continuité manquante: lighting:studio|cool`.  
**0** `storyboard_project` ; ledger réconcilié (13 reserve / 6 commit / 7 release) ; runtime OFF.

| Critère | Résultat |
|---|---|
| Préconditions + dry-run gates v3 | **PASS** |
| 1 appel max, 0 relance | **PASS** |
| Prompt v3 / location map live | **PASS** (dry-run 5/complete) |
| Storyboard persisté | **NON** |
| Runtime OFF après fermeture | **PASS** |

---

## Autorisation

Confirmations utilisées :

```text
PHASE_10F_SMOKE_CONFIRM=ONE_STORYBOARD_CALL_MAX_13_CENTS
PHASE_10F_ALLOW_EXECUTE=1
PHASE_10F_DRY_ONLY=0
PHASE_10F_BUDGET_AUTH_DONE=1
DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT=10f-storyboard-v3-20260810
```

Salt / empreinte clé : `10f-storyboard-v3-20260810` / `1bf9daeb68eb6432`  
**Autorisation provider consommée.** Salt lié au run terminal `60a1d9c6`.

---

## Préconditions / dry-run final

| Check | Résultat |
|---|---|
| Runtime OFF avant | PASS |
| Source | `a82b9cf` |
| Budget avant | 115 / 101 / 0 / **14** |
| Amont Marketing/Creative/Script/Visual rev.1 · 5 segments | PASS |
| Storyboard absent | PASS |
| Runs `b446a0ed` / `f5b75018` / `4914c203` immuables | PASS |
| Dry-run `corr-10f-v3-1786399665844-dry` | PASS |
| prompt v3 / location 5/complete / oneOf=0 / anyOf / metadata | PASS |
| gpt-5.6 / medium / 4096 / estimate 13 | PASS |
| salt present / key `1bf9daeb68eb6432` | PASS |

---

## Matrice / redeploys

| Étape | Déploiement |
|---|---|
| Redeploy ON | `iy3uhvm31` (depuis `iqw0b8di0`) |
| Redeploy OFF | **`eq0cql3di`** |
| Root Directory | studio |
| Stale | non utilisés |

Matrice : Storyboard ON temporaire ; Marketing/Creative/Script/Art/PAID_GENERATION/Worker **0**.

---

## Execute unique

| Champ | Valeur |
|---|---|
| correlationId | `corr-10f-1786399688911-exec` |
| HTTP | **422** |
| status / code | `failed` / `invalid_candidate` |
| message | Clé de continuité manquante: `lighting:studio\|cool` |
| runId | `60a1d9c6-17a7-4c31-a838-495bf07b4289` |
| attempt / retry_of | **1** / **null** |
| prompt / schema | `storyboard-analyzer-v3` / `1.0.0` |
| model | `gpt-5.6` |
| estimated / actual | 13¢ / **6¢** |
| cost_status | committed |
| idempotency key fp | `1bf9daeb68eb6432` |
| storyboard_project | **absent** |
| wall | ~39 s |

### Usage (redacted)

| Champ | Valeur |
|---|---:|
| inputTokens | 3568 |
| outputTokens | 1908 |
| reasoningTokens | 842 |
| totalTokens | 5476 |

### Couches

| Couche | Résultat |
|---|---|
| Structured Output | **PASS** (usage tokens présents) |
| Zod structurel | **PASS** (sinon message Zod) |
| Continuité métier | **FAIL** (`lighting:studio\|cool`) |
| Coverage / spoken / timing / refs | non atteints (rejet continuité) |

---

## Ledger / budget

| Étape | Montant |
|---|---:|
| reserve | 13¢ |
| commit | 6¢ |
| release | 7¢ |

| Budget après | Valeur |
|---|---:|
| hard | 115 |
| committed | **107** |
| reserved | 0 |
| available | **8** |

---

## Idempotence

**Non exécutée** (échec terminal — pas de replay `existing`).

---

## Runs immuables

| Run | Statut |
|---|---|
| `b446a0ed-…` | failed / budget_exceeded — inchangé |
| `f5b75018-…` | failed / request_failed — inchangé |
| `4914c203-…` | failed / invalid_candidate — inchangé |
| `60a1d9c6-…` | failed / invalid_candidate — **nouveau, terminal** |

Artifacts amont inchangés (rev.1). **0** média / worker / job.

---

## Fermeture

| Check | Résultat |
|---|---|
| Flags OFF | SUCCESS_OPS=10 |
| Redeploy OFF | `eq0cql3di` |
| `CURRENT_RUNTIME_REAL_AI` | **OFF** |
| Storyboard execution | unavailable |

---

## Suite

Diagnostic continuité **éclairage** (`lighting:studio|cool`) — pattern voisin de DIAG location (`48_…`).  
Validateur fail-closed correct. **Aucune relance** sans nouvelle Auth (nouveau salt + éventuel prompt/mapping lighting).

**Aucune relance** dans cette phase.
