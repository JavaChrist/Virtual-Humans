# 113 — Phase 11A — Strip Overlay Copy from Image Variant

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_STRIP_OVERLAY_COPY_FROM_IMAGE_VARIANT`  
**Nature :** correctif Prompt Director + contrats visuel/copy · **0** appel OpenAI · **0** génération · flags **OFF**  
**Ops :** nouveau preflight live **non lancé** — porte suivante `AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT`.

```text
VERDICT = READY_FOR_NEW_TEXT_FREE_IMAGE_RETRY_PREFLIGHT
IMAGE_VARIANT_OVERLAY_COPY = REMOVED
PROVIDER_PROMPT_OVERLAY_COPY = ABSENT
PROVIDER_TEXT_POLICY = NO_TEXT
DETERMINISTIC_OVERLAY = WIRED_DISABLED
FIRST_IMAGE_ASSET = HUMAN_REJECTED_UNCHANGED
REAL_PROVIDER_CALLS = 0
PRODUCTION_WRITES = 0
RUNTIME_PAID_MEDIA = OFF
NEW_LIVE_PREFLIGHT_REQUIRED = YES
```

---

## 1. Verdict

**`READY_FOR_NEW_TEXT_FREE_IMAGE_RETRY_PREFLIGHT`**

Le Prompt Director ne copie plus `screenText` (ni titre, ni CTA) dans le sujet du variant image.  
Le copy marketing reste exclusivement dans `ImageTextOverlaySpec`.  
Le builder no-text `phase-11a-image-prompt-v2` **accepte** le variant une fois nettoyé.  
Aucune génération réelle, aucun flag, aucun write Production.

## 2. Cause racine corrigée

Dans `buildSubject`, `text_motion` utilisait `scene.screenText` comme `subject.description`.  
Pour `scene-2`, le titre « De l’idée à la structure » entrait donc dans le variant `image.text_to_image`.  
Le builder v2 refusait ensuite fail-closed (`BLOCKED_TEXT_LEAK_TO_PROVIDER_PROMPT`, `112_`).

Seconde voie : `must_respect_cta` injectait le texte CTA dans `constraints.required`, rendu dans le variant image.

Le guard no-text **n’a pas été affaibli**.

## 3. Contrat visual variant

`ImageVisualVariant` (`studio/src/domain/production/image-visual-variant.ts`) — Zod **strict** v1.0.0 :

`visualSubject`, `visualAction`, `environment`, `composition`, `camera`, `lighting`, `palette`, `style`, `negativeSpaceIntent`, `forbiddenVisualElements`, `providerTextPolicy=no_text`.

Interdits : `screenText`, `title`, `subtitle`, `callToAction`, `legalLine`.

## 4. Sujet visuel scene-2

Dérivé de purpose / intent / VisualDirection / CreativeConcept — **jamais** de `screenText`.  
Si une DA artifact est déjà précise et sans fuite, elle est conservée.  
Sinon (purpose `problem` + `text_motion` / `scene-2`) : direction fonctionnelle idée abstraite → structure organisée, modules lumineux, diffus → ordonné, espace négatif, aucun texte.

Dry-run local (sujet retenu) :

> Luminous modular elements assembling from a diffuse field into an ordered structure. Reserved empty negative space for later typographic overlay. No letters, numbers, pseudo-glyphs, text buttons, or written interfaces.

## 5. Overlay copy exacte

| Champ | Valeur |
|---|---|
| locale | `fr` |
| title | `De l’idée à la structure` (U+2019) |
| CTA | `Découvrir Virtual Humans Studio` |
| subtitle / legal | absents |
| font | `vhs-overlay-latin-bitmap-v1` |
| overflow | `reject` |
| contraste min | 4.5 |
| fingerprint | `fdfae63fe1c7d003d9e4190bf0aea904…` (identique à `112_`) |

## 6. Détection de fuite

`overlay-leak-v1` (`studio/src/domain/production/overlay-copy-leak.ts`) :

- NFC, apostrophes unifiées puis séparées, casse, espaces, ponctuation ;
- rejet exact / normalisé si longueur ≥ 8 ;
- rejet d’un span contigu ≥ **16** caractères (inclusion partielle significative) ;
- un mot générique isolé (`idée`, `structure`, `studio`) **n’est pas** bloqué.

Guard `[DATA:…]` inchangé.

## 7. Prompt provider

`phase-11a-image-prompt-v2` · policy `no_text` / `no-text-v1`.  
Le prompt demande explicitement : no text / letters / words / numbers / captions / written logo / watermark / textual interface / pseudo-glyphs / text inside buttons.  
Titre et CTA absents. Prompt complet **non persisté**.

Dry-run : `promptHash=19628b08e2fda6e8…`

## 8. ScenePackageSet / GenerationPlan

Construction mémoire `scene-2` uniquement : `visualVariant` provider-safe + `textOverlaySpec` compositor-only.  
`persist=false` · artifact Production **non muté**.  
Fingerprint fonctionnel : `be47788f8c685a70…`

Plan single-step : 1 scène, 1 submit futur, 1 output provider + 1 composé dérivé, retry/fallback/downstream 0.  
Payload provider sans copy ; overlay fingerprint en `inputRefs`.  
Fingerprint plan : `86a86087a32c80e5…`

## 9. Ancien asset / composeur

Asset `5d68ef64…` · `rejected` · `active=false` · HR REJECT ×1 — **inchangé**.  
Future idempotence : nouvelle clé, `retry_of=null`.  
Composeur déterministe existant **WIRED_DISABLED** — aucun média Production composé.

## 10. Dry-run local

```text
providerCalled=false
executable=true
providerTextPolicy=no_text
visualSubjectPresent=true
overlaySpecPresent=true
overlayCopyInVisualVariant=false
overlayCopyInProviderPrompt=false
providerPromptNoText=true
estimate=1¢  reservation=2¢
compositorWired=true  Human Review required
retry/fallback/downstream=0/0/0
legacyUsed=false  motionIsolation=true
```

Aucun prompt provider complet dans le rapport.

## 11. Preuves

| Check | Résultat |
|---|---|
| Unitaires | **1572/1572** |
| Typecheck / lint / build | PASS (lint : 0 error, warnings préexistants) |
| migrations-static | PASS |
| DB integration | N/A (Docker absent) |
| Secret scan | PASS (pas de secret / URL signée / base64 / prompt complet versionné) |
| OpenAI / Production writes | **0** |
| Flags / runtime | OFF |

## 12. Prochaine porte

**`AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT`** — nouveau preflight live no-provider.  
Ne pas lancer sans Auth. Ne pas ouvrir les flags ici.
