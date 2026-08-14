# 129 — Phase 11B Image-to-Video Production Wiring Preflight

**Date :** 2026-08-14  
**Auth :** `AUTH_11B_IMAGE_TO_VIDEO_PRODUCTION_WIRING_PREFLIGHT`  
**Nature :** câblage Production I2V **WIRED_DISABLED** · fakes locaux · **0** fal · **0** média · **0** écriture métier  
**HEAD au départ :** `ca98f29` (`128_`)

```text
VERDICT = I2V_PRODUCTION_PATH_WIRED_DISABLED_READY_FOR_LIVE_PREFLIGHT
PROVIDER_CALLS = 0
SIGNED_URL_COUNT = 0
MEDIA_READS = 0
PRODUCTION_WRITES = 0
LEDGER = 274/249/0/25
PHASE_COST = 0¢
RUNTIME_PAID_MEDIA = OFF
NEXT_AUTH = AUTH_11B_I2V_LIVE_PREFLIGHT_NO_PROVIDER
```

---

## 1. Verdict

**`I2V_PRODUCTION_PATH_WIRED_DISABLED_READY_FOR_LIVE_PREFLIGHT`**

Le chemin canonique est câblé et prouvé avec fakes :

Asset image approuvé inactif → `ExistingMediaAssetReference` → `GenerationPlan` single-step → run/job (contrat) → worker async (fake) → wrapper fal Kling I2V → poll sans resubmit → ingest privé (contrat) → QC vidéo → Human Review (handoff local).

Le chemin reste **désactivé**. Aucun provider réel, aucune URL signée, aucune lecture média Production, aucune activation, aucune écriture DB/Storage.

## 2. Commit / push

Voir living handover après commit. Push normal `main` uniquement. Aucun force push. Aucun déploiement manuel.

## 3. Architecture réutilisée

| Composant | Statut | Preuve |
|---|---|---|
| Production Director | **étendu** | `resolveInputsFromRun` accepte `existing_asset` via `step.existingMediaAsset` |
| Generation Engine | **réutilisé** | `createGenerationEngine` + registry adapters |
| fal adapter / queue | **réutilisé** | `createFalAdapter` + `FalClientPort` existants |
| Pricing catalogue | **réutilisé** | `estimateVideo("fal-ai/kling-video/v2/master/image-to-video", 5)` |
| Capability `video.image_to_video` | **existante** | Router / requirements / strategy `image_to_video` |
| MediaAction `video` | **existante** | domaine cost / generation |
| Isolation Motion 11A | **réutilisée** | MV-002 DEFERRED · Registry Motion OFF |
| Storage privé `director-final-assets` | **chemin préparé** | aucun write |
| Human Review append-only | **handoff local** | 0 session Production |
| Overlay / OpenAI Image 11A | **inchangés** | 0 3ᵉ appel |

**Non créé :** seconde architecture média · capability inventée · transport fal dupliqué · SDK Runway natif.

## 4. Existing Asset Reference

Contrat versionné `existing-media-asset-reference-1.0.0` :

- `workspaceId` / `projectId` / `assetId`
- `expectedChecksum` / `expectedMimeType` / `expectedWidth` / `expectedHeight`
- `expectedLifecycle=approved` / `requiredHumanApproval=true`
- `sourceRole` / `sourceSceneId` / `sourceKind=internal`
- `expectedStoragePath` interne
- `activeAllowed=false`
- `provenanceFingerprint` déterministe
- `referenceVersion`
- `humanReviewDecisionId` optionnel

Aucune URL, aucun base64, aucun token. Objet `Object.freeze`. Pas d’UUID 11A dans le moteur générique — seulement dans les constantes de phase.

`GenerationInputRef.kind` étendu : `"existing_asset"`.  
`GenerationStep.existingMediaAsset?` porte le contrat.

## 5. Invariants de source

Autorisés uniquement si **tous** vrais :

- même workspace / même projet
- asset privé · `source_kind=internal`
- lifecycle `approved`
- checksum exact · MIME image · dimensions exactes
- Human Review APPROVE
- `active=false` **explicitement autorisé**
- path Storage interne au workspace/projet

Interdits : pending / rejected / stale / quarantined / public / URL / activation.

Source 11A (constantes de phase, **non lue**) :

- `49284892-d6ba-5249-b645-4f55084361cc`
- checksum `9ac484b7…`
- `composed_overlay_image` · `approved` · `active=false`
- scène `scene-2` · décision `fb2f886c…`

Cette phase n’a **ni lu ni signé** cet objet. L’asset reste inactif.

## 6. Action / capability

| Champ | Valeur |
|---|---|
| Capability | `video.image_to_video` (existante) |
| MediaAction | `video` (existante) |
| Strategy | `image_to_video` (existante) |
| `video.motion_transfer` | **interdit** |
| T2V | **interdit** |
| Motion fallback | **interdit** |

Aucune seconde capability inventée.

## 7. Provider / model recommandé

**fal Kling v2 Master I2V**  
`fal-ai/kling-video/v2/master/image-to-video` · durée minimale utile **5 s**.

Raisons (ordre Auth) :

1. adapter déjà présent (`createFalAdapter`)
2. transport réel existant (`FalClientPort` + `@fal-ai/client`)
3. pricing officiel fal **ferme** : 5 s = **$1.40** · +$0.28/s (llms.txt 2026-08-14)
4. polling queue déjà câblé
5. ingest privé préparé
6. coût bornable (5 s only)
7. 0 fallback
8. réutilise l’architecture actuelle

Profil Registry : **disabled** · `paidExecution=false` · `globallyEligible=false` · **non inséré** dans le snapshot Production. Exception bornée `VHS11B_FAL_I2V_DIRECTOR_EXCEPTION` expire `2026-09-30`.

**Non déclaré `SUPPORTED` globalement.**

## 8. Candidats rejetés / non retenus

| Candidat | Preuve | Décision |
|---|---|---|
| fal Runway `fal-ai/runway-gen3/turbo/image-to-video` | même transport fal présent · catalogue local $0.05/s · **pas** allowlisté | **candidat futur** — moins cher (≈25¢) mais shortfall réserve vs 25¢ ; Gen-3 Turbo **retiré côté Runway le 30 juillet 2026** ; pas de SDK Runway natif ; ne pas prétendre prêt |
| fal Kling T2V | adapter le supporte | **rejeté** capability mismatch |
| fal Motion Control | Registry Motion OFF · isolation 11A | **hors scope** |
| Seedance / Veo / Hailuo | présents dans le catalogue fal adapter | **non sélectionnés** — pas de preuve 11B suffisante |
| Legacy `/api/generate/video` | historique | **interdit** comme preuve Production |
| Fake universel | `supports()` = true | **interdit en Production** |

Aucun profil Production choisi sur hypothèse. Runway n’est **pas** `SUPPORTED`.

## 9. Registry / Router

- Allowlist provider/model **stricte** (pas de wildcard réel)
- Profil I2V **disabled** · modèle non éligible globalement
- Exception `VHS11B` bornée workspace/projet/scène/action/provider/model
- Estimate ferme avant toute future réservation
- Budget **compare-only** dans le dry-run (`budgetDecision.allowed=false` / `insufficient_funds`)
- Fallbacks vides · rejets expliqués (Runway `not_allowlisted`, T2V `capability_mismatch`)
- Fingerprint de plan déterministe
- Registry globale **non activée**
- Motion Registry **OFF inchangée**

## 10. GenerationPlan 11B

Construit **localement**, **non persisté**.

- projet Phase 11A `984507af…` · scène `scene-2`
- source `existing_asset` → `49284892…`
- action `video` · capability `video.image_to_video`
- allowlist unique Kling 5 s
- output vidéo unique
- max provider calls / jobs / assets output = 1
- fallbacks 0 · auto-retry 0
- downstream / lipsync / voice / merge / export / Motion = OFF
- Human Review obligatoire

## 11. Adapter / transport

Wrapper `createVhs11BAllowlistedFalI2vAdapter` autour de `createFalAdapter`.

- pas de duplication de transport
- pas de lecture de clé pendant les tests
- injection call-time `FalClientPort` obligatoire pour le chemin réel
- défaut Director = fakes (exception OFF)
- fake interdit en Production
- contract suite : Kling I2V oui · T2V non · Motion non · Runway non
- cancel provider fal : **non supporté** par l’adapter existant (documenté) ; cancel **typé** côté worker (late output → quarantined)

## 12. Media resolver

`resolvePhase11BExistingAssetToInternalInput` :

1. vérifie le contrat + facts
2. émet `access.kind=internal` seulement
3. refuse de signer sans `reserved + immediatelyBeforeSubmit + authorized`
4. TTL futur 60 s · host allowlist `*.supabase.co`
5. erreurs redacted
6. 0 persist d’URL

Cette phase : **signed URL count = 0** · **média lu = 0**.

Call-time futur (Auth payante, hors scope) : signer **après** réservation et **immédiatement** avant submit ; URL mémoire uniquement.

## 13. Worker / durabilité

Contrat local `phase-11b-i2v-worker` (fakes) :

- max 1 submit provider
- submit intent durable avant submit
- `providerJobId` persisté
- poll multi-invocation · fresh-process recovery
- poll **sans** resubmit
- `submission_unknown` **sans** resubmit
- `max_attempts` queue **distinct** du submit
- cancel typé · late output quarantined
- terminal idempotent · settle ledger **une fois**
- aucune chaîne voice/lipsync/merge

Le worker Production `run-once` existant n’est **pas** activé. Flag worker OFF.

## 14. Ingest

Chemin futur préparé, **0 write Storage** :

- fetch résultat allowlist/SSRF · https only · hosts privés rejetés
- MIME `video/mp4` \| `video/webm` · taille ≤ 80 MiB
- path `{ws}/{project}/media/video/i2v/{id}.mp4`
- bucket `director-final-assets`
- output `active=false` · provenance parent image → vidéo
- no overwrite · late/cancelled → quarantined

## 15. QC

| Volet | Statut |
|---|---|
| Technique (MIME/durée/dims/fps/taille/checksum/probe/provenance/estimate) | **câblé** (fake/local) |
| Probe décodabilité | `unavailable` si pas d’adapter réel |
| Visuel / mouvement | **`unavailable_humanOnly`** — aucun score inventé |
| Auto-approve | **interdit** |
| Human Review | **obligatoire** |

Critères visuels futurs (humain) : fidélité still · stabilité · artefacts · mouvement · continuité · caméra · overlay · durée · exploitabilité.

## 16. Human Review

Handoff local uniquement :

- asset vidéo privé · QC technique · visuel humanOnly
- APPROVE/REJECT · retry intents **sans** création automatique
- optimistic locking / append-only (contrats existants, non exercés)
- activation interdite sans Auth
- merge/export interdits
- **0 session HR Production créée**

## 17. Idempotence

- fingerprint référence déterministe
- fingerprint plan déterministe
- submit provider ≤ 1
- settle ledger 1×
- overwrite ingest interdit
- replay dry-run sans provider

## 18. Isolation Motion / T2V / legacy

Prouvé par tests :

- I2V ≠ Motion Transfer
- I2V ≠ T2V
- I2V ≠ legacy `/api/generate/image|video`
- source approved inactive autorisée
- pending/rejected interdits
- Motion Registry OFF inchangée
- MV-002 DEFERRED inchangé
- OpenAI Image non rappelé · 0 3ᵉ appel
- `49284892…` non activé
- assets rejetés non utilisés
- downstream OFF

## 19–20. Estimate / réservation / cap / budget / shortfall

Budget live **inchangé** : hard **274** / committed **249** / reserved **0** / available **25** ¢.  
Cette phase : **0¢** · 0 write ledger.

| Candidat | Estimate | Réserve 1.2× | Cap | Shortfall vs 25¢ | Hard min | Hard recommandé |
|---|---|---|---|---|---|---|
| fal Kling 5 s (retenu) | **140¢** | **168¢** | 168¢ | **143¢** | **417¢** (249+168) | **437¢** (+20) |
| fal Runway catalogue 5 s (non allowlisté) | 25¢ | 30¢ | — | 5¢ | — | — |

Kling : preuve officielle fal 2026-08-14 ($1.40 / 5 s).  
Runway : prix catalogue local seulement · **pas** de preuve officielle actuelle suffisante · **non retenu**.

`budgetDecision.allowed=false` / `insufficient_funds` — compare-only. Aucune réservation.

## 21. Flags OFF

Nouveaux gates, **tous OFF**, **aucune variable Vercel écrite** :

| Env | Rôle |
|---|---|
| `VHS11B_I2V_CAPABILITY_ENABLED` | capability I2V |
| `VHS11B_I2V_PAID_ENABLED` | paid execution |
| `VHS11B_I2V_FAL_ENABLED` | provider fal |
| `VHS11B_I2V_WORKER_ENABLED` | worker |
| `VHS11B_FAL_I2V_DIRECTOR_EXCEPTION` | exception benchmark bornée |
| `VHS11B_I2V_DOWNSTREAM_ENABLED` | downstream |

Flags Motion **séparés et OFF**. Merge/export restent OFF dans le code.

## 22–23. Provider calls / Production writes

**0** / **0**.

## 24. Tests

| Check | Résultat |
|---|---|
| Unitaires | **1650/1650** |
| Typecheck | PASS |
| Lint (fichiers de phase) | 0 error |
| Build | PASS |
| Secret scan (diff) | PASS |
| Fraîcheur living handover | PASS |

Couverture 11B : contrat Existing Asset · isolation workspace/projet · lifecycle/HR/checksum · Router/Registry · plan single-step · adapter contract · resolver sans URL · worker submit/poll/fresh-process/no-resubmit · ledger fake · ingest fake · QC · HR · idempotence · URLs hostiles/redaction · Motion/T2V/legacy · guards · flags OFF.

Fixtures **synthétiques** uniquement.

## 25. Documentation

- ce rapport `129_`
- living handover
- `00_README` · `BACKLOG_V2` · `CHANGELOG` · `CHECKLIST_RELEASE`
- architecture Production / Generation / Router / Registry / Storage / QC / HR
- glossaire

## 26. Living handover

Mis à jour **avant** le commit de clôture. `headStatus=pending commit` · `documentedHead=ca98f29` · `nextPhase=AUTH_11B_I2V_LIVE_PREFLIGHT_NO_PROVIDER`.

## 27. Prochaine autorisation exacte

**`AUTH_11B_I2V_LIVE_PREFLIGHT_NO_PROVIDER`**

Pourra déployer le wiring exact, vérifier l’asset source, les gates, le pricing, le budget et le dry-run live, puis tout refermer.

**Aucun appel I2V payant** avant ce preflight.  
**Aucun fal** dans cette porte suivante.

---

## Matrice déjà existant / réutilisé / ajouté

| Élément | Statut |
|---|---|
| Capability `video.image_to_video` · action `video` · strategy `image_to_video` | **déjà existant** |
| `createFalAdapter` + queue fal + `estimateVideo` | **réutilisé** |
| Isolation Motion / MV-002 / OpenAI 11A | **réutilisé** |
| `ExistingMediaAssetReference` + `existing_asset` | **ajouté** |
| Allowlist / flags / plan / resolver / worker / ingest / QC / HR 11B | **ajouté** · **WIRED_DISABLED** |
| Profil Registry Kling I2V | **ajouté** · disabled · non inséré Production |
| Wrapper `vhs11b-fal-i2v-exception` | **ajouté** · défaut fakes |
| Tests worker/ingest/QC/HR | **fake only** |
| Sign URL / fetch provider / write Storage / HR Production / réservation | **non implémenté** (préparé) |
| Appel fal / activation / flags Vercel / smoke payant | **non autorisé** |

---

## Audit providers I2V (synthèse)

| | fal Kling I2V | fal Runway Gen-3 Turbo | Autres fal I2V | Fake universel | Legacy generate |
|---|---|---|---|---|---|
| Provider/model | fal / `kling-video/v2/master/image-to-video` | fal / `runway-gen3/turbo/image-to-video` | Seedance/Veo listés | n/a | `/api/generate/video` |
| Disponibilité réelle | officielle fal 2026-08-14 | Runway Gen-3 Turbo **retiré** 2026-07-30 | non audité 11B | local only | historique |
| Registry | profil disabled ajouté | aucun profil 11B | — | — | — |
| Durée | 5 / 10 s | catalogue 5 / 10 s | — | — | — |
| Async / poll | oui (queue existante) | oui (même transport) | — | sync fake | — |
| Cancel | adapter : non | idem | — | — | — |
| Pricing | **ferme** $1.40 / 5 s | catalogue local $0.25 / 5 s **non officiel 11B** | — | 0 | — |
| Smoke min | 140¢ + réserve 168¢ | 25¢ + réserve 30¢ | — | 0 | — |
| SDK/transport | `@fal-ai/client` + port | même | même | fake | legacy |
| Worker compat | oui (contrat) | oui mais non allowlisté | — | tests only | non |
| Confidentialité | URL signée call-time futur | idem | — | n/a | — |
| Tests contractuels | oui (wrapper) | rejet allowlist | — | interdit Production | interdit preuve |
| Gaps | shortfall 143¢ · cancel provider · QC visuel humanOnly | retirement + pricing non ferme + non allowlisté | preuve insuffisante | supports=* | hors canon |

---

## Interdictions respectées

Aucun appel fal · aucun provider réel · aucune URL signée · aucune lecture média Production · aucune activation · aucune écriture DB/Storage · aucun budget write · aucune réservation · aucun run/job Production · aucun flag Vercel · aucun déploiement manuel · aucune migration distante · aucune décision HR Production · aucun merge/export · aucun lipsync/voice · aucun changement Motion · aucun smoke payant.
