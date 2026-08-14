# 135 — Phase 11B Close and Next Media Gate Audit

**Date :** 2026-08-15  
**Auth :** `AUTH_11B_CLOSE_AND_NEXT_MEDIA_GATE_AUDIT`  
**Nature :** clôture documentaire · lecture seule Production · **0** provider · **0** média · **0** écriture métier  
**HEAD au départ :** `b6f1712` (`134_`)

```text
VERDICT = PHASE_11B_CLOSED_PASS_WITH_NOTES
PHASE_COST = 0¢
PROVIDER_CALLS = 0
SIGNED_URL_COUNT = 0
MEDIA_READS = 0
PRODUCTION_WRITES = 0
BUDGET_WRITES = 0
FLAGS_WRITTEN = 0
HARD = 437
COMMITTED = 389
RESERVED = 0
AVAILABLE = 48
VIDEO_LIFECYCLE = approved
VIDEO_ACTIVE = false
VIDEO_PUBLISHED = false
ATTEMPT_DEBT = P1
ARTIFACT_POINTER_DEBT = P1
RESUBMIT_POSSIBLE = false
NEXT_AUTH = AUTH_11B_I2V_ATTEMPT_TERMINAL_STATE_HARDENING
FOLLOW_ON = AUTH_11C_VOICE_TTS_PRODUCTION_WIRING_PREFLIGHT
```

---

## 1. Autorisation consommée

`AUTH_11B_CLOSE_AND_NEXT_MEDIA_GATE_AUDIT` — Christian, chat courant.

Cette Auth n’autorise aucune correction Production, activation, publication, export, génération, décision Human Review, ni correction de l’attempt.

## 2. Git et working tree

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main initiaux | `b6f1712` |
| ahead / behind | **0 / 0** |
| Hors scope | AICCOS protégés · ni modifiés, ni restorés, ni stashés, ni stagés |
| Preview locale | `studio/.tmp/phase-11b-i2v-9be6cb0c-private-preview.mp4` gitignorée · **non supprimée** · **hors Git** |

## 3. Chaîne 11B complète

| # | Élément | Classification | Preuve |
|---|---|---|---|
| 1 | Contrat `ExistingMediaAssetReference` | **PASS_SYNTHETIC** puis **PASS_REAL** à l’exécution | `129_` contrat · `133_` source `49284892…` |
| 2 | Référence image approuvée inactive | **PASS_REAL** | `130_`–`134_` · `active=false` conservé |
| 3 | Registry / Router I2V | **PASS_WITH_NOTE** | capability existante · HTTP **WIRED_DISABLED** · smoke hors `/director` HTTP |
| 4 | GenerationPlan single-step | **PASS_REAL** persisté | rev **3** `3d1858eb…` schema `phase-11b-i2v-paid-1.0.0` · **non actif** |
| 5 | Budget et réservation | **PASS_REAL** | réserve `451bdeb3…` 168¢ · committed · release 28¢ |
| 6 | Ouverture / fermeture flags | **PASS_REAL** | `133_` `finally` · 7 flags 11B remis à `0` |
| 7 | Signed URL call-time | **PASS_REAL** ×1 dans `133_` | TTL 60 s · mémoire seulement · **cette phase 0** |
| 8 | Submit fal unique | **PASS_REAL** | `FAL_SUBMITS=1` · `01a0025d…` |
| 9 | Polling sans resubmit | **PASS_REAL** | 34 polls · 0 second submit |
| 10 | Ingest privé | **PASS_REAL** | bucket `director-final-assets` · 1 MP4 |
| 11 | QC technique | **PASS_WITH_NOTE** | MIME/taille/checksum/provenance PASS · probe **UNAVAILABLE** |
| 12 | QC visuel | **UNAVAILABLE** (`humanOnly`) | pas d’auto-approve |
| 13 | Human Review | **PASS_REAL** | 1 APPROVE `301ee080…` · append-only · replay idempotent |
| 14 | Lifecycle final | **PASS_REAL** | `approved` |
| 15 | Activation | **DEFERRED** | `active=false` · APPROVE ≠ activation |
| 16 | Downstream | **DEFERRED** | flag OFF · `mergeExportAuthorized=false` |
| 17 | Idempotence | **PASS_REAL** | clé unique · replay HR `existing` · job `submitCount=1` |
| 18 | Coût | **PASS_WITH_NOTE** | 140¢ **provisional** · pas de facture provider |
| 19 | Runtime final | **PASS_REAL** | Paid Media **OFF** |
| 20 | Tests | **PASS_REAL** | 129–134 ciblés + suites unitaires de clôture |

Ne pas présenter le wiring `129_` (fakes) comme preuve d’exécution réelle. L’exécution réelle est `133_`.

## 4. Appels et coût total 11B

| Poste | Valeur |
|---|---|
| fal submits | **1** (`133_`) |
| OpenAI / ElevenLabs 11B | **0** |
| Coût I2V | **140¢ provisional** |
| Hard-limit write | **1** (`131_` · 274→437) · pas une dépense |
| Cette phase | **0¢** · `PROVIDER_CALLS=0` |

## 5. Asset source image

| Champ | Live (redacted) |
|---|---|
| id | `49284892…` |
| lifecycle | `approved` |
| active / published | `false` / `false` |
| MIME / kind | `image/png` · image · `internal` |
| checksum prefix | `9ac484b7…` inchangé |
| bucket | `director-final-assets` |
| Mutation 11B inattendue | **aucune** |

## 6. Asset vidéo final

| Champ | Live (redacted) |
|---|---|
| id | `9be6cb0c-45ee-40f6-b433-02b62d81a283` |
| lifecycle | `approved` |
| active / published | `false` / `false` |
| checksum | `e929f00a5625d37f6b3f390b66193d4b8a60fecaf5a0bf36c6f2fb89ce00195f` |
| MIME / taille | `video/mp4` · 1 629 267 |
| bucket | `director-final-assets` privé |
| parent | `49284892-d6ba-5249-b645-4f55084361cc` |
| rôle | `i2v_output_video` |
| Assets I2V | **1** |

## 7. Human Review

| Champ | Live |
|---|---|
| Décisions I2V | **1** |
| decisionId | `301ee080…` |
| decision | `approved` |
| issue code | `human.i2v_visual_approved` |
| REJECT concurrent | **0** |
| Append-only / overwrite | respecté (`134_`) |

## 8. Budget

| | ¢ |
|---|---|
| hard | **437** |
| committed | **389** |
| reserved actif | **0** |
| available | **48** |
| réserve `451bdeb3…` | status **`committed`** · montant 168 |
| ledger I2V | reserved 168 · provisional **140** · released **28** |
| réservations actives | **0** |
| reconciliation artificielle | **aucune** |

Settlement I2V reste **provisional 140¢**. Aucune écriture budget cette phase.

## 9. Flags

Tous **OFF** par dernière preuve `133_` `finally` + `134_` `FLAGS_WRITTEN=0` + cette phase `FLAGS_WRITTEN=0`.  
Paid Media · VHS11B (7) · VHS124 · Motion · downstream. Aucune lecture secrète Vercel.

## 10. Run / job / attempt

| Champ | Live |
|---|---|
| run I2V | **1** `4c5b53a5…` · `completed` · `waitingReason` **clos** |
| job I2V | **1** `2e43152b…` · `completed` · `submitCount=1` · `01a0025d…` |
| attempt | `6be95728…` · **`started`** · `completed_at=null` · `kind=primary` · n=1 |
| Autres run/job I2V | **0** |
| Attempts workspace | `started=1` · `completed=1` · seule `started` = I2V |

## 11. Analyse causale de l’attempt `started`

Cause : **omission du script d’exécution** `studio/scripts/phase-11b-i2v-first-paid-single-execution.mjs`.

Séquence réelle :

1. insert attempt `status=started` ;
2. après submit, update `external_job_id` **en gardant** `status=started` ;
3. run/job passés `completed` + settlement 140¢ ;
4. **aucune** transition terminale `completed` / `failed` ni `completed_at`.

Ce n’est **pas** :

- le worker `/director` (chemin HTTP non exercé) ;
- l’adapter fal (polling a reçu `COMPLETED`) ;
- le RPC de settlement (réserve committed, ledger 140/28).

Contraste : le script Motion `mt013m-mv001-final-paid-single-execution.ts` termine l’attempt (`completed` + `completed_at`). L’unique attempt `started` du workspace est celle-ci.

Statut contractuel attendu après job `completed` + ingest + HR seed : **`completed`** (terminale), `completed_at` posé, `retryable` false.

## 12. Risque de resubmit

**Démontré impossible** avec le code et l’état actuels :

- job `completed` + `external_job_id` posé + `submitCount=1` — le script `133_` refuse un second submit ;
- `idempotency_key` unique en base ;
- `claim_production_jobs` ne revendique que `queued` / lease expiré — pas un job `completed` ;
- aucun consumer applicatif ne scanne `generation_attempts.status='started'` pour resoumettre ;
- flags 11B / worker / Paid Media **OFF** ;
- Auth payante **consommée**.

Donc **pas P0**. Un PASS_WITH_NOTES reste admissible.

## 13. Impact recovery / métriques

P1 significative :

- tout scan « attempts non terminales » flagge cette ligne unique ;
- un opérateur peut croire le job encore vivant ;
- un futur recovery mal borné pourrait la traiter comme in-progress ;
- `cost_status` attempt reste null alors que le ledger est soldé.

Transition terminale correcte : `started` → `completed`, `completed_at` maintenant, `retryable=false`, sans toucher run/job/asset/ledger.

Correction live = **écriture Production séparément autorisée**. Cette phase ne la fait pas.

Test manquant : assert « job/run `completed` ⇒ attempt terminale » dans le script / contrat 11B.

## 14. Pointeurs QR / PR / GenerationPlan

`active_artifact_revisions` est **par projet + type** (un actif par type).

| Type | Actif | Rev | Note |
|---|---|---|---|
| `quality_report` | `0da85052…` | **5** | I2V · visuel `unavailable_humanOnly` |
| `production_result` | `fa5c42bd…` | **10** | I2V · `delivery=merge_ready` · `mergeExportAuthorized=false` · `outputActive=false` |
| `generation_plan` | `a55bd426…` | **2** | **11A** image |
| GP I2V | `3d1858eb…` | **3** | persisté · **volontairement non actif** |

Cohérence : QR/PR I2V + GP 11A = ensemble **mixte**.  
`/director` Production charge le GP **11A** (image). Quality/review charge le QR **I2V**. Merge prepare teste `delivery.status===merge_ready` (pas `mergeExportAuthorized`) — risque UI, pas d’exécution réelle (merge engine / flags OFF).  
L’image 11A reste accessible par id d’artifact, plus comme pointeur actif.  
Activation vidéo **non nécessaire** et **dangereuse** (publication / downstream implicite).

Dette : **P1** bornée. Porte corrective séparée après hardening attempt. **Aucun pointeur muté ici.**

## 15. Dettes P0 / P1 / P2

| Dette | Sévérité | Porte |
|---|---|---|
| Attempt I2V `started` | **P1** | `AUTH_11B_I2V_ATTEMPT_TERMINAL_STATE_HARDENING` |
| Pointeurs QR/PR I2V + GP 11A | **P1** | porte artifacts distincte plus tard |
| `delivery=merge_ready` sans merge autorisé | **P1** | ne pas ouvrir merge ; durcir le guard plus tard |
| Probe vidéo / QC visuel machine | **P2** / UNAVAILABLE | humanOnly accepté |
| Settlement provisional 140¢ | **P2** | attendre facture provider |
| Voice / lipsync / merge / activation | **DEFERRED** | portes distinctes |

**P0 ouverts inchangés :** pas de 3ᵉ OpenAI · ne pas activer les 6 assets · 0 second submit fal.

## 16. Verdict final 11B

**`PHASE_11B_CLOSED_PASS_WITH_NOTES`**

| Critère | Verdict |
|---|---|
| Wiring I2V | PASS_WITH_NOTE · WIRED_DISABLED HTTP |
| Preflight live | PASS_REAL `130_`/`132_` |
| Budget | PASS_REAL · 437 / 389 / 0 / 48 |
| Exécution réelle | PASS_REAL · 1 fal |
| Coût | PASS_WITH_NOTE · provisional 140¢ |
| Durabilité | PASS_REAL · Storage privé inchangé |
| Sécurité média | PASS_REAL · 0 URL persistée · bucket privé |
| QC | PASS_WITH_NOTE · technique partiel · visuel humanOnly |
| Human Review | PASS_REAL APPROVE inactif |
| Activation | non exercée · correct |
| Export | non exercé · preview ≠ export |
| Observabilité | PASS_WITH_NOTE · attempt fausse l’état ops |
| Dette attempt | P1 · resubmit impossible |
| Cohérence artifacts | P1 bornée · 0 write |

## 17. Comparaison A–F

### A — Activation / publication

Inutile maintenant. `active=true` changerait la sémantique produit et pourrait exposer un livrable. APPROVE ≠ activation. **Non recommandé.**

### B — Export privé de validation

La preview locale gitignorée a déjà permis la décision. Un export Production exigerait un contrat, une traçabilité et des guards distincts. Un téléchargement n’est pas un export. **Reporter.**

### C — Voice / TTS `/director`

Script Director **PASS_REAL**. Adapter ElevenLabs **PREPARED** (legacy + `elevenlabs-voice-adapter`, sortie dataUrl). Pas de chemin `/director` Voice câblé comme 11B. Storage audio non prouvé. Catalogue ~0,15 USD / 1k car. · available 48¢ théoriquement suffisant — **aucun budget créé ici**. QC audio / HR / flags à concevoir. **Aucun lipsync automatique.** Prochaine capacité **après** hardening attempt.

### D — Lipsync

Dépend vidéo + audio. Non câblé `/director`. Coût et QC plus lourds. **Interdit avant Voice/TTS câblé.**

### E — Correction opérationnelle de l’attempt

P1 significative. D’abord code + tests (0 provider). Correction live ensuite, Auth distincte. **Choisie comme prochaine porte.**

### F — Maintien privé inactif

État sûr par défaut pendant E puis C. **Conservé.**

## 18. Prochaine capacité choisie

**E** — hardening de l’état terminal de l’attempt.  
Vidéo maintenue privée et inactive. Voice/TTS ensuite. Lipsync / merge / export / activation **non ouverts**.

## 19. Justification

Les faits confirment la préférence d’orientation : resubmit impossible (donc 11B peut clôturer), mais l’unique attempt `started` du workspace fausse l’intégrité ops. Motion a déjà le pattern terminal. Voice n’est pas bloqué par un P0, seulement séquencé après E.

## 20. Prochaine autorisation exacte

**`AUTH_11B_I2V_ATTEMPT_TERMINAL_STATE_HARDENING`**

Corriger d’abord le code et les tests, sans provider. Toute correction live exigera une Auth distincte.

Porte suivante probable, non ouverte : `AUTH_11C_VOICE_TTS_PRODUCTION_WIRING_PREFLIGHT`.

## 21. Tests réellement exécutés

| Check | Résultat |
|---|---|
| Ciblés close audit | **5/5** |
| Suite unitaire | **1682/1682** |
| Typecheck | **PASS** |
| Lint pertinent | **PASS** |
| Build | **PASS** |
| Fraîcheur | **PASS** · `nextPhase=AUTH_11B_I2V_ATTEMPT_TERMINAL_STATE_HARDENING` |
| Secret scan | **PASS** · 0 secret · 0 URL · 0 média |
| pgTAP / intégration / E2E | **N/A** · non relancés |

## 22. Production reads / writes

| Compteur | Valeur |
|---|---|
| Lectures métadonnées | SQL redacted assets / HR / budget / run / job / attempt / pointeurs / ledger |
| `PRODUCTION_WRITES` | **0** |
| `BUDGET_WRITES` | **0** |

## 23. Provider / media counters

`PROVIDER_CALLS=0` · `SIGNED_URL_COUNT=0` · `MEDIA_READS=0` · `RETRY=0` · `FALLBACK=0` · `DOWNSTREAM=0` · `MERGE_EXPORT=0`

## 24. Fichiers

- `studio/src/application/production/phase-11b-close-and-next-gate-audit.ts`
- `studio/src/application/production/__tests__/phase-11b-close-and-next-gate-audit.test.ts`
- ce rapport `135_`
- living handover + index / changelog / backlog / checklist / roadmap / Leo

AICCOS **exclus**. Preview MP4 **absente** de Git.

## 25. Commit / push

Push normal `main` uniquement si le périmètre est propre. Voir living handover après commit.
