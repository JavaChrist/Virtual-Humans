# 136 — Phase 11B I2V Attempt Terminal State Hardening

**Date :** 2026-08-15  
**Auth :** `AUTH_11B_I2V_ATTEMPT_TERMINAL_STATE_HARDENING`  
**Nature :** correctif code + tests · **0** write Production · attempt live **non mutée**  
**HEAD au départ :** `7b64f2e` (`135_`)

```text
VERDICT = I2V_ATTEMPT_TERMINAL_STATE_HARDENED_READY_FOR_LIVE_RECONCILIATION_PREFLIGHT
PHASE_COST = 0¢
PROVIDER_CALLS = 0
SIGNED_URL_COUNT = 0
MEDIA_READS = 0
PRODUCTION_WRITES = 0
LIVE_ATTEMPT_STATUS = started
LIVE_ATTEMPT_MUTATED = false
VIDEO_LIFECYCLE = approved
VIDEO_ACTIVE = false
HARD = 437
COMMITTED = 389
RESERVED = 0
AVAILABLE = 48
NEXT_AUTH = AUTH_11B_I2V_ATTEMPT_LIVE_RECONCILIATION_PREFLIGHT
```

---

## 1. Autorisation consommée

`AUTH_11B_I2V_ATTEMPT_TERMINAL_STATE_HARDENING` — Christian, chat courant.

Aucune mutation de `6be95728…`. Aucun provider. Aucune Auth Voice.

## 2. Git

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main initiaux | `7b64f2e` |
| ahead / behind | **0 / 0** |
| Hors scope | AICCOS protégés |
| Preview MP4 | gitignorée · non touchée |

## 3. Cause racine

Confirmée identique à `135_` : omission du script administratif `phase-11b-i2v-first-paid-single-execution.mjs`.

Après submit, le script mettait `external_job_id` en **gardant** `status=started`, puis clôturait job/run/ledger **sans** transition terminale ni `completed_at`.

Ce n’est **pas** le worker `/director` : `production-director` termine déjà l’attempt en mémoire (`completed` + `completedAt`). La table `generation_attempts` n’est écrite que par les scripts administratifs. Le défaut pouvait se reproduire si un futur script copiait 133_ — d’où un helper générique, pas une assertion docs seule.

Contraste Motion : `mt013m-mv001-final-paid-single-execution.ts` pose `completed` + `completed_at`.

## 4. Fichiers et chemins

- `studio/src/application/production/generation-attempt-terminal-state.ts` — contrat générique
- `studio/src/application/production/phase-11b-i2v-attempt-terminal-state.ts` — constantes 11B + dry-run
- `studio/src/application/production/__tests__/phase-11b-i2v-attempt-terminal-state.test.ts`
- `studio/scripts/phase-11b-i2v-first-paid-single-execution.mjs` — ordre terminal + refuse resubmit
- ce rapport `136_` + living handover / index

Aucun UUID 11B dans le helper générique.

## 5. Contrat terminal

| Outcome | status | completed_at | retryable |
|---|---|---|---|
| success | `completed` | non nul | false |
| provider_failed / quarantined | `failed` | non nul | false |
| submission_unknown / provider_pending | hold (`started`) | null | false |

`external_job_id`, provider et model conservés. `cost_status=provisional` seulement après succès. Aucune mutation asset/ledger/flags par le helper.

## 6. Ordre des transitions

1. submit intent · 2. submit unique · 3. persist providerJobId · 4. provider terminal · 5. ingest/échec · **6. attempt terminal** · **7. job terminal** · **8. run terminal** · 9. settlement · 10. HR handoff.

Le script historique refuse désormais toute réexécution (`AUTH` consommée).

## 7. Helper / guards

- cible attempt + workspace/projet/run ;
- compare-and-swap sur `status` courant ;
- refuse conflit optimistic et terminal contradictoire ;
- replay `existing` si déjà au statut désiré ;
- ne rouvre jamais un attempt terminal ;
- n’incrémente jamais `submitCount` ;
- 0 provider / budget / asset / flag.

## 8. Atomicité et reprise

Pas de transaction DB unique (schéma sans revision attempt). Reprise idempotente :

- crash après provider terminal → `mark_attempt_terminal` · `mayResubmit=false` ;
- crash après attempt terminal → `mark_job_run` ou `done` · `mayResubmit=false`.

Aucun second submit, asset, settlement ou réserve.

## 9–12. Comportements

| Chemin | Attempt | Resubmit |
|---|---|---|
| success | `completed` | 0 |
| failed | `failed` | 0 |
| submission_unknown | hold + `retryable=false` | 0 |
| quarantine | `failed` | 0 |

## 13–14. Idempotence et no-resubmit

Replay success → `existing`. Script payant : `PHASE_11B_I2V_PAID_SCRIPT_AUTH_CONSUMED=true`. `submitCount` reste 1. Auth 133_ consommée.

## 15. Dry-run reconciliation

`planPhase11BLiveAttemptReconciliation` :

- cible exacte `6be95728…` / run `4c5b53a5…` / job `2e43152b…` ;
- `currentStatus=started` · desired `completed` · `retryable=false` ;
- `mutationAllowed=false` ;
- refuse scope, attempt, run/job, providerJobId manquant, attempts multiples, terminal contradictoire, asset/budget incohérents.

**Aucune mutation live.**

## 16. État live non modifié

Attempt `6be95728…` reste `started` · `completed_at` null.  
Vidéo `9be6cb0c…` `approved` / `active=false`. Budget 437/389/0/48. Flags OFF.

## 17. Tests

| Check | Résultat |
|---|---|
| Ciblés terminal state | **10/10** |
| Suite unitaire | **1692/1692** |
| Typecheck | **PASS** |
| Lint pertinent | **PASS** |
| Build | **PASS** |
| Fraîcheur | **PASS** · `nextPhase=AUTH_11B_I2V_ATTEMPT_LIVE_RECONCILIATION_PREFLIGHT` |
| Secret scan | **PASS** |
| pgTAP / intégration / E2E | **N/A** · non relancés |

## 18–19. Secret scan et compteurs

`PROVIDER_CALLS=0` · `SIGNED_URL_COUNT=0` · `MEDIA_READS=0` · `PRODUCTION_WRITES=0` · `BUDGET_WRITES=0` · `FLAGS_WRITTEN=0` · `RETRY=0` · `RESUBMIT=0`.

## 20. Working tree

AICCOS exclus. Preview MP4 absente de Git.

## 21. Commit / push

Push normal `main` si le périmètre est propre.

## 22. Verdict

**`I2V_ATTEMPT_TERMINAL_STATE_HARDENED_READY_FOR_LIVE_RECONCILIATION_PREFLIGHT`**

Le code empêche la récidive. La ligne live n’est pas corrigée.

## 23. Prochaine porte (non exécutée)

**`AUTH_11B_I2V_ATTEMPT_LIVE_RECONCILIATION_PREFLIGHT`**

Vérifier le déploiement du hardening, relire l’attempt, préparer un CAS unique, **sans** écriture Production.  
La mutation live exigera une Auth humaine distincte. Voice/TTS **non ouvert**.
