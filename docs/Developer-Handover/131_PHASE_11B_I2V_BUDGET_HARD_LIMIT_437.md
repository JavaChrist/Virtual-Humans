# 131 — Phase 11B I2V Budget Hard Limit 437¢

**Date :** 2026-08-14  
**Auth :** `AUTH_11B_I2V_BUDGET_HARD_LIMIT_437`  
**Nature :** une seule mutation de plafond · **0** dépense · **0** réservation · **0** provider  
**HEAD au départ :** `89d16e4` (`130_`)

```text
VERDICT = I2V_BUDGET_HARD_LIMIT_437_APPLIED_PAID_EXECUTION_STILL_LOCKED
HARD_LIMIT = 437
COMMITTED = 249
RESERVED = 0
AVAILABLE = 188
I2V_RESERVATIONS_CREATED = 0
PHASE_COST = 0¢
PROVIDER_CALLS = 0
BUDGET_WRITES = 1
NEXT_AUTH = AUTH_11B_I2V_PAID_SMOKE_FINAL_PREFLIGHT
```

---

## 1. Autorisation humaine

`AUTH_11B_I2V_BUDGET_HARD_LIMIT_437` — Christian, chat courant.

Un hard limit n’est pas une dépense. Cette Auth **n’est pas** une autorisation fal.

## 2–4. Git

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD initial | `89d16e4` |
| origin/main | `89d16e4` |
| ahead / behind | **0 / 0** |
| Working tree | AICCOS hors scope protégés |
| Hors scope | `studio/src/app/api/aiccos/send/route.ts` · `studio/src/components/send-to-aiccos.tsx` |

## 5. Politique ciblée (redacted)

| Champ | Valeur |
|---|---|
| Projet Supabase | `ejdb…nmvi` · Virtual Humans Studio |
| Workspace | `3c308f57…` |
| Table | `workspace_budget_policies` |
| Politiques | **1** (globale) |
| Colonne | `hard_limit_minor` seulement |
| Devise | USD |

## 6–8. Avant / préconditions

| | Avant |
|---|---|
| hard | **274¢** |
| committed | **249¢** |
| reserved | **0¢** |
| available | **25¢** |
| réservations actives | 0 |
| réservations I2V | 0 |
| reconciliations | table absente · 0 ouverte |
| ledger rows | 66 |
| reservation rows | 25 (historiques, 0 active) |
| runs / jobs | 3 / 3 |
| flags VHS11B | absents = OFF |
| Paid/Worker/VHS124/Motion | Encrypted · 0 write |

Garde old value = 274¢ · workspace exact · 1 politique · committed/reserved inchangés.

## 9–10. Mutation

Compare-and-swap atomique :

```text
UPDATE workspace_budget_policies
SET hard_limit_minor = 437
WHERE workspace_id = 3c308f57… AND hard_limit_minor = 274
```

| | |
|---|---|
| Lignes affectées | **1** |
| Nouvelle politique | **non** |
| Deuxième write | **interdit / non fait** |
| Ledger / reserved | **non touchés** |

## 11–14. Après

| | Après |
|---|---|
| hard | **437¢** |
| committed | **249¢** inchangé |
| reserved | **0¢** inchangé |
| available | **188¢** (437 − 249 − 0) |
| I2V reservations | **0** |
| reconciliations | **0** |
| ledger rows | 66 inchangé |
| reservation rows | 25 inchangé |
| runs / jobs | 3 / 3 inchangés |
| policy rows | 1 |

Replay lecture seule : hard 437 · committed 249 · reserved 0. **0 second write.**

## 15. Recalcul I2V futur (non réservé)

| | ¢ |
|---|---|
| Estimate Kling 5 s | 140 |
| Future réserve / cap | 168 |
| Available après raise | 188 |
| Marge après future réserve | 20 |

Cette réserve **n’a pas** été créée.

## 16–20. Compteurs

| Compteur | Valeur |
|---|---|
| BUDGET_WRITES | **1** (hard limit only) |
| RESERVATIONS_CREATED | **0** |
| FAL / OPENAI / ELEVENLABS / OTHER | **0 / 0 / 0 / 0** |
| MEDIA_READS | **0** |
| SIGNED_URL_COUNT | **0** |
| RUNS_CREATED | **0** |
| JOBS_CREATED | **0** |

## 21–22. Flags et asset

Flags finaux identiques au départ : VHS11B absents · Paid/Worker/VHS124/Motion Encrypted · **FLAGS_WRITTEN = 0** · runtime Paid Media OFF.

Asset `49284892…` : `approved` · `active=false` · preuve `130_` · **non relu**.

## 23–24. Tests

| Check | Résultat |
|---|---|
| Unitaires | **1660/1660** (1655 + 5 hard-limit) |
| Typecheck / lint / build | PASS |
| Fraîcheur | PASS après alignement |
| Secret scan | PASS · fixture `token=` du test de redaction seulement |
| pgTAP / intégration / E2E | **N/A** historiques |

## 25. Fichiers

- `studio/src/application/production/phase-11b-i2v-budget-hard-limit.ts`
- `studio/src/application/production/__tests__/phase-11b-i2v-budget-hard-limit.test.ts`
- ce rapport `131_`
- living handover + index

AICCOS **exclus**.

## 26. Commit / push

Voir living handover après commit. Push normal `main` uniquement.

## 27. Verdict

**`I2V_BUDGET_HARD_LIMIT_437_APPLIED_PAID_EXECUTION_STILL_LOCKED`**

Le plafond est prêt. Aucune dépense, aucune réservation, aucun provider, flags OFF. Une Auth humaine distincte reste obligatoire avant le smoke.

## 28. Prochaine porte (non exécutée)

**`AUTH_11B_I2V_PAID_SMOKE_FINAL_PREFLIGHT`**

Préparer et vérifier, **sans** appeler fal dans cette porte suivante :

- réserve max 168¢
- 1 appel fal / 1 job / 1 output
- Kling I2V 5 s
- 0 retry / 0 fallback
- signature call-time
- ingest privé · QC · HR
- output `active=false` · downstream OFF
- fermeture flags

---

## Interdictions respectées

Aucun fal · aucun OpenAI · aucune réservation · aucun ledger spend · aucun flag · aucun média · aucun run/job · AICCOS intacts.
