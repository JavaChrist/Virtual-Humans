# 128 — Phase 11A Close and Next Media Roadmap Audit

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_CLOSE_AND_NEXT_MEDIA_ROADMAP_AUDIT`  
**Nature :** clôture documentaire · lecture seule Production · **0** provider · **0** écriture métier  
**Source applicative image :** `d395ec7` · runtime Production image **`245bea2`**  
**HEAD au départ :** `3641c79` (`127_`)

```text
VERDICT = PHASE_11A_CLOSED_NEXT_MEDIA_GATE_DEFINED
PHASE_11A = PASS_WITH_NOTES
NEXT_AUTH = AUTH_11B_IMAGE_TO_VIDEO_PRODUCTION_WIRING_PREFLIGHT
ACTIVATION = NOT_NEXT · NOT_REQUIRED_FOR_I2V_PREP
PROVIDER_CALLS = 0
PRODUCTION_WRITES = 0
LEDGER = 274/249/0/25
PHASE_11A_COST = 2¢ provisional
RUNTIME_PAID_MEDIA = OFF
```

---

## A. Clôture Phase 11A

### A1. Chaîne réellement exercée

| Étape | Statut | Preuve |
|---|---|---|
| Marketing → Storyboard | **réel** (hors 11A, réutilisé) | 10B–10F |
| ScenePackageSet no-text | **réel** persisté | `2e8e9e6f…` rev.2 · `113_`/`115_` |
| GenerationPlan single-step image | **réel** persisté | `a55bd426…` rev.2 · `115_` |
| Router plan complet `text_motion` | **hors scope 11A** | bypass `phase-11a-single-step-plan` |
| Run / job image | **réel** | run `39329a01…` · job `edc6e84a…` · 2 jobs completed |
| OpenAI Image `gpt-image-1` | **réel ×2** | `108_` smoke + `115_` no-text |
| Storage privé PNG | **réel** | bucket `director-final-assets` · 5 objets |
| QC technique image | **réel** | MIME/dims/checksum/PNG |
| Composition déterministe | **réel local/admin** | 1.0.0 / 1.1.0 / 1.2.0 · **pas** le worker overlay runtime |
| QC typographique | **réel local** | 1.2.0 PASS · OCR `unavailable_humanOnly` |
| Human Review image | **réel** | 3 REJECT + 1 APPROVE |
| Activation | **non exercée** | `active=false` conservé |
| Merge / export | **non exercée** (fake Phase 9 seulement) | `mergeExportAuthorized=false` |
| I2V / T2V / voice / lipsync | **non exercés** sur `/director` | fakes Phase 9 |
| Motion Transfer | **hors scope 11A** | MV-001 benchmark séparé |

### A2. Résultat final

| Critère | Verdict |
|---|---|
| Provider no-text | **PASS** |
| Adapter OpenAI Image réel | **PASS** (exception VHS-124 bornée, **OFF**) |
| Job / ledger / idempotence | **PASS** |
| Storage privé | **PASS** |
| QC technique | **PASS** |
| Overlay 1.2.0 | **PASS** |
| Human Review | **APPROVE** `fb2f886c…` |
| Asset final | privé · `approved` · `active=false` |
| Activation | **non autorisée** |
| Merge / export | **non autorisé** |
| Provider Image général Production | **NON** — PASS 11A ≠ enablement |

### A3. Matrice des cinq assets (redacted, live 2026-08-14)

| Asset | Rôle | Lifecycle | Active | Décision | Coût | Réutilisabilité | Statut final |
|---|---|---|---|---|---|---|---|
| `5d68ef64…` | smoke texte provider | `rejected` | false | `93f02155…` REJECT | 1¢ | **non** (faux texte) | historique |
| `7832765d…` | parent no-text | `pending_review` | false | aucune | 1¢ | fond visuel seulement | conservé |
| `6a2beca9…` | composé 1.0.0 | `rejected` | false | `f1fcb832…` glyphes | 0¢ | **non** | historique |
| `4429654f…` | composé 1.1.0 | `rejected` | false | `058faa7d…` layout | 0¢ | **non** | historique |
| `49284892…` | composé 1.2.0 | `approved` | false | `fb2f886c…` APPROVE | 0¢ | **oui** comme source explicite | canon 11A inactif |

Checksum 1.2.0 : `9ac484b7…` · composeur `phase-11a-vector-compositor-1.2.0` · font `vhs-overlay-latin-vector-v1` · layout/panel `1.2.0`.

### A4. Coûts Phase 11A

Preuves uniquement (`108_`/`109_`/`115_`/`127_`). Aucun montant inventé.

| Poste | Montant | Nature |
|---|---|---|
| OpenAI Image smoke `108_` | **1¢** | réserve puis commit **provisional** (`109_`) |
| OpenAI Image no-text `115_` | **1¢** | réserve puis commit **provisional** |
| Compositions 1.0.0 / 1.1.0 / 1.2.0 | **0¢** | local / admin · 0 provider |
| HR / preview / QC | **0¢** | pas de provider |
| **Total Phase 11A** | **2¢ provisional** | 2 appels · 0 3ᵉ |
| Réservations actives | **0** | |
| Ledger live | hard **274** / committed **249** / reserved **0** / available **25** | 247 historiques + 2 image |

Différence technique vs itérations : les corrections overlay (glyphes, layout, vectoriel) ont coûté **0¢** provider. Le coût 11A est uniquement les deux stills.  
Motion MV-001 **135¢** est **hors** Phase 11A.

### A5. Anomalies et dettes (aucune correction cette phase)

| Point | Classe |
|---|---|
| Asset APPROVE mais `active=false` | **comportement attendu** |
| Delivery `merge_ready` + `mergeExportAuthorized=false` | **comportement attendu** (réemploi contrat, pas un merge) |
| Parent `pending_review` | **comportement attendu** · dette non bloquante |
| Assets REJECT privés conservés | **comportement attendu** · P1 rétention/suppression future |
| Compteur OpenAI Image = 2 | **attendu** |
| Run/job `completed` · waitingReason clos | **attendu** |
| Idempotence process/fresh-process HR | **prouvé** `127_` |
| OCR réel absent (`humanOnly`) | **dette non bloquante** |
| Monitoring / traces distribuées | **P1** (VHS-005) |
| UX Human Review `/director` image | **dette non bloquante** (décisions via scripts admin) |
| Activation produit | **P1** — pas P0 · pas requise pour I2V prep |
| Composeur via scripts admin, pas worker overlay | **dette non bloquante** · overlay runtime `UNAVAILABLE` |
| `17_` / `19_` stale | **dette non bloquante** |
| `06_ROADMAP_V2.md` théorique stale | **dette non bloquante** (corrigé cette phase) |

**P0 ouverts :** pas de 3ᵉ OpenAI Image · ne pas activer les 5 assets · ne pas lire/écrire un média Production sans Auth · ne pas promouvoir un commit docs comme runtime `245bea2`.

### A6. Verdict 11A

**`PHASE_11A = PASS_WITH_NOTES`**

La portée 11A (premier still `/director` réel, no-text, overlay déterministe, HR) est close.  
Les notes sont les dettes ci-dessus : pas d’activation, pas de merge réel, parent non décidé, overlay hors worker, OCR absent.  
Ce PASS **n’autorise pas** l’ouverture générale d’OpenAI Image ni de Paid Media.

---

## B. Capacités média suivantes

Légende : **D** domaine · **R** Registry · **Rt** Router · **GE** Generation Engine · **Ad** adapter réel · **W** worker/poll · **S** Storage ingest `/director` · **QC** · **HR** · **L** ledger · **I** idempotence · **UI** · **F** flags · **Tf** tests fake · **Vr** validation réelle `/director`.

| Capacité | D | R | Rt | GE | Ad | W | S | QC | HR | L | I | UI | F | Tf | Vr | Candidat | Mode | Coût doc. | Dépendances | Risques | Blocages | Mig. | Auth |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Activation image | provenance `active` | n/a | n/a | n/a | n/a | n/a | n/a | n/a | distincte | 0 | oui | non | aucun | unit 11A | **non** | — | sync write | 0¢ | APPROVE fait | sémantique `active` | Auth dédiée | non | oui si on l’ouvre |
| I2V | `video.image_to_video` | fake/E2E | stratégies oui | canon + fal wrapper | `createFalAdapter` **non branché** `/director` | poll fal **non prouvé** `/director` | image oui · **vidéo non** | domaine durée/source | Motion ≠ I2V | catalogue | clé step | legacy `/video` | Paid Media OFF | oui | **non** | Kling I2V / Runway | async | Kling 0,28 $/s · Runway 0,05 $/s (`pricing.ts`) | still approuvé + wiring | orphelin async · budget | VHS-124 fakes-only | possible | **oui — prochaine** |
| T2V | `video.text_to_video` | fake/E2E | oui | idem | fal T2V **non branché** | idem | non | domaine | non | catalogue | clé step | legacy | OFF | oui | **non** | Hailuo 30¢ / 6 s (`58_`) · Kling T2V | async | Hailuo 30¢ · Kling 0,28 $/s | moins logique après still | ignore l’APPROVE 11A | wiring + budget | possible | plus tard |
| Voice/TTS | `audio` / voice | fake/E2E | oui | adapter EL | `eleven_multilingual_v2` **legacy** | sync | dataUrl legacy | domaine audio | non `/director` | ~2¢ court (`58_`) | partielle | `/voice` | OFF | oui | **non** `/director` | ElevenLabs | sync | 0,15 $/1k chars | script 10D | faible preuve visuelle | wiring `/director` | non | plus tard |
| Lipsync | `audio.lipsync` | fake/E2E | oui | fal lipsync | veed / sync-v3 **non branché** | async | non | domaine | non | 0,4–8 $/min | clé step | `/lipsync` | OFF | oui | **non** | fal | async | catalogue | I2V + TTS | chaîne longue | 3 hop manquants | non | plus tard |
| Merge | PostProduction | n/a | n/a | fake-merge | **fake only** VHS-125 | n/a | fake-merge/ | assertExport | domaine | 0 | oui fake | `/director` delivery | local/E2E | oui | **fake only** | — | sync fake | 0¢ | assets vidéo réels absents | faux PASS | pas d’asset vidéo | non | plus tard |
| Export | ExportPackage | n/a | n/a | download/aiccos | gated | n/a | non réel | assertExport | requis si needs_review | 0 | oui | delivery | local | oui | **fake only** | — | sync | 0¢ | merge réel | AICCOS dirty hors scope | pas de final réel | non | plus tard |
| QC vidéo/audio | `quality.ts` | n/a | n/a | consumer image prouvé | n/a | n/a | n/a | source/durée/kind | humanOnly | 0 | oui | quality | — | unit | **image seulement** | — | sync | 0¢ | ingest vidéo | faux accept | pas de média vidéo | non | avec I2V |
| HR vidéo `/director` | MT-005 + image 11A | n/a | n/a | RPC existante | n/a | n/a | n/a | n/a | image + Motion | 0 | oui | Motion UI | — | oui | **pas I2V** | — | sync | 0¢ | QC vidéo | confusion Motion | contrat I2V | non | avec I2V |
| Motion Transfer | `video.motion_transfer` | **DISABLED** | séparé | fal Kling MC | validé **benchmark** | WIRED puis OFF | privé MV-001 | QC Motion | APPROVE `97_` | 135¢ | oui | Motion | tous OFF | oui | **benchmark only** | Kling MC | async | 135¢ fait | Privacy Pack limité | généraliser un bench | Registry OFF | non | **ne pas** depuis 11A |

Références code : `fal-adapter.ts` · `elevenlabs-voice-adapter.ts` · `vhs124-openai-image-exception.ts` · `director-server.ts` (`assertDirectorProductionUsesFakes`) · `resolveInputsFromRun` · `fake-merge-engine.ts` · `lib/pricing.ts`.

---

## C. Dépendances jusqu’à une vidéo exportable

### Chemins évalués

**Chemin 1 — Image → vidéo complète :** activation? → I2V → QC → HR → voix → lipsync → merge → export.  
Valeur produit max · **risque max** · 5+ hop non prouvés.

**Chemin 2 — Voix d’abord :** script → TTS → QC → HR → I2V/T2V → lipsync → merge → export.  
N’utilise pas le still APPROVE · TTS `/director` non câblé.

**Chemin 3 — Vidéo muette de validation :** still APPROVE (inactif OK) → I2V → QC → HR → export muet.  
**Minimal** · réutilise 11A · 1 provider vidéo · pas de TTS/lipsync.

**Chemin 4 — Motion coaching :** MV-001 déjà validé · Registry OFF · **ne pas** substituer au pipeline générique.

### Chemin retenu

**Chemin 3 puis, plus tard, voix/lipsync/merge réel (Chemin 1 allégé).**

Ordre minimal :

1. Wiring I2V `/director` (cette reco) — 0¢.
2. Preflight I2V (source explicite `49284892…`, estimate, réserve, poll, ingest).
3. Smoke I2V borné **après** wiring + budget.
4. QC + HR vidéo.
5. TTS `/director` (script 10D déjà PASS).
6. Lipsync éventuel.
7. Merge/export **réels** (le fake Phase 9 n’est pas une preuve).

---

## D. Comparaison A–E

| Option | Utilité maintenant | Provider | Wiring `/director` | Budget 25¢ | Reco |
|---|---|---|---|---|---|
| **A — Activer `49284892…`** | faible | 0 | n/a | 0¢ | **attendre** — voir F |
| **B — Premier TTS réel** | audio seul | ElevenLabs | **non** (legacy `/voice`) | ~2¢ OK | après I2V muet |
| **C — Premier I2V réel** | haute | fal | **non** | Kling 5 s ≈ 140¢ **shortfall** · Runway 5 s ≈ 25¢ sans marge de réserve | **pas encore** — wiring d’abord |
| **D — Premier T2V réel** | moyenne | fal | **non** | Hailuo 30¢ **shortfall 5** | moins logique : jette le still APPROVE |
| **E — Merge/export sans provider** | nulle en réel | 0 | fake only | 0¢ | **interdit comme PASS** — pas d’asset vidéo |

---

## E. Recommandation

**Prochaine phase unique :** `AUTH_11B_IMAGE_TO_VIDEO_PRODUCTION_WIRING_PREFLIGHT`

| | |
|---|---|
| Objectif | Inventorier et préparer le câblage Production I2V (plan, input asset explicite, exception bornée analogue à VHS-124, Storage vidéo, poll, QC, HR, ledger) **sans** appeler fal |
| Pourquoi maintenant | Still 11A APPROVE réutilisable · I2V est le plus petit incrément vers une vidéo · le chemin `/director` est encore **fakes-only** hors image |
| Pourquoi pas A–E payant | Activation inutile au prep · TTS/T2V/merge n’avancent pas la preuve vidéo · I2V payant interdit tant que wiring/Storage/QC/HR/worker vidéo ne sont pas préflightés |
| Provider | **aucun** cette phase |
| Coût / réserve / shortfall | **0 / 0 / 0** · available **25¢** inchangé |
| Max appels / jobs / assets | **0 / 0 / 0** |
| Retry / fallback | **0 / 0** |
| Flags | **aucun changement** · Paid Media OFF |
| Préconditions | `127_` poussé · asset `49284892…` `approved` `active=false` · 0 réservation |
| P0 | 0 fal · 0 activation · 0 3ᵉ OpenAI · 0 merge |
| P1 | documenter le trou `existing_asset` / `step_output` · estimate I2V vs 25¢ |

`resolveInputsFromRun` ne résout que des `step_output` du **même** run. Il n’existe pas de ref `existing_asset`. L’I2V ne peut donc pas « ramasser » automatiquement `49284892…` via `active=true`. Le wiring devra ajouter une référence **explicite** à l’asset approuvé inactif.

---

## F. Activation de l’image

**Décision :** ne pas activer maintenant · **ne pas** en faire la prochaine phase · **inutile** pour un I2V qui référence explicitement un asset `approved` inactif.

Fondements :

- `assets.status=approved` = lifecycle HR.
- `provenance.active` = drapeau de publication, pas un prérequis de génération.
- `active_artifact_revisions` concerne les artifacts **texte**, pas les PNG média.
- `resolveInputsFromRun` ignore `active`.
- Fliper `active=true` changerait la sémantique « livrable publié » et risquerait un merge/export mal compris alors que `mergeExportAuthorized=false`.

Une Auth d’activation distincte ne sera justifiée que si le produit a besoin d’un pointeur canonique publié, indépendamment de l’I2V.

---

## Contrôles cette phase

Lecture living handover · fraîcheur · liens index · secret scan.  
Baseline unitaire **1628/1628** (`127_`) — **non relancée** (docs only).  
Typecheck / lint / build : **N/A** (aucun code exécutable ajouté hors assertion `nextPhase` du test de fraîcheur).

Provider calls = **0**. Production writes = **0**.

---

## Prochaine autorisation exacte (ne pas exécuter ici)

```text
AUTH_11B_IMAGE_TO_VIDEO_PRODUCTION_WIRING_PREFLIGHT
Portée : lecture + conception/câblage documenté I2V /director
Interdit : fal · OpenAI · ElevenLabs · activation · merge · export · flags ON · ledger write
Attendu : gaps listés · contrat existing_asset · estimate/réserve · STOP READY_FOR_11B_I2V_WIRING ou équivalent
```

**Prochaine porte :** `AUTH_11B_IMAGE_TO_VIDEO_PRODUCTION_WIRING_PREFLIGHT`
