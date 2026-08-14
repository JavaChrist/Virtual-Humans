# 133 — Phase 11B I2V First Paid Single Execution

**Date :** 2026-08-15  
**Auth :** `AUTH_11B_I2V_FIRST_PAID_SINGLE_EXECUTION`  
**Nature :** première exécution I2V payante unique · **1** réserve 168¢ · **1** submit fal · **1** output privé · HR pending  
**HEAD au départ :** `8c50b35` (`132_`)  
**Déploiement utilisé :** Production Ready `virtual-humans-m0arcixms-…` · Commit **`8c50b35`**

```text
VERDICT = I2V_FIRST_PAID_SINGLE_EXECUTION_PRIVATE_HUMAN_REVIEW_PENDING
AUTH_CONSUMED = true
FAL_SUBMITS = 1
FAL_STATUS_POLLS = 34
PROVIDER_STATUS = COMPLETED
OUTPUT_COUNT = 1
INGESTED = true
VIDEO_ACTIVE = false
HUMAN_REVIEW_PENDING = true
HUMAN_REVIEW_DECISION = none
HARD = 437
COMMITTED = 389
RESERVED = 0
AVAILABLE = 48
SETTLEMENT = provisional 140¢
PHASE_COST = 140¢
FLAGS_FINAL = OFF
RETRY = 0
FALLBACK = 0
DOWNSTREAM = 0
NEXT_AUTH = AUTH_11B_I2V_PRIVATE_PREVIEW_AND_HUMAN_DECISION
```

---

## 1. Autorisation humaine consommée

`AUTH_11B_I2V_FIRST_PAID_SINGLE_EXECUTION` — Christian, chat courant.

Plafond consommé : **1** submit fal accepté (`providerJobId` `01a0025d…`).  
Cette Auth **n’autorise plus** aucun second submit, même en cas de preview décevante, REJECT futur, ou reprise.

## 2–3. Git initial et final

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD initial | `8c50b35` |
| origin/main initial | `8c50b35` |
| ahead / behind initial | **0 / 0** |
| HEAD final | pending commit (ce rapport) |
| Working tree hors scope | AICCOS protégés · ni stagés ni restorés |
| Script d’exécution | `studio/scripts/phase-11b-i2v-first-paid-single-execution.mjs` |

## 4. Déploiement Production

| Champ | Valeur |
|---|---|
| Alias | `virtual-humans.vercel.app` |
| Host inspecté | `virtual-humans-m0arcixms-…` |
| Environnement | **production** |
| Statut | **Ready** |
| Clone log | `Branch: main, Commit: 8c50b35` |
| Wiring | **`57de914`** ancêtre |
| Guards / allowlist ingest `*.fal.media` | présents jusqu’à `8c50b35` |
| Déploiement manuel | **aucun** |

Porte déploiement : **PASS**. Réserve et flags ouverts seulement après cette preuve.

## 5. Working tree et protection AICCOS

Hors scope inchangés :

- `studio/src/app/api/aiccos/send/route.ts`
- `studio/src/components/send-to-aiccos.tsx`

Ni modifiés par cette phase, ni restorés, ni stashés, ni inclus au commit.

## 6. Préconditions

Toutes **PASS** avant réserve :

1. living handover + `130_`/`131_`/`132_` lus
2. HEAD = origin/main = `8c50b35` · behind=0
3. Production Ready SHA exact `8c50b35`
4. asset source metadata live conforme
5. budget live 437 / 249 / 0 / 188
6. pricing officiel fal **$1.40 / 5 s** inchangé
7. 0 réserve I2V active · 0 run/job I2V concurrent
8. flags runtime OFF avant ouverture
9. tests ciblés 11B **39/39**
10. fingerprints / idempotency key figés (`6e7199283c45e940` · clé `984507af…:phase-11b-i2v-paid-smoke-final-preflight-1.0.0:scene-2:i2v-kling-5s:1`)
11. chemin 1 submit / 1 job / 1 output
12. retry / fallback / downstream vides
13. `finally` flags prouvé
14. `FAL_KEY` présent · jamais affiché

Correctif pré-réserve : le script charge `.env.remote.local` (hôte Production attendu). `.env.local` pointe localhost et a été refusé.

## 7. Asset source

Asset `49284892-d6ba-5249-b645-4f55084361cc` revalidé juste avant réserve.

| Champ | Live |
|---|---|
| workspace / projet | `3c308f57…` / `984507af…` |
| lifecycle | `approved` |
| active | `false` |
| source_kind | `internal` |
| bucket | `director-final-assets` |
| MIME / dims | `image/png` · 1024×1024 |
| checksum | `9ac484b7…` exact |
| type | `composed_overlay_image` |
| scène | `scene-2` |
| HR source | `fb2f886c…` APPROVE (historique 11A) |
| stale / quarantine | absents |

Source **toujours** `approved` / `active=false` après exécution. Aucune lecture locale des octets source.

## 8. Budget avant

| | ¢ |
|---|---|
| hard | **437** |
| committed | **249** |
| reserved | **0** |
| available | **188** |
| réservations actives | 0 |

## 9. Pricing

Source officielle fal llms.txt 2026-08-15 :

| Champ | Valeur |
|---|---|
| provider / modèle | fal · `fal-ai/kling-video/v2/master/image-to-video` |
| durée | **5 s** |
| estimate | **140¢** |
| cap | **168¢** |

Aucune hausse. Cap non augmenté.

## 10. Réservation

Créée **une** fois.

| Champ | Valeur |
|---|---|
| id prefix | `451bdeb3…` |
| capability | `video.image_to_video` |
| estimate / reserved | 140 / **168** ¢ |
| statut final | `committed` |
| replay | non rejoué · une seule création |

Après création (avant settlement) : hard 437 · committed 249 · reserved 168 · available 20 · 1 active.

## 11. Idempotency key (redacted)

`984507af…:phase-11b-i2v-paid-smoke-final-preflight-1.0.0:scene-2:i2v-kling-5s:1`

## 12. Run / job

| Entité | Prefix | Statut |
|---|---|---|
| generation_plan rev 3 | — | persisté · non promu pointeur 11A |
| run | `4c5b53a5…` | `completed` · `waitingReason=needs_review` |
| job | `2e43152b…` | `completed` · `submitCount=1` |
| attempt | `6be95728…` | ligne unique · statut ligne resté `started` (incohérence mineure documentée · **0** resubmit) |

Maximum respecté : 1 run · 1 job · 1 attempt.

## 13. Submit intent

Persisté **avant** communication fal (`submitIntentPersisted=true`, `submitCount=0` puis `1` après acceptation).

## 14. Flags

Ouverts temporairement à `1` (Production), puis refermés à `0` dans `finally` (ordre inverse) :

1. `DIRECTOR_V2_WORKER_ENABLED`
2. `DIRECTOR_V2_PAID_GENERATION_ENABLED`
3. `VHS11B_I2V_CAPABILITY_ENABLED`
4. `VHS11B_I2V_PAID_ENABLED`
5. `VHS11B_I2V_FAL_ENABLED`
6. `VHS11B_FAL_I2V_DIRECTOR_EXCEPTION`
7. `VHS11B_I2V_WORKER_ENABLED`

Toujours OFF : `DIRECTOR_V2_PAID_AI_ENABLED` · `VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION` · `VHS11B_I2V_DOWNSTREAM_ENABLED` · Motion (4).

`flagsOpened=true` · `flagsClosed=true` · `FLAG | finally executed`.

Runtime Paid Media final : **OFF**.

## 15–16. Signed URL et lecture source

| Compteur | Valeur |
|---|---|
| SIGNED_URL_COUNT | **1** |
| TTL | 60 s · mémoire seulement |
| Persistance URL | **aucune** (DB / log / Git / rapport) |
| MEDIA_SOURCE_READS (octets locaux) | **0** |
| Lecture provider de l’image | **1** (via URL call-time) |

## 17–19. Fal

| Compteur | Valeur |
|---|---|
| FAL_SUBMITS | **1** |
| FAL_STATUS_POLLS | **34** |
| providerJobId | `01a0025d…` (redacted) |
| statut provider | **COMPLETED** |
| invocations worker | 1 processus local borné |
| fresh-process recovery | non exercée (même processus) |

Aucun second submit. Polling uniquement sur le `providerJobId` persisté.

## 20–21. Output et ingest

| Champ | Valeur |
|---|---|
| output count | **1** |
| MIME | `video/mp4` |
| taille | 1 629 267 octets (< 80 MiB) |
| checksum | `e929f00a5625d37f6b3f390b66193d4b8a60fecaf5a0bf36c6f2fb89ce00195f` |
| bucket | `director-final-assets` privé |
| path | canonique workspace/projet `…/media/video/i2v/{uuid}.mp4` · **match** |
| overwrite | interdit · non exercé |
| asset prefix | `9be6cb0c…` |
| lifecycle | `pending_review` |
| active / published | `false` / `false` |
| merge / export / downstream | `false` |
| parent | `49284892…` |
| URL fal persistée | **non** |

## 22–23. QC

| Contrôle | Résultat |
|---|---|
| MIME / taille / checksum / provenance | **PASS** |
| durée | `5.00` persistée · probe **unavailable** (`assumed_5s_no_probe`) |
| dimensions / FPS / décodabilité | **unavailable** |
| visuel | `unavailable_humanOnly` |
| auto-approve | **non** |

quality_report rev **5** · production_result rev **9**.

## 24. Human Review

Demande pending Production via :

- asset `pending_review` · `active=false`
- run `reviewRequest.pending=true`
- quality_report + production_result

**0** ligne `human_review_decisions` (pas d’APPROVE / REJECT).  
Activation / publish / merge / export / voice / lipsync : **non**.

## 25. Budget après et settlement

| | ¢ |
|---|---|
| hard | **437** |
| committed | **389** |
| reserved actif | **0** |
| available | **48** |

Ledger de cette exécution :

- reserved 168¢
- provisional **140¢** (liste officielle fal $1.40 · **pas** de champ facture provider)
- released 28¢

Settlement **une** fois. Cap 168¢ non dépassé. Aucune deuxième réserve. Aucune reconciliation artificielle.

## 26. Retry / fallback / downstream

| Invariant | Valeur |
|---|---|
| RETRY | **0** |
| FALLBACK | **0** |
| DOWNSTREAM | **0** |
| MOTION / T2V / VOICE / LIPSYNC | **0** |
| ASSET_ACTIVATION | **0** |
| MERGE_EXPORT | **0** |

## 27. Tests

| Check | Résultat |
|---|---|
| Ciblés 11B avant runtime | **39/39** |
| Ciblés + fraîcheur après | **45/45** |
| Suite unitaire | **1672/1672** |
| Typecheck / lint / build | PASS · lint 0 error (warnings préexistants) |
| Fraîcheur documentaire | PASS |
| Secret scan diff | PASS · fixture `token=` de redaction seulement |
| pgTAP / intégration DB / E2E | **N/A** · non relancés |

## 28. Secret scan

Aucun secret, URL signée, URL fal, clé, média ou base64 dans le diff candidat.  
`.tmp/` gitignoré.

## 29. Fichiers

- `studio/scripts/phase-11b-i2v-first-paid-single-execution.mjs`
- ce rapport `133_`
- living handover + index / changelog / backlog / glossary / checklist / Leo handover
- test de fraîcheur (`nextPhase`)

AICCOS **exclus**.

## 30. Commit / push

Push normal `main` uniquement. Aucun force push. Voir living handover après commit.

## 31. Verdict

**`I2V_FIRST_PAID_SINGLE_EXECUTION_PRIVATE_HUMAN_REVIEW_PENDING`**

Une vidéo privée de 5 s a été produite, ingérée, QC technique partiel, et attend une revue humaine. L’asset reste inactif. L’Auth payante est **consommée**.

## 32. Prochaine porte (non exécutée)

**`AUTH_11B_I2V_PRIVATE_PREVIEW_AND_HUMAN_DECISION`**

Uniquement : preview privée + décision humaine APPROVE ou REJECT.  
**Interdit** : second submit · activation automatique · publish · merge · export · voice · lipsync · downstream · nouvelle génération.

---

## Interdictions respectées

Un seul submit · flags refermés · output inactif · source inactive · 0 décision HR · 0 activation · AICCOS intacts · 0 force push · 0 déploiement manuel.
