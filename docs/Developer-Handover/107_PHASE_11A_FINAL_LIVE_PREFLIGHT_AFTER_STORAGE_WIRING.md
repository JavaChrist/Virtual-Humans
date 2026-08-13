# 107 — Phase 11A — Final Live Preflight after Storage & Canonical Plan Wiring

**Date :** 2026-08-13  
**Auth :** `AUTH_11A_LIVE_PREFLIGHT_7A67C77_NO_PROVIDER`  
**Nature :** preflight live Production · **0** appel OpenAI · **0** réservation · **0** write métier

```text
VERDICT = READY_FOR_11A_PAID_AUTH
SOURCE_COMMIT = 7a67c77
COMPOSITION_FINGERPRINT = c532c400334f5b22
REAL_MEDIA_CALLS = 0
PRODUCTION_MEDIA_WRITES = 0
RUNTIME_PAID_MEDIA = OFF
OPENAI_IMAGE_REAL_EXECUTION = UNAVAILABLE
MOTION_RUNTIME = UNAVAILABLE
```

---

## 1. Verdict

**`READY_FOR_11A_PAID_AUTH`**

Les trois blocages de `105_` sont fermés en Production sur le runtime applicatif
**`7a67c77`** (fingerprint `c532c400334f5b22`) :

1. GenerationPlan matérialisé via routing canonique (`tryPhase11ASingleStep`) ;
2. base64 / data URL impossibles dans les états persistés (`persistedMediaPayloadPossible=false`) ;
3. ingestion Storage privée réellement composée (`storageIngestWired=true`, bucket `director-final-assets`).

Dry-run unique sans provider, puis fermeture fail-closed OFF depuis la même source.

---

## 2. Source runtime / fingerprint

| Champ | Valeur |
|---|---|
| Commit applicatif | **`7a67c77`** (`7a67c77c3df64750265d66b23161e8d42ffcb13a`) |
| Root directory | `studio` |
| Composition version | `phase-11a-storage-plan-materialize-1.0.0` |
| Composition fingerprint | **`c532c400334f5b22`** |
| Salt fingerprint (hash) | `857cc165d3f7e92f` (valeur brute non documentée) |

Script : `studio/scripts/phase-11a-live-preflight-7a67c77.mjs`

---

## 3. Déploiements ON / OFF

| Étape | Host | Commit |
|---|---|---|
| Pré-condition Ready | `virtual-humans-3ttth9qjp-…` | **7a67c77** |
| Redeploy ON (fenêtre) | `virtual-humans-paib0qzcn-…` | **7a67c77** |
| Redeploy OFF (finally) | `virtual-humans-8mubro9na-…` | **7a67c77** |

Aucun commit documentaire promu comme preuve runtime.

---

## 4. Dry-run HTTP

| Check | Valeur |
|---|---|
| Login / project | 200 / 200 |
| POST `/prompts` dry-run | 200 · `providerCalled=false` · `executable=true` |
| Storyboard | rev.1 |
| ScenePackageSet existant | **absent** |
| Worker probe | **401** · non invoqué |
| Correlation | `corr-11a-preflight-…` (préfixe only) |
| Post-fermeture prompts | **404** |

---

## 5. Executable / providerCalled

| Champ | Valeur |
|---|---|
| executable | **true** |
| providerCalled | **false** |
| providerCalls | **0** |
| workerInvocations | **0** |

---

## 6. Exception VHS-124

| Champ | Valeur |
|---|---|
| Exception | `VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION` |
| Scope | projet `984507af-…` · `scene-2` · `image.text_to_image` · openai / `gpt-image-1` / low / 1024×1024 |
| Pendant fenêtre | active · non expirée |
| Après finally | **OFF** |

---

## 7. Registry / wildcard

| Champ | Valeur |
|---|---|
| Registry claim | `DOES_NOT_DECLARE_GLOBAL_REAL_PROVIDER_COMPATIBILITY` |
| `providerMode=real` wildcard | **interdit** (`wildcardRealForbidden=true`) |
| Motion Registry | **DISABLED** |

---

## 8. Artifacts amont

Chaîne MarketingPlan → CreativeConcept → VideoScript → VisualDirection → StoryboardProject
valide (révisions 1) · **aucun** Director texte rejoué · **aucune** écriture artifact métier.

---

## 9. ScenePackageSet

| Champ | Valeur |
|---|---|
| sceneId | `scene-2` |
| déterministe | **true** |
| limité à scene-2 | **oui** |
| persisté | **false** |

---

## 10. Routing canonique

`POST /routing` / service canonique emprunté · `canonicalRouting=true` · branche VHS-124
`tryPhase11ASingleStep` · pas de chemin legacy.

---

## 11. GenerationPlan matérialisé

| Champ | Valeur |
|---|---|
| materialisé | **true** |
| single-step | **true** |
| stepCount | 1 |
| action | `image.text_to_image` |
| fallbacks | 0 / vides |
| downstream | **false** |
| persisté | **false** |

---

## 12. Fingerprints

| Type | Préfixe |
|---|---|
| Composition | `c532c400334f5b22` |
| Plan / routing | `1c5011b7f3bee767…` |
| Prompt (sha256) | `9ad3ad284ec236f9…` |

---

## 13. Provider / model / quality / size

`openai` / `gpt-image-1` / `low` / `1024x1024` · format attendu PNG · max 1/1/1 · retry 0 · fallback 0.

---

## 14. Adapter / clé

| Champ | Valeur |
|---|---|
| adapterMode | `vhs124_openai_image_allowlist` |
| OPENAI_API_KEY | **present** · valeur **non lue** |
| fake résolu | **non** |
| lazy Production | **oui** |

---

## 15. Estimate / réservation

| Champ | Valeur |
|---|---|
| estimate | **1¢** |
| réservation prévue | **2¢** (max) |
| pricingConfigured | **true** |
| divergence pricing | **non** |

---

## 16. Budget

**274 / 247 / 0 / 27** ¢ (hard / committed / reserved / available) · inchangé avant/après.  
Migrations SQL locales **30/30** (PostgREST `schema_migrations` non autoritatif).

---

## 17. Worker

Composé dans le chemin Production · **non invoqué** · flag worker **OFF** pendant et après · probe 401.

---

## 18. Sanitisation base64

Sanitizer Production présent et appliqué avant persistance :

- `b64_json` / base64 / buffers / data URLs / URLs provider ou signées **interdits** dans états persistés ;
- interdit dans `production_runs.state`, `production_jobs.payload`, `generation_attempts` ;
- prompt complet et payload provider brut **interdits** ;
- preuve via assertions dry-run / build — **aucune** image réelle ou synthétique générée.

---

## 19. persistedMediaPayloadPossible

**`false`**

---

## 20. Storage caller / path / bucket

| Champ | Valeur |
|---|---|
| wired | **true** |
| bucket | `director-final-assets` |
| path pattern | `{workspaceId}/{projectId}/media/image/{assetId}.png` |
| caller | chemin worker → `buildPhase11AImageStoragePath` / ingest privé |
| overwrite / upsert | **interdits** |
| write Storage durant preflight | **0** |

---

## 21. Asset lifecycle (futur smoke)

`active=false` · URL publique interdite · base64 memory-only jusqu’à ingest · Human Review obligatoire · aucun downstream.

---

## 22. QC / Human Review

QC technique après ingestion (chemin futur) · Human Review **obligatoire** ·  
**0** quality report · **0** contexte/décision HR créés durant ce preflight.

---

## 23. Legacy isolation

`/api/generate/image` **non** utilisé · `legacyIsolated=true`.

---

## 24. Motion isolation

Motion / MV-002 / fal **isolés** · tous flags Motion **OFF** · `motionIsolation=true`.

---

## 25. Compteurs avant / après (Δ = 0)

| Compteur | Avant | Après | Δ |
|---|---:|---:|---:|
| production_runs | 0 | 0 | 0 |
| production_jobs | 0 | 0 | 0 |
| generation_attempts | 0 | 0 | 0 |
| ledger rows | 62 | 62 | 0 |
| réservations actives | 0 | 0 | 0 |
| ScenePackageSet actifs | 0 | 0 | 0 |
| GenerationPlan actifs | 0 | 0 | 0 |
| assets image | 0 | 0 | 0 |
| human_review_decisions | 0 | 0 | 0 |
| Storage objects (écrits) | — | — | **0** |
| quality reports | — | — | **0** |

---

## 26. Provider calls / worker invocations

**0 / 0**

---

## 27. Flags finaux

Director / Persistence / Paid / Worker / VHS-124 / Motion / fal / cron / retry / fallback / downstream / merge-export → **OFF** (écritures explicites `LAST_EXPLICIT_WRITE=0`).

---

## 28. Runtime final

| Probe | Valeur |
|---|---|
| `RUNTIME_PAID_MEDIA` | **OFF** |
| `OPENAI_IMAGE_REAL_EXECUTION` | **UNAVAILABLE** |
| `MOTION_RUNTIME` | **UNAVAILABLE** |
| closed probe | **404** |

---

## 29. Documentation / commit / push

Ce rapport + script preflight + index canon. Commit/push documentaires **après** fermeture.  
**Pas** de redéploiement du commit documentaire comme preuve runtime.

---

## 30. P0 / P1

| Priorité | Statut |
|---|---|
| P0 | pas d’appel OpenAI sans Auth · runtime OFF · legacy ≠ PASS |
| P1 fermé | live preflight `7a67c77` + FP `c532c400334f5b22` |
| P1 ouvert | Auth payante once (nouvelle) |

---

## 31. Prochaine autorisation exacte

```text
NEXT = DONE → voir `108_` (RECONCILIATION_REQUIRED · Auth provider CONSUMED)
FOLLOW-UP = ledger-reconcile 1¢ · Human Review decision (Auth distinctes)
DO_NOT = second OpenAI · fal · Motion · legacy · auto-activate
```
