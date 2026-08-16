# 153 — Phase 11C Voice/TTS First Paid Single Execution

**Date :** 2026-08-16  
**Auth :** `AUTH_11C_VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION`  
**Nature :** **une** exécution ElevenLabs payante unique · 1 réserve 2¢ · 1 run/job/attempt · 1 audio privé `pending_review`  
**HEAD au départ :** `933d4af` = `origin/main`

```text
VERDICT = VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION_PRIVATE_HUMAN_REVIEW_PENDING
AUTH_CONSUMED = true
HEAD_INITIAL = 933d4af
HEAD_FINAL = 72016ea
ORIGIN_MAIN = 933d4af
DEPLOYMENT_HOST = lf3o07217
DEPLOYMENT_ID = dpl_Bccd…
DEPLOYMENT_SHA = 933d4af
FLAGS_INITIAL = OFF
FLAGS_WINDOW = C
FLAGS_FINAL = OFF
NARRATOR = narrator_female
IDENTITY = bc1c8046…
CONSENT = 6fd84baf…
BINDING = e3a1cc87…
MODEL = eleven_multilingual_v2
FINGERPRINT = 2e86cee67f99…
IDEMPOTENCY_KEY = 2bb93f5ee9de…
ELEVENLABS_SUBMITS = 1
SUBMIT_COUNT = 1
PROVIDER_REQUEST_ID = LULrSTtd…
PROVIDER_STATUS = completed
RUN = 2eaffebf… completed
JOB = 428c7f48… completed
ATTEMPT = ea07475f… completed
OUTPUT = bc36bba7… pending_review
ASSET_BUCKET = director-final-assets
MIME = audio/mpeg
SIZE_BYTES = 80710
CHECKSUM = 2ca9ebbd98187dd64553dc1866cd21a3fc4b12ede97a4556a42f02258c33fdad
PROBE = unavailable
HUMAN_REVIEW_DECISION = none
OUTPUT_ACTIVE = false
OUTPUT_PUBLISHED = false
RESERVATION = ea8d89b6… committed 2¢
SETTLEMENT = provisional 2¢
LEDGER_BEFORE = 437 / 389 / 0 / 48
LEDGER_AFTER_RESERVE = 437 / 389 / 2 / 46
LEDGER_AFTER = 437 / 391 / 0 / 46
REPLAY_MAYSUBMIT = false
VIDEO_ACTIVE = false
VIDEO_PUBLISHED = false
VOICE_RUNTIME = OFF
VOICE_IDS_EXPOSED = false
NEXT_AUTH = AUTH_11C_VOICE_TTS_PRIVATE_PREVIEW_AND_HUMAN_DECISION
```

---

## 1. Autorisation consommée

Christian a autorisé **exactement une** exécution Voice/TTS payante pour le projet I2V actuel et `narrator_female`. Plafond **2¢**. Auth consommable une seule fois.

Autorisé et fait : 1 réservation 2¢ · 1 segment `voice_over` · 1 résolution call-time `narrator_female` · 1 submit ElevenLabs · 1 run · 1 job · 1 attempt · 1 output audio privé · fenêtre de flags C · fermeture `finally` · ingest privé · QC technique · settlement ≤ 2¢.

Interdit et non fait : second submit · retry · fallback · `narrator_male` · Mei · Tom · clonage · lipsync · fusion vidéo · activation · publication · downstream · export · mutation `active_for_provider_execution` · mutation binding/consent · autre segment/projet/provider · dépassement 2¢.

Le script refuse désormais tout resubmit (`PHASE_11C_VOICE_TTS_PAID_SCRIPT_AUTH_CONSUMED=true`).

## 2. Git

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main initiaux | `933d4af` |
| Commit de phase | `72016ea` |
| ahead / behind | **0 / 0** au départ |
| Hors scope | AICCOS + `page.tsx` protégés · non touchés · non stagés |

`studio/.env.local` ignoré. Aucun fichier audio local commité.

## 3. Working tree

Hors scope identifiés et protégés. Cette phase ne les a ni restaurés, ni stashés, ni stagés.

## 4. Déploiement Production

| Champ | Valeur |
|---|---|
| Alias Ready | `virtual-humans.vercel.app` → host `lf3o07217-…` (redacted) |
| Deployment id | `dpl_Bccd…` |
| État | **Ready** · target Production |
| Créé | 2026-08-16 01:50:27 Europe/Paris · auto-deploy ~8 min après `933d4af` |
| SHA inspecté | **`933d4af`** · **aucun** déploiement manuel |
| Ancêtres requis | wiring `770e844` · binding `abaec84` · preflight `46eda6f` |
| Wiring Voice/TTS | **présent** |
| Garde-fous | **présents** |

Condition 4 satisfaite. Pas de `BLOCKED_DEPLOYMENT_NOT_READY`.

## 5. Préconditions live (revalidées avant write)

Toutes passées **avant** réservation, flags et provider.

| Check | Résultat |
|---|---|
| Git `933d4af` = origin/main | PASS · 0/0 |
| Hors scope protégés | PASS |
| Migrations | **32/32** |
| Tables Voice | **4 / 4 / 1** · provider-active **0** |
| Binding `e3a1cc87…` | projet `984507af…` · identity `bc1c8046…` · narrator · voice_over · fr · prepared · `selected_by=christian` · script `349e2792…` rev.1 |
| Identity `bc1c8046…` | available · revocable · execution=false · locator `env:ELEVENLABS_NARRATOR_FEMALE_VOICE_ID` · prefix `99db51be34bc` |
| Consent `6fd84baf…` | authorized · `workspace_voice_over` · voice_over · revoked_at null |
| `narrator_male` | non sélectionné |
| Mei / Tom | non substitués |
| Script | `349e2792…` rev.1 · `segment-2` · 81 · hash `f228654f…` · texte non recopié |
| GenerationPlan I2V | `3d1858eb…` rev.3 · **non actif** |
| Vidéo `9be6cb0c…` | approved · privé · active=false · published=false |
| Fingerprint `2e86cee6…` | 0 run / 0 job / 0 attempt / 0 audio / 0 réserve Voice |
| Budget | **437 / 389 / 0 / 48** · cap 2¢ ≤ 48¢ |
| Flags VHS11C | **absents** (= OFF) avant ouverture |
| Paid Media / VHS11B / Motion | OFF |
| `ELEVENLABS_VOICE_ID` historique | présent en env, **jamais lu ni utilisé** |
| `VOICE_IDS_EXPOSED` | false |

## 6. Flags — contrat C

État initial : VHS11C absents · DIRECTOR_V2_WORKER / PAID_GENERATION / PAID_AI / VHS124 / VHS11B / Motion traités OFF.

Fenêtre ouverte uniquement :

1. `DIRECTOR_V2_WORKER_ENABLED`
2. `DIRECTOR_V2_PAID_GENERATION_ENABLED`
3. `VHS11C_VOICE_CAPABILITY_ENABLED`
4. `VHS11C_VOICE_PAID_ENABLED`
5. `VHS11C_VOICE_ELEVENLABS_ENABLED`
6. `VHS11C_ELEVENLABS_VOICE_DIRECTOR_EXCEPTION`
7. `VHS11C_VOICE_WORKER_ENABLED`

Toujours OFF : `VHS11C_VOICE_DOWNSTREAM_ENABLED` · `DIRECTOR_V2_PAID_AI_ENABLED` · VHS124 · VHS11B · Motion.

Fermeture inverse dans `finally` : **PASS**. `FLAGS_FINAL_STATE=OFF`. Aucun flag I2V/Motion/lipsync/merge/export ouvert inutilement.

## 7. Exécution unique

Ordre respecté : préconditions → réserve 2¢ → run/job/attempt → `submitCount=0` → flags ON → résolution call-time (texte + voiceId en mémoire) → **1** POST ElevenLabs `eleven_multilingual_v2` → `submitCount=1` atomique → 1 audio MPEG → ingest bucket privé → QC → attempt terminal **puis** job/run → settlement 2¢ provisional → flags OFF → replay lecture seule.

Aucun appel voices/user/quota/pricing. 0 retry. 0 fallback. 0 second submit.

| IDs (redacted) | Valeur |
|---|---|
| Réservation | `ea8d89b6-5239-5c74-8152-4298d4a0d9be` |
| Plan Voice rev.4 | `7bb3e30c-a734-58b5-ad73-c655aa1a0b29` |
| Run | `2eaffebf-a4e2-5ede-9353-e55366c1f077` |
| Job | `428c7f48-6ea3-5efa-beff-2a654d256ebd` |
| Attempt | `ea07475f-4ea2-55c3-9d9a-f5d52f823b25` |
| Output | `bc36bba7-c937-5e2e-88be-2d034e25a8aa` |
| Idempotency | `2bb93f5ee9ded1650d78aa76c6524c6449ffa8ceaff255faeba52cae4e6f4827` |
| Provider request | `LULrSTtd…` |

voiceId et texte Production résolus uniquement en mémoire. Jamais persistés dans run/job/attempt/asset/ledger. `job.payload.voiceId` = false.

## 8. Output audio et QC

| Champ | Valeur |
|---|---|
| MIME | `audio/mpeg` |
| Taille | 80710 |
| SHA-256 | `2ca9ebbd98187dd64553dc1866cd21a3fc4b12ede97a4556a42f02258c33fdad` |
| Magic | MPEG/ID3 accepté avant ingest |
| Bucket | `director-final-assets` (privé) |
| Path | workspace/projet/media/audio/voice/`bc36bba7…`.mp3 · pas d’URL |
| Lifecycle | `pending_review` |
| active / published | false / false |
| Parenté | projet `984507af…` · scene-2 · run `2eaffebf…` · job `428c7f48…` |
| Provenance | provider/modèle redacted · fingerprint prefix `99db51be34bc` · hash texte `f228654f…` |
| Probe | **unavailable** (ffprobe absent) · ingest non bloqué |
| QC technique | mime/size/checksum PASS · `needs_review` · `unavailable_humanOnly` · autoApprove=false |
| Human Review | **none** · aucune écoute prétendue |

## 9. Budget et settlement

Aucune preuve de coût ferme dans la réponse ElevenLabs. Settlement **provisional 2¢**, pas 0¢.

| Instant | hard | committed | reserved | available |
|---|---:|---:|---:|---:|
| Avant | 437 | 389 | 0 | 48 |
| Après réserve | 437 | 389 | 2 | 46 |
| Après settlement | 437 | 391 | 0 | 46 |

`PHASE_COST_MAX=2`. Reliquat 0 (cap conservateur).

## 10. Writes Production de l’unique exécution

Ne pas résumer `PRODUCTION_WRITES=1`. Mutations autorisées, toutes liées à cette exécution :

| Table / opération | Writes |
|---|---:|
| `project_artifacts` generation_plan rev.4 | 1 INSERT |
| `production_runs` | 1 INSERT + 1 UPDATE completed |
| `production_jobs` | 1 INSERT + 1 UPDATE submitCount + 1 UPDATE completed |
| `generation_attempts` | 1 INSERT + 1 UPDATE terminal |
| `budget_reservations` | 1 RPC reserve |
| `cost_ledger` | 1 RPC commit provisional 2¢ |
| Storage `director-final-assets` | 1 upload |
| `assets` audio | 1 INSERT |
| `voice_identities` / consents / bindings | **0** |
| Vidéo I2V | **0** |

## 11. Compteurs

```text
ELEVENLABS_SUBMITS=1
OTHER_PROVIDER_CALLS=0
VOICE_RUNS_CREATED=1
VOICE_JOBS_CREATED=1
VOICE_ATTEMPTS_CREATED=1
AUDIO_OUTPUTS_CREATED=1
RESERVATIONS_CREATED=1
SECOND_SUBMIT=0
RETRIES=0
FALLBACKS=0
SIGNED_URL_COUNT=0
INPUT_MEDIA_READS=0
AUDIO_INGESTS=1
OUTPUT_MEDIA_WRITES=1
HUMAN_REVIEW_DECISIONS=0
LIPSYNC_CALLS=0
DOWNSTREAM_CALLS=0
VOICE_IDENTITIES_UPDATED=0
VOICE_CONSENTS_UPDATED=0
PROJECT_BINDINGS_UPDATED=0
VIDEO_ACTIVE=false
VIDEO_PUBLISHED=false
OUTPUT_ACTIVE=false
OUTPUT_PUBLISHED=false
FLAGS_FINAL_STATE=OFF
PHASE_COST_MAX=2
```

Replay planner lecture seule : `existing` · `maySubmit=false` · `submitCount=1` · 0 réserve/run/job/attempt/output/provider supplémentaire. Le chemin provider réel n’a pas été rejoué.

## 12. Tests

Ciblés **avant** l’appel payant : 10/10 PASS (guards, cap 2¢, un submit, refus 2e submit, idempotence, timeout ambigu, flags `finally`, attempt terminal, output pending_review, redaction).

Après exécution : ciblés 10/10 · suite unitaire **1845/1845** · typecheck PASS · lint 0 error · build PASS · fraîcheur PASS · secret scan PASS · migrations-static 32/32. pgTAP / intégration DB / E2E : **N/A** (stack locale non relancée). **Aucun** relance ElevenLabs pour un test.

## 13. Hors scope

`studio/src/app/api/aiccos/send/route.ts` · `studio/src/components/send-to-aiccos.tsx` · `studio/src/app/page.tsx` intacts. `studio/.env.local` hors Git. Aucun MP3 local stagé.

## 14. Verdict

**`VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION_PRIVATE_HUMAN_REVIEW_PENDING`**

Auth consommée. Output privé vérifié. Flags OFF. Runtime Voice OFF.

## 15. Prochaine porte — non exécutée

**`AUTH_11C_VOICE_TTS_PRIVATE_PREVIEW_AND_HUMAN_DECISION`**

Autorisera une seule lecture privée de l’audio, sa restitution locale pour écoute humaine, et une décision explicite APPROVE ou REJECT. N’autorisera ni second submit, ni activation, ni lipsync, ni downstream.

STOP.
