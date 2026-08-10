# 40 — Phase 10F-BUDGET-AUDIT — Workspace Budget & Storyboard Retry Path

**Date :** 10 août 2026  
**Entrée :** Phase 10F BLOCKED (`7a77e81`) · runtime OFF  
**Provider calls :** **0**  
**Budget / ledger writes :** **0** (audit uniquement)

---

## Verdict

```text
READY_FOR_BUDGET_AUTH
```

Ledger cohérent. Aucune réservation orpheline. Hard limit 100¢ / exposure commits 93¢ / disponible **7¢**. Tentative Storyboard **non facturée**. Chemin Auth A (budget) puis Auth B (Storyboard) préparé.

---

## Formule exacte (`reserve_director_budget`)

```text
available = hard_limit_minor
          - SUM(budget_reservations.amount WHERE status='active')
          - GREATEST(SUM(ledger.commit) - SUM(ledger.refund), 0)
```

**Les `release` ne réduisent pas l’exposure.** Elles ferment seulement une réservation `active` ; le `commit` reste compté à vie dans le plafond.

Observé :

| Champ | Valeur |
|---|---:|
| hard_limit_minor | **100** |
| active held | **0** |
| Σ commit | **93** |
| Σ refund | **0** |
| Σ release (ledger) | 168 |
| Σ reservation (ledger) | 281 |
| available | **7** |
| can reserve 13¢ | **false** |

Écart calculé vs observé : **0**.

---

## Détail des consommations (net committed)

### Phase 10 (smokes distants)

| Phase | run (abrégé) | reserve | commit | release | net |
|---|---|---:|---:|---:|---:|
| 10B Marketing | `7353a60b` | 24 | 4 | 20 | **4** |
| 10C Creative | `f398d325` | 12 | 5 | 7 | **5** |
| 10D Script | `b33eb4ba` | 12 | 3 | 9 | **3** |
| 10E Art v2 failed | `53fb45c3` | 13 | 12 | 1 | **12** |
| 10E-V3 Art | `51d47124` | 13 | 12 | 1 | **12** |
| 10F Storyboard | `b446a0ed` | 0 | 0 | 0 | **0** |
| **Sous-total 10** | | | | | **36** |

### Antérieur (porte / essais)

| Groupe | net commit (approx.) |
|---|---:|
| Marketing pré-10B (1 completed + fails released) | 4 |
| Creative pré-10C (plusieurs attempts) | 5+7+7+7 = 26 |
| Script porte | 3 |
| Art pré-10E | 12+12 = 24 |
| Fully released (no commit) | 0 |
| **Sous-total pré-10** | **57** |

**Total exposure = 36 + 57 = 93.** Légitime ; pas d’orphelin `active`.

---

## Tentative 10F

| Champ | Valeur |
|---|---|
| run | `b446a0ed-0005-40ed-b134-b7ab769bd819` |
| status / error | `failed` / `budget_exceeded` |
| ledger 10F | **0** |
| actual | null |
| facturée | **non** |
| immuable | **oui** (`failed` terminal) |
| même clé | → `director_run_terminal_reuse` |
| `/storyboard/retry` | **n’existe pas** |
| `budget_exceeded` allowlist retry | N/A |

---

## Hard limit — emplacement & procédure

| Item | Valeur |
|---|---|
| Table | `workspace_budget_policies` |
| Colonne | `hard_limit_minor` (bigint, cents USD) |
| RPC dédiée | **aucune** — `UPDATE` service_role + `audit_log` append-only |
| Garde reserve | `reserve_director_budget` (FOR UPDATE policy) |
| Diminution ultérieure | possible si `new >= 0` ; si `new < exposure` → plus aucune réserve |
| Disponible ≠ dépense | disponible = plafond − exposure commits ; dépense réelle = Σ commit |

### Plus petit hard limit raisonnable

```text
minimal strict     = 93 + 13 = 106
proposé (marge 7¢) = 113
delta              = +13
disponible après   = 20¢
```

Marge 7¢ = tête pour commit≈12 + reste + arrondi sans ouvrir d’autre Director / média.

---

## Identité Storyboard future (sans bump de prompt)

Contrat **inchangé** : `storyboard-analyzer-v2` / schema `1.0.0`.

| Champ | Futur Auth B |
|---|---|
| attempt_number | **1** (nouvelle clé) |
| retry_of_run_id | **null** (pas de route retry) |
| lien doc | supersède `b446a0ed` |
| salt | `DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT` (env) |
| fingerprint commande | inchangé (salt hors fingerprint) |
| max appels | **1** |

Évite de changer le prompt uniquement pour contourner l’idempotence.

---

## Autorisations séparables

### A — Budget (préparé, non exécuté)

```text
CONFIRM_PHASE_10F_BUDGET_AUTH=1
PHASE_10F_NEW_HARD_LIMIT_MINOR=113
node --import tsx scripts/phase-10f-raise-workspace-hard-limit.mjs
```

Preuve : `.tmp/phase-10f-budget-auth-a-done.json` + `phase-10f-verify-budget-ready.mjs`.  
**Aucun** flag Director, **aucun** provider.

### B — Storyboard (bloquée tant que A non verte)

```text
PHASE_10F_BUDGET_AUTH_DONE=1
DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT=<nonce autorisé>
PHASE_10F_SMOKE_CONFIRM=ONE_STORYBOARD_CALL_MAX_100_CENTS
PHASE_10F_ALLOW_EXECUTE=1
PHASE_10F_DRY_ONLY=0
CONFIRM_PHASE_10F_VERCEL_FLAGS=1
```

Le smoke refuse l’execute sans évidence budget-ready + salt.

---

## Scripts / guards

- `phase-10f-audit-workspace-budget.mjs`
- `phase-10f-raise-workspace-hard-limit.mjs` (`--dry` preview ; apply refusé sans `CONFIRM_PHASE_10F_BUDGET_AUTH=1`)
- `phase-10f-verify-budget-ready.mjs`
- smoke 10F : gate Auth B (`PHASE_10F_BUDGET_AUTH_DONE` + evidence + salt)
- `storyboardIdempotencyFields` + `DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT`
- tests `phase-10f-budget-audit.test.ts`

### Validations audit

| Check | Résultat |
|---|---|
| Unitaires | **1068/1068** |
| Typecheck | PASS |
| Lint | 0 erreur |
| Build | PASS |
| Syntax scripts | PASS |
| Auth A dry preview | PASS (113 → available 20) |
| Provider / budget / ledger writes | **0** |
| Runtime | OFF (non rouvert) |

---

## Autorisation Budget A

```text
J’autorise la Phase 10F-BUDGET-AUTH-A : relever workspace_budget_policies.hard_limit_minor
de 100¢ à 113¢ (+13¢) sur le workspace du projet 984507af-…,
avec audit_log, sans ouvrir aucun flag Director, sans provider,
sans Storyboard, sans média, sans worker.
```

**Statut Auth A :** appliquée — voir `41_PHASE_10F_BUDGET_AUTH_A.md` (`PASS`, hard limit **113¢**, available **20¢**).  
**Statut Auth B :** tentée — `42_PHASE_10F_STORYBOARD_AUTH_B.md` (`BLOCKED`, 0 provider ; salt prêt, redéployer depuis HEAD salt-ready).
