# 66 — MT-007A Motion Transfer Provider Capability Spike

**Date de vérification :** 11 août 2026  
**Gate :** Provider Decision  
**Verdict :** **`PROVIDER_SELECTED_FOR_ADAPTER_IMPLEMENTATION`**

```text
provider decision = SELECTED (disabled adapter only)
evidence level = official fal docs + OpenAPI/llms.txt (no paid call)
provider calls = 0
paid benchmark = NO
runtime = unavailable
real adapters = 0
secrets used = 0
```

## 1. Question

> Quel provider/modèle possède une API réelle permettant de transmettre une **vidéo source de performance** et une **référence personnage**, avec une fidélité potentiellement mesurable pour Tai-Chi MV-001 ?

## 2. Sources officielles consultées (2026-08-11)

| Source | URL |
|---|---|
| fal Kling v3 Pro motion-control llms.txt | https://fal.ai/models/fal-ai/kling-video/v3/pro/motion-control/llms.txt |
| fal Kling v3 Pro API docs | https://fal.ai/models/fal-ai/kling-video/v3/pro/motion-control/api |
| fal Kling v3 Standard llms.txt | https://fal.ai/models/fal-ai/kling-video/v3/standard/motion-control/llms.txt |
| fal Kling v2.6 Pro llms.txt | https://fal.ai/models/fal-ai/kling-video/v2.6/pro/motion-control/llms.txt |
| fal Kling v2.6 Standard llms.txt | https://fal.ai/models/fal-ai/kling-video/v2.6/standard/motion-control/llms.txt |
| fal API Services (no training on Client Content) | https://fal.ai/legal/api-services |
| fal media retention | https://fal.ai/docs/documentation/model-apis/media-expiration |
| fal FAQ (commercial badge, CDN ≥7d) | https://fal.ai/docs/documentation/model-apis/faq.md |
| Runway models list (Act-Two) | https://docs.dev.runwayml.com/guides/models/ |
| Runway Act-Two changelog | https://docs.dev.runwayml.com/api-details/api_changelog/ |
| VHS fal adapter | `studio/src/infrastructure/providers/fal-adapter.ts` |

**Non utilisés comme preuve :** SEO, agrégateurs, vidéos promo, benchmarks non reproductibles.

## 3. Providers / endpoints évalués

| Candidat | Endpoint | Disponibilité API |
|---|---|---|
| fal Kling v3 Pro motion-control | `fal-ai/kling-video/v3/pro/motion-control` | **AVAILABLE** (docs + OpenAPI) |
| fal Kling v3 Standard | `fal-ai/kling-video/v3/standard/motion-control` | **AVAILABLE** |
| fal Kling v2.6 Pro | `fal-ai/kling-video/v2.6/pro/motion-control` | **AVAILABLE** |
| fal Kling v2.6 Standard | `fal-ai/kling-video/v2.6/standard/motion-control` | **AVAILABLE** |
| Runway Act-Two | `POST /v1/character_performance` `model=act_two` | **AVAILABLE** (docs.dev) — orientation performance personnage |
| VHS fal I2V/T2V existants | `kling…/image-to-video`, `text-to-video`, etc. | **INELIGIBLE** (`I2V != motion transfer`) |
| ElevenLabs / OpenAI image | — | **INELIGIBLE** |

## 4. Matrice de capacité (extrait)

Légende : `SUPPORTED` · `PARTIAL` · `UNVERIFIED` · `NOT_SUPPORTED`

| Critère | fal Kling v3 Pro MC | fal Kling v2.6 Pro MC | Runway Act-Two | VHS fal I2V |
|---|---|---|---|---|
| source video first-class | **SUPPORTED** (`video_url` required) | **SUPPORTED** | **SUPPORTED** (reference video) | NOT_SUPPORTED |
| character/reference image | **SUPPORTED** (`image_url` required) | **SUPPORTED** | **SUPPORTED** | PARTIAL (start frame) |
| outfit reference field | NOT_SUPPORTED (via image) | NOT_SUPPORTED | NOT_SUPPORTED | NOT_SUPPORTED |
| true motion transfer | **SUPPORTED** (schema: actions match ref video) | **SUPPORTED** | PARTIAL (character performance / face+body) | NOT_SUPPORTED |
| motion fidelity controls | UNVERIFIED | UNVERIFIED | UNVERIFIED | — |
| timing preservation | UNVERIFIED | UNVERIFIED | UNVERIFIED | — |
| camera preservation | PARTIAL (`character_orientation`) | PARTIAL | UNVERIFIED | — |
| pose control | PARTIAL (provider_native) | PARTIAL | PARTIAL (`bodyControl`) | — |
| full-body | PARTIAL (docs claim entire/upper body) | PARTIAL | UNVERIFIED | — |
| hands/feet | UNVERIFIED | UNVERIFIED | UNVERIFIED | — |
| identity control | PARTIAL (+ V3 `elements` face) | PARTIAL | PARTIAL | PARTIAL |
| outfit control | UNVERIFIED | UNVERIFIED | UNVERIFIED | — |
| max duration | 10s (image) / 30s (video orient.) | same | model limits | — |
| async + poll + request id | **SUPPORTED** (fal queue) | **SUPPORTED** | **SUPPORTED** (tasks) | SUPPORTED |
| cancel | NOT_SUPPORTED (non prouvé pour cet endpoint ; VHS fal cancel absent) | same | UNVERIFIED | NOT_SUPPORTED |
| pricing estimable | **SUPPORTED** ($/s published) | **SUPPORTED** | UNVERIFIED (not priced here) | — |
| commercial use badge | **SUPPORTED** (model page) | **SUPPORTED** | UNVERIFIED | — |
| VHS integration fit | **SUPPORTED** (`@fal-ai/client` + fal adapter patterns) | same | NOT_SUPPORTED (pas de SDK Runway dans VHS) | — |

## 5. Hard requirements VHS

| Requirement | fal Kling v3 Pro |
|---|---|
| sourceVideo real first-class | **PASS** |
| characterReference supported | **PASS** |
| motionTransfer supported (API semantics) | **PASS** (documentaire) |
| fullBody supported/claimed | **PASS** (PARTIAL claim — benchmark required) |
| timing testable via Motion QC | **PASS** (UNVERIFIED quality) |
| async job observable | **PASS** |
| cost estimable before submit | **PASS** (indicative $/s) |
| output retrievable | **PASS** (`video.url` → controlled download later) |
| provider job ID | **PASS** (`requestId`) |
| errors/status mappable | **PASS** |

Tai-Chi QC (feet/hands, identity, outfit, camera, timing) : **mesurable** via Motion QC ; niveaux restent `UNVERIFIED` jusqu’au benchmark payant.

## 6. Faux positifs rejetés

```text
I2V != motion transfer
```

Rejetés explicitement :

- `fal-ai/kling-video/v2/master/image-to-video`
- `fal-ai/kling-video/v2/master/text-to-video`
- `fal-ai/runway-gen3/turbo/image-to-video`
- `fal-ai/veo3.1/fast`
- lipsync / face-swap-only / T2V prompt-only

## 7. Pricing officiel (USD / seconde)

| Endpoint | $/s (llms.txt 2026-08-11) |
|---|---|
| v3 pro motion-control | **0.168** |
| v3 standard | 0.126 |
| v2.6 pro | 0.112 |
| v2.6 standard | 0.070 |

### Estimation indicative MV-001 (aucune réservation)

Hypothèse : `character_orientation=video`, durée facturable = durée source.

| Scénario | Durée | v3 Pro cost | minor (ceil USD×100) |
|---|---|---|---|
| smallest useful | 1 s | $0.168 | **17** |
| recommended benchmark | 8 s | $1.344 | **135** |
| upper doc limit | 30 s | $5.040 | **504** |

| Recommendation | Value |
|---|---|
| recommended reservation (buffer ~20%) | **162** minor USD (8s) |
| recommended hard-limit delta (single smoke) | **≤ 200** minor au-dessus du commit actuel, Auth séparée |
| estimate mode until dry-run | **indicative** (firm only after adapter dry-run confirms billing unit) |

Échec / cancel : **non documentés** comme crédits remboursés → traiter comme coût potentiellement engagé (DECISION_REQUIRED ops).

## 8. Confidentialité / droits (fal)

| Sujet | Preuve | Statut |
|---|---|---|
| Training on Client Content | API Services : Company will **not** use Client Content to train (sauf Excluded Models) | OK documentaire |
| Request payload retention | 30 days default ; `X-Fal-Store-IO: 0` | **DECISION_REQUIRED** (opt-out recommandé) |
| CDN media | ≥7 days default ; public URL unless ACL | **DECISION_REQUIRED** (download immédiat + ACL/private) |
| Commercial use | Badge « Commercial use » sur page modèle | OK documentaire |
| Biométrie / visages | non détaillé modèle | **DECISION_REQUIRED** humaine avant upload talent |
| Geo / sous-traitants | non exhaustif ici | **DECISION_REQUIRED** legal |
| Consentement source video | hors provider | **DECISION_REQUIRED** produit |

## 9. Décision

```text
PROVIDER_SELECTED_FOR_ADAPTER_IMPLEMENTATION
provider = fal
model/endpoint = fal-ai/kling-video/v3/pro/motion-control
cost alternate = fal-ai/kling-video/v2.6/standard/motion-control ($0.07/s)
```

### Raisons

1. Schéma officiel **exige** `video_url` + `image_url` — vrai motion transfer, pas I2V.
2. Queue async + `requestId` + status/result déjà alignés avec VHS fal patterns.
3. Prix publié au $/s → estimate ADAPTER_DERIVED possible.
4. Badge commercial + SDK `@fal-ai/client` déjà dans le dépôt.
5. V3 ajoute `elements` (face binding) utile identité — orientation `video` pour motions complexes (Tai-Chi).

### Limitations

- Outfit : pas de champ dédié.
- Cancel : **NOT_SUPPORTED** jusqu’à preuve MT-007B (typed `cancel_unsupported`).
- Fidélité mains/pieds/timing/critical : **UNVERIFIED** jusqu’au benchmark.
- URLs CDN publiques par défaut → ingestion contrôlée obligatoire (jamais en artifacts).

### Runway Act-Two

Credible second track (official `character_performance` / `act_two`) but **not selected** for MT-007B :

- pas de SDK Runway dans VHS ;
- orientation « character performance » (visage/corps) moins explicitement « full-body martial arts motion transfer » que Kling MC docs ;
- pricing non cartographié dans ce spike.

## 10. Mapping → MotionTransferProviderPort

Voir `studio/src/infrastructure/providers/motion-transfer/fal-kling-motion-control-mapping.ts`.

| Direction | Mapping |
|---|---|
| Input | `sourceVideo` → `video_url` ; identity → `image_url` ; optional face → `elements` (v3, orientation=video) ; `character_orientation` from camera/motion policy |
| Submit | `fal.queue.submit` → `MotionTransferSubmission.providerJobId = requestId` |
| Status | `IN_QUEUE→queued`, `IN_PROGRESS→processing`, `COMPLETED→completed`, `FAILED→failed` |
| Result | `video.url` → descriptor `providerOutputRef` (redacted / downloaded later — never persisted raw in public artifacts) |
| Errors | table HTTP/fal → `provider_*` codes |
| Cancel | respond `cancel_unsupported` |
| Auth | server-only `FAL_KEY` — never in domain types |

## 11. Contract-suite feasibility

| Item | Class |
|---|---|
| estimate | ADAPTER_DERIVED |
| submit | DIRECT |
| poll | DIRECT |
| cancel | NOT_SUPPORTED |
| idempotence | ADAPTER_DERIVED |
| statuses | DIRECT |
| usage | ADAPTER_DERIVED |
| cost | ADAPTER_DERIVED |
| errors | ADAPTER_DERIVED |
| redaction | ADAPTER_DERIVED |
| late result | ADAPTER_DERIVED |

Aucun manque **critique** bloquant la sélection adapter disabled. Cancel typed unsupported est acceptable V1 (aligné fal adapter actuel).

## 12. Registry profile status

Design only : `mt007a-fal-kling-registry-design.ts`

```text
enabled = false
paidExecution = false
status = UNVERIFIED
sourceVideo/characterReference = SUPPORTED (documentary)
quality-critical fields = UNVERIFIED
```

**Pas** d’insertion dans le snapshot Production.

## 13. Artefacts code

| Fichier | Rôle |
|---|---|
| `fal-kling-motion-control-mapping.ts` | mapping + pricing + anti-I2V |
| `mt007a-fal-kling-registry-design.ts` | profil Registry désactivé |
| `mt007a-spike.test.ts` | tests statiques |

## 14. Interdits respectés

```text
NO PROVIDER API CALL
NO AUTHENTICATED REQUEST
NO GENERATION / UPLOAD / SUBMIT / POLL
NO COST / SECRET USE
NO FEATURE ENABLE / DEPLOY / DB WRITE
```

## 15. Suite

**MT-007B…012** — adapter → synthetic E2E **IMPLEMENTED**.  
**MT-013A** — MV-001 readiness audit **DONE** (`73_`) ; pricing/retention re-vérifiés ; **0** appel provider.
