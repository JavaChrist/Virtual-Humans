# 112 — Phase 11A — Text-Free Image Retry Live Preflight

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT`  
**Nature :** preflight live Production · **0** appel OpenAI · **0** réservation · **0** write métier  
**Source :** `20e8783`

```text
VERDICT = BLOCKED_TEXT_LEAK_TO_PROVIDER_PROMPT
SOURCE_COMMIT = 20e8783
PROVIDER_TEXT_POLICY = NO_TEXT
DETERMINISTIC_TEXT_OVERLAY = WIRED_DISABLED
FIRST_REJECTED_ASSET_PRESERVED = true
REAL_PROVIDER_CALLS_THIS_PHASE = 0
NEW_GENERATION = NOT_AUTHORIZED
RUNTIME_PAID_MEDIA = OFF
```

---

## 1. Verdict

**`BLOCKED_TEXT_LEAK_TO_PROVIDER_PROMPT`**

Le runtime Production `20e8783` est déployé, l’exception VHS-124 a été ouverte puis **fermée**, le dry-run HTTP `/prompts` est **executable=true / providerCalled=false**.

Le copy overlay issu des artifacts validés est **cohérent et relisible**.  
Le composeur déterministe, les chemins parent/enfant, le pricing 1¢/2¢ et l’OCR `unavailable_humanOnly` sont **prouvés** (fixture synthétique locale).

**Blocage :** le Prompt Director place le `screenText` de `scene-2` dans le variant image (`subject` `text_motion` = copy). Le builder `phase-11a-image-prompt-v2` **refuse fail-closed** (`screenText copy must not appear in the image variant`). Aucun prompt provider n’est donc constructible pour un second appel payant tant que le visuel et le copy ne sont pas séparés dans le ScenePackage.

Ce n’est **pas** une fuite envoyée à OpenAI : le builder n’émet pas le prompt. Ce n’est **pas** non plus `READY_FOR_TEXT_FREE_IMAGE_RETRY_PAID_AUTH`.

---

## 2. Source commit / deploy

| Champ | Valeur |
|---|---|
| Commit applicatif | **`20e8783`** (`20e8783fa8ef11f976aa041c6169a69742ee19cf`) |
| Root directory | `studio` |
| Composition FP (storage/plan) | `c532c400334f5b22` |
| Overlay FP | `fdfae63fe1c7d003…` |
| Future idempotency FP | `d52382e15036811f…` |
| Salt FP | `77119fc26af4e5c3` (valeur brute non documentée) |

---

## 3. Déploiements ON / OFF

| Étape | Host | Commit |
|---|---|---|
| Pré-condition Ready | `virtual-humans-7seq6j4o6-…` puis `…-iostbrlup-…` | **20e8783** |
| Redeploy ON (fenêtre) | `virtual-humans-3etzwm5js-…` | **20e8783** |
| Redeploy OFF (finally) | `virtual-humans-6yixcxe5k-…` | **20e8783** |

Alias Production final : **Ready** `virtual-humans-6yixcxe5k-…` · `20e8783`.  
Aucun commit documentaire promu comme preuve runtime.

---

## 4. Premier asset rejeté préservé

| Champ | Valeur |
|---|---|
| assetId | `5d68ef64…` |
| status | `rejected` |
| active | **false** |
| checksum | `c508e3e54f2ccac7…` (inchangé) |
| bucket | `director-final-assets` |
| HR `rejected` | **1** |
| réutilisation comme final | **false** |

Aucune réouverture de run/review. Aucun nouvel appel provider associé.

---

## 5. Nouvelle identité future

- `attempt=1` · `retry_of=null`
- nouvelle clé d’idempotence / correlation distincte du smoke `108_`
- **0** run/job/attempt créé par ce preflight

---

## 6–8. Artifacts amont / ScenePackage / plan

Artifacts texte actifs inchangés (brief → storyboard rev.1). Aucun Director texte rejoué en persistance.

ScenePackage `scene-2` reconstruit **en mémoire** : intent `text_motion` · purpose `problem`.  
ScenePackageSet / GenerationPlan **déjà actifs** — **non réécrits**.

Le GenerationPlan single-step n’a **pas** pu être rematérialisé depuis le package réel : le builder prompt no-text échoue fail-closed (fuite copy → variant). Routing canonique / allowlist dry-run restent valides hors copy (`openai` / `gpt-image-1` / `low` / `1024x1024` / estimate 1¢ / réserve 2¢ / fallbacks 0).

---

## 9. Copy overlay exacte (revue humaine)

| Champ | Chaîne |
|---|---|
| locale | `fr` (artifact `video_script.language`) |
| title | `De l’idée à la structure` |
| subtitle | *(absent — non inventé)* |
| CTA | `Découvrir Virtual Humans Studio` |
| legal | *(absent — non inventé)* |

`overlayCopyReviewed=true` — chaînes lisibles, accents/apostrophe conservés, **aucune réécriture**.

---

## 10–12. Overlay fingerprint / police / safe area

| Champ | Valeur |
|---|---|
| fingerprint | `fdfae63fe1c7d003d9e4190bf0aea904…` |
| font | `vhs-overlay-latin-bitmap-v1` · bold · 32 |
| couleurs | texte `#F7F4EE` / fond `#1A1F2B` |
| contraste | **15.01** ≥ 4.5 |
| safeArea | top 720 / right 64 / bottom 48 / left 64 |
| maxLines | 5 |
| overflowPolicy | `reject` |

---

## 13–15. Prompt no-text

| Champ | Valeur |
|---|---|
| version attendue | `phase-11a-image-prompt-v2` |
| politique | `no_text` / `no-text-v1` |
| promptHash | **non produit** (fail-closed avant émission) |
| prompt complet persisté | **non** |
| `promptContainsMarketingCopy` | **true** (dans le **variant** ScenePackage, pas un appel provider) |

Cause : `buildSubject(text_motion)` utilise `scene.screenText` comme `description`, donc le variant image contient le titre. Le builder 11A v2 refuse.

---

## 16. Composeur Production

Présent dans `20e8783` : `phase-11a-bitmap-compositor-1.0.0` · runtime **WIRED_DISABLED**.  
Preuve : PNG synthétique 1024×1024 · checksum déterministe · QC typo **accepted** · **0** média Production lu/écrit · pas de fal-compose · pas de police distante.

---

## 17. OCR / QC

| Check | Résultat |
|---|---|
| OCR réel | **0** |
| fake OCR Production | interdit |
| OCR non configuré | `unavailable_humanOnly` |
| QC technique | prévu (inchangé 11A) |
| QC typo | prévu + prouvé sur fixture |
| Human Review | **obligatoire** |

---

## 18–19. Storage / lifecycle futur

- provider : `{ws}/{project}/media/image/provider/{assetId}.png`
- composed : `{ws}/{project}/media/image/composed/{assetId}.png`
- deux assetIds · parent/enfant · `active=false` · pas d’URL/base64 · HR avant activation  
- **0** Storage write · **0** nouvel asset

---

## 20–22. Provider / pricing / dry-run HTTP

| Champ | Valeur |
|---|---|
| provider / model | `openai` / `gpt-image-1` |
| quality / size | `low` / `1024×1024` |
| estimate / réserve | **1¢ / 2¢** · shortfall **0** · available **26¢** |
| HTTP `/prompts` dry-run | **200** · `executable=true` · `providerCalled=false` |
| worker probe | **401** · non invoqué |
| Storyboard | rev.1 · package set `ready` |

---

## 23. Compteurs

Avant (lecture seule) : runs **1** · jobs **1** · attempts **0** · assets image **1** · réservations actives **0** · ledger 64 · budget **274 / 248 / 0 / 26**.

Après : pas de capture séparée (abort local après HTTP). Chemins exécutés = dry-run HTTP + preuve locale synthétique → **0** write métier attendu. Asset rejeté toujours unique.

---

## 24–26. Flags / runtime / writes

Fermeture `finally` : VHS-124 **0** · Director/Persistence/Paid **0** · worker **0** · Motion/fal **0**.

```text
RUNTIME_PAID_MEDIA = OFF
OPENAI_IMAGE_REAL_EXECUTION = UNAVAILABLE
DETERMINISTIC_OVERLAY_EXECUTION = OFF
MOTION_RUNTIME = UNAVAILABLE
```

Provider calls **0** · Storage Production **0** · ledger **0** · budget write **0**.

---

## 27. Tests / secret scan

Preflight live + preuve locale. Secret scan du diff documentaire : pas de clé, pas d’URL signée, pas de base64 provider, pas de prompt complet.

---

## 28. Documentation / Git

Ce rapport + index. Commit/push **documentaire** après fermeture. **Pas** de redeploy du commit docs.

---

## 29. P0 / P1

| Priorité | Item |
|---|---|
| P0 | **ne pas** lancer d’appel OpenAI Image tant que le variant image contient le screenText |
| P0 | **ne pas** activer / recycler `5d68ef64…` |
| P1 fermé | preflight live 20e8783 · overlay spec revue · composeur prouvé · flags OFF |
| P1 ouvert | séparer copy overlay du variant image (Prompt Director `text_motion`) puis **nouveau** preflight |

---

## 30. Prochaine autorisation exacte

```text
NEXT = AUTH_11A_STRIP_OVERLAY_COPY_FROM_IMAGE_VARIANT
        — Prompt Director : subject/variant image sans screenText/CTA
        — copy uniquement dans ImageTextOverlaySpec
        — puis AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT (rejouable) avant tout paid
DO_NOT = paid retry · modifier le REJECT · activer l’asset · flags ON hors Auth
         · fal · Motion · legacy
```
