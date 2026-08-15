# 137 — Phase 11B I2V Attempt Live Reconciliation Preflight

**Date :** 2026-08-15  
**Auth :** `AUTH_11B_I2V_ATTEMPT_LIVE_RECONCILIATION_PREFLIGHT`  
**Nature :** preflight read-only · CAS préparé · **0** write Production · attempt live **non mutée**  
**HEAD au départ :** `97f7ad7` (`136_`)  
**Déploiement inspecté :** Production Ready `virtual-humans-lpat9jazt-…` · Commit **`97f7ad7`**

```text
VERDICT = I2V_ATTEMPT_LIVE_RECONCILIATION_PREFLIGHT_READY_FOR_SINGLE_WRITE_AUTH
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
FLAGS_WRITTEN = 0
RETRY = 0
RESUBMIT = 0
DOWNSTREAM = 0
RUNTIME_PAID_MEDIA = OFF
NEXT_AUTH = AUTH_11B_I2V_ATTEMPT_LIVE_RECONCILIATION_SINGLE_WRITE
```

---

## 1. Autorisation consommée

`AUTH_11B_I2V_ATTEMPT_LIVE_RECONCILIATION_PREFLIGHT` — Christian, chat courant.

Aucune mutation de `6be95728…`. Aucun provider. Aucune Auth single-write. Voice/TTS non ouvert.

## 2. Git initial et final

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main initiaux | `97f7ad7` |
| ahead / behind | **0 / 0** |
| Hors scope | AICCOS protégés |
| Preview MP4 | gitignorée · non touchée |

## 3. Déploiement et SHA

| Champ | Valeur |
|---|---|
| Alias | `virtual-humans.vercel.app` |
| Host inspecté | `virtual-humans-lpat9jazt-…` |
| id | `dpl_GG76aiXdjA98dDnRpLNZCKntCsuf` |
| Environnement | **production** |
| Statut | **Ready** |
| Created | 2026-08-15 02:21:10 Europe/Paris |
| Commit | **`97f7ad7`** `feat(studio): harden I2V generation attempt terminal state` |
| Relation à `97f7ad7` | **égal** — auto-deploy après push `136_` |
| Descendant | n/a — SHA exact |
| Déploiement manuel | **aucun** |

Porte déploiement : **PASS**. Hardening présent. Pas de `BLOCKED_I2V_ATTEMPT_RECONCILIATION_HARDENING_NOT_DEPLOYED`.

## 4. Working tree

Hors scope inchangés :

- `studio/src/app/api/aiccos/send/route.ts`
- `studio/src/components/send-to-aiccos.tsx`

Ni modifiés, ni restorés, ni stashés, ni inclus au commit.

## 5. Attempt live

Lecture métadonnées seulement. Préfixes.

| Champ | Live |
|---|---|
| id | `6be95728-3c97-4c34-86c9-b1b5ab3a92dc` |
| workspace / projet | `3c308f57…` / `984507af…` |
| run | `4c5b53a5…` |
| kind / n | `primary` / 1 |
| scene / step | `scene-2` / `i2v-kling-5s` |
| idempotency key prefix | `984507af-a89e-46…` |
| status | **`started`** |
| completed_at | **null** |
| retryable | **null** |
| external_job_id | présent · prefix `01a0025d` |
| provider / model | `fal` / `fal-ai/kling-video/v2/master/image-to-video` |
| cost_status | null (ledger provisional distinct) |
| estimate | 140¢ |
| started_at | null |
| created_at | 2026-08-14 22:20:47.701Z |
| revision/version colonne | **absente** |

Attempts pour ce run : **1**. Unique `started` du workspace : celle-ci.

## 6. Run et job

| Entité | Prefix | Statut | completed_at | Notes |
|---|---|---|---|---|
| run | `4c5b53a5…` | `completed` | null | rev.2 · `waitingReason` null · review pending false · cancel null |
| job | `2e43152b…` | `completed` | null | `submitCount=1` · `attempt_count=0` · `max_attempts=1` |
| job.external_job_id | `01a0025d…` | présent | — | match attempt |
| lease | — | absent | — | `leased_by` null · `lease_token` absent · `lease_expires_at` null |

`claim_production_jobs` ne revendique que `queued` / `expired_lease`. Job `completed` **non claimable**.  
Jobs I2V du projet : **1**. Autres runs du projet : 2 image 11A (`f43377a6…`, `39329a01…`) — **pas** I2V.

## 7. Output et Human Review

| Champ | Live |
|---|---|
| vidéos pour le run | **1** |
| asset | `9be6cb0c…` |
| checksum | `e929f00a…` exact |
| MIME / taille / durée | `video/mp4` · 1 629 267 · 5.00 |
| lifecycle | `approved` |
| active / published | `false` / `false` |
| parent | `49284892…` |
| HR I2V | **1** `301ee080…` `approved` · 2026-08-14 23:31:45.489Z |
| REJECT I2V | **0** |

Aucun média lu. Aucune URL.

## 8. Budget

| | ¢ |
|---|---|
| hard | **437** |
| committed | **389** (247 committed + 142 provisional dont 140 I2V) |
| reserved actif | **0** |
| available | **48** |
| réserve I2V `451bdeb3…` | `committed` · 168¢ · commit 140¢ provisional · release 28¢ · 2026-08-14 22:24:42.589Z |
| réservations actives | 0 |
| reconciliations ouvertes | 0 |

## 9. Flags

Noms présents en Production. Valeurs **Encrypted** — aucune lecture de secret.  
Dernière mise à jour VHS11B ~11 h, cohérente avec le `finally` de `133_`.  
`134_` / `135_` / `136_` / cette phase : **FLAGS_WRITTEN=0**.  
Autorité de fermeture : `133_` `finally`. Runtime Paid Media : **OFF**.

## 10. Timestamps disponibles

| Source | Valeur | Rang Auth |
|---|---|---|
| provider terminal persisté | **absent** (job.result = mime/bytes/checksum/outputAssetId) | 1 |
| job.completed_at | **null** | 2 |
| run.completed_at | **null** | 3 |
| asset.created_at (ingest) | **2026-08-14T22:24:41.938Z** | 4 |
| settlement commit/release | 2026-08-14T22:24:42.589Z | 5 |
| HR created_at | 2026-08-14T23:31:45.489Z | 6 |
| attempt.created_at / submit | 2026-08-14T22:20:47.701Z | plancher |

## 11. Choix de `completed_at`

**Retenu :** `2026-08-14T22:24:41.938Z`  
**Source :** `asset_ingest` (preuve historique, pas une horloge de reconciliation).

Justifications :

- aucun timestamp provider/job/run terminal persisté ;
- l’ingest est la fin opérationnelle de l’attempt (ordre : provider → ingest → attempt terminal) ;
- postérieur au submit / acceptation (`22:20:47Z`) ;
- antérieur au settlement (650 ms) et à la HR (`23:31:45Z`) ;
- non inventé.

`retryable` live = null → désiré `false`.

## 12. CAS exact redacted (non exécuté)

```text
UPDATE generation_attempts
SET status = 'completed',
    completed_at = '2026-08-14T22:24:41.938Z',
    retryable = false
WHERE id = '6be95728-…'
  AND workspace_id = '3c308f57-…'
  AND project_id = '984507af-…'
  AND run_id = '4c5b53a5-…'
  AND status = 'started'
  AND completed_at IS NULL
  AND external_job_id IS NOT NULL
  AND left(external_job_id, 8) = '01a0025d'
RETURNING id;
-- expectedRows = 1
-- si 0 ou >1 : STOP, aucun second write
-- executed = false
```

## 13. Colonnes modifiées (futur)

Uniquement : `status` · `completed_at` · `retryable`.

Inchangés : `external_job_id` · `provider_id` · `model_id` · `idempotency_key` · `run_id` · `cost_status` · job · run · asset · HR · budget · ledger · artifacts · flags.

Pas de colonne `updated_at` sur `generation_attempts`.

## 14. Triggers et contraintes

Triggers sur `generation_attempts` : **aucun**.  
Contraintes : PK · FK workspace/projet/run · UNIQUE `idempotency_key` · `kind` primary/fallback · `attempt_number >= 1`.  
Aucun CHECK de statut n’interdit `completed`.  
Aucun trigger ne mutera une autre table.

## 15. Expected row count

**1**. Abort si 0 ou plusieurs.

## 16. Dry-run

`planPhase11BLiveAttemptReconciliation(PHASE_11B_VERIFIED_LIVE_FACTS)` :

| Champ | Valeur |
|---|---|
| target | `6be95728…` |
| currentStatus | `started` |
| desiredStatus | `completed` |
| desiredCompletedAt | `2026-08-14T22:24:41.938Z` |
| retryable | false |
| preconditionsPassed | **true** |
| mutationAllowed | **false** |
| expectedRows | 1 |
| sideEffects | none |
| resubmitAllowed | false |
| accepted | true |

Refus exercés : mauvais workspace/projet/attempt/run/job · attempts multiples · status ≠ started · `completed_at` non null · job/run non completed · submitCount ≠ 1 · providerJobId absent · output 0/2 · asset non approved · HR contradictoire · budget/réserve incohérents · terminal contradictoire.

## 17. Replay et fingerprint

Replay identique. Fingerprint déterministe : `e6fb295c4efc65fd`.

## 18. Analyse no-resubmit

- job `completed` non claimable ;
- aucun consumer applicatif ne scanne `generation_attempts.status='started'` pour resoumettre ;
- UNIQUE `idempotency_key` ;
- `submitCount=1` ;
- providerJobId présent ;
- flags refermés `133_` · 0 write depuis ;
- Auth payante `133_` consommée · script refuse resubmit.

Après mutation projetée : recovery/métriques ne verront plus un attempt actif ; `completed` ≠ activation/merge (déjà prouvé par HR APPROVE inactive).

## 19. Effets collatéraux attendus

**0.** Helper/CAS ne touchent ni provider, ni média, ni budget, ni flags, ni artifacts.

## 20. Tests

| Check | Valeur |
|---|---|
| Ciblés 136_ + 137_ | **17/17** |
| Unitaires | **1699/1699** |
| Typecheck / lint / build | **PASS** |
| Fraîcheur | **PASS** (après docs) |
| pgTAP / intégration / E2E | **non relancés** |

## 21. Secret scan

PASS sur le diff candidat. Aucun secret, URL signée, média, base64.

## 22. Compteurs

`PROVIDER_CALLS=0` · `SIGNED_URL_COUNT=0` · `MEDIA_READS=0` · `PRODUCTION_WRITES=0` · `BUDGET_WRITES=0` · `FLAGS_WRITTEN=0` · `RETRY=0` · `RESUBMIT=0` · `DOWNSTREAM=0`.

## 23. Fichiers

- `studio/src/application/production/phase-11b-i2v-attempt-terminal-state.ts`
- `studio/src/application/production/__tests__/phase-11b-i2v-attempt-live-reconciliation-preflight.test.ts`
- `studio/src/application/production/__tests__/phase-11b-i2v-attempt-terminal-state.test.ts`
- ce rapport `137_` + living handover / index

AICCOS exclus.

## 24. Commit et push

Commit de clôture de cette phase. Push normal `main` si le scope est propre.

## 25. Verdict

`I2V_ATTEMPT_LIVE_RECONCILIATION_PREFLIGHT_READY_FOR_SINGLE_WRITE_AUTH`

Hardening déployé. Facts live cohérents. CAS bornable. Mutation **non** exécutée.

## 26. Prochaine porte — non exécutée

`AUTH_11B_I2V_ATTEMPT_LIVE_RECONCILIATION_SINGLE_WRITE`

Une seule écriture Production CAS. 0 provider · 0 média · 0 budget · 0 flag · aucune autre mutation.

Après reconciliation : traiter ou différer explicitement la dette P1 des pointeurs d’artifacts **avant** Voice/TTS.
