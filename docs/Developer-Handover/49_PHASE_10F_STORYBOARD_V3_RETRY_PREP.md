# 49 — Phase 10F-V3-RETRY-PREP — Storyboard v3 après Continuity Fix

**Date :** 10 août 2026  
**Entrée :** `48_PHASE_10F_STORYBOARD_CONTINUITY_DIAG.md` (prompt v3)  
**Provider calls pendant PREP :** **0**  
**Budget write / deploy / push :** **non**

---

## Verdict

```text
READY_FOR_BUDGET_AND_PUSH_AUTH
```

Préparation locale complète pour un futur execute Storyboard **v3**.  
`available (12¢) < estimate (13¢)` → Auth budget (C) **séparée** avant Auth provider.

---

## Runs précédents immuables

| Run | Statut | Empreinte clé |
|---|---|---|
| `b446a0ed-…` | failed / budget_exceeded | `abaa9c2886ef3d59` (v2, no salt) |
| `f5b75018-…` | failed / request_failed | `3f39f808e266649c` (v2, salt Auth-B) |
| `4914c203-…` | failed / invalid_candidate | `0b7e8fb44e0acd4d` (v2, salt RETRY2) |

Aucun de ces runs n’est rejoué. Salt brûlés : `10f-auth-b-20260810`, `10f-auth-b-retry2-20260810`.

---

## Contrat prompt / schéma

| Champ | Valeur |
|---|---|
| Prompt | **`storyboard-analyzer-v3`** |
| Schemas | **1.0.0 / 1.0.0** |
| Map | `REQUIRED_LOCATION_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID` |
| Validateur métier | **inchangé** (`projectContinuity`) fail-closed |
| oneOf | **0** |
| anyOf-compatible | **true** |
| Parité Zod/OpenAI | **PASS** |
| spokenContent variants | preserved |

Le prompt v3 exige copie exacte `location:<continuityKey>`, interdiction de traduction/renommage, conservation sur variation visuelle, self-check avant réponse.

---

## Required location map (Production)

Lecture redacted artifacts amont (`49481462-…` VisualDirection rev.1) :

```text
requiredLocationKeyCount = 5
requiredLocationKeyCoverage = complete
5/5 → location:espace-numerique-principal
```

---

## Nouvelle idempotence

| Champ | Valeur |
|---|---|
| Salt proposé | **`10f-storyboard-v3-20260810`** |
| Empreinte clé | **`1bf9daeb68eb6432`** |
| Distincte des 3 failed | **oui** |
| attempt_number | **1** |
| retry_of_run_id | **null** |
| Stabilité execute/replay | même salt → même clé |

---

## Estimation exacte (locale, amont Production)

| Champ | Valeur |
|---|---|
| Provider / modèle | OpenAI / `gpt-5.6` |
| Reasoning / max out | `medium` / `4096` |
| Price book | 500 / 3000 ¢/MTok |
| approxInputTokens | **3004** |
| estimate | **13¢** |
| reservation | **13¢** (= estimate) |
| hard limit | **113¢** |
| committed | **101¢** |
| reserved | **0** |
| available | **12¢** |
| shortfall | **1¢** |

### Autorisation Budget C proposée (non exécutée)

| Option | Hard limit | Delta | Available après |
|---|---|---|---|
| Strict minimum | **114¢** | +1 | **13¢** |
| **Recommandé** | **115¢** | **+2** | **14¢** |

Aucune dépense immédiate ; aucune écriture budget dans cette phase.

---

## Observabilité

Confirmé prêt avant provider :

- HTTP / code / request ID capturables (redacted)
- stage / durée / networkAttempts
- usage présent/absent
- continuité métier rapportable sans candidat brut
- aucune donnée sensible persistée dans evidence PREP

---

## Guards futurs

| Guard | Statut |
|---|---|
| Max provider calls | **1** |
| Automatic retry | forbidden |
| Fallback | forbidden |
| Upstream replay | forbidden |
| PAID_GENERATION / Worker / media | OFF / impossible |
| Scripts v2 accidentels | refuse (`storyboard-analyzer-v2` bloqué dans smoke) |
| Fermeture post-fenêtre | all Director AI = 0, PAID=0, Worker=0, runtime OFF |

Dry-run live futur devra confirmer : prompt v3, location 5/complete, oneOf=0, anyOf-compatible, salt présent, empreinte attendue, estimate/reservation 13, budget suffisant.

---

## Preuves locales

| Artefact | Rôle |
|---|---|
| `studio/scripts/phase-10f-v3-retry-prep-local.mjs` | preuve offline + lecture Production redacted |
| `studio/.tmp/phase-10f-v3-retry-prep-done.json` | evidence (non commitée) |
| `phase-10f-v3-retry-prep-guards.test.ts` | guards + matrice continuité |
| `phase-10f-continuity-diag.test.ts` | contrat v3 / validateur |

### Validations PREP

| Check | Résultat |
|---|---|
| Unitaires | **1098/1098** |
| Typecheck | PASS |
| Lint | 0 erreur (warnings préexistants) |
| Build | PASS |
| Runtime OFF | PASS (`CURRENT_RUNTIME_REAL_AI=OFF`) |
| Provider / runs / ledger / budget writes | **0** |
| Push | non |

---

## Suite (autorisations séparées)

1. **Auth Budget C** — hard limit ≥ 114 (reco 115) ; **pas** d’execute.
2. **Auth Push** — commit PREP + DIAG vers `origin/main` ; redeploy Storyboard.
3. **Auth Provider** — 1 appel max, salt `10f-storyboard-v3-20260810`, fermeture OFF systématique.

**Aucun execute Storyboard dans cette phase.**
