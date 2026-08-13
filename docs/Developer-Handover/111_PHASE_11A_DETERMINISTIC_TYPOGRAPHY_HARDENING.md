# 111 — Phase 11A-HARDEN — Deterministic Typography & Text-Free Image Generation

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_HARDEN_TEXT_FREE_GENERATION_AND_DETERMINISTIC_OVERLAY`  
**Nature :** contrat + câblage overlay déterministe · **0** appel OpenAI · **0** nouvelle génération · flags **OFF**

```text
VERDICT = READY_FOR_TEXT_FREE_IMAGE_RETRY_PREFLIGHT
OPENAI_IMAGE_TECHNICAL_PIPELINE = PASS
FIRST_IMAGE_ASSET = HUMAN_REJECTED
PROVIDER_TEXT_POLICY = NO_TEXT
DETERMINISTIC_TEXT_OVERLAY = WIRED_DISABLED
REAL_PROVIDER_CALLS_THIS_PHASE = 0
NEW_GENERATION = NOT_AUTHORIZED
RUNTIME_PAID_MEDIA = OFF
```

---

## 1. Verdict

**`READY_FOR_TEXT_FREE_IMAGE_RETRY_PREFLIGHT`**

Le pipeline technique OpenAI Image (`108_`–`110_`) reste **PASS**.  
L’asset smoke `5d68ef64…` reste **HUMAN_REJECTED**, privé, `active=false`, preuve historique.  
Le provider image n’est plus chargé de peindre le texte marketing.  
L’overlay typographique déterministe est **câblé et testé**, runtime **WIRED_DISABLED**.  
Aucune nouvelle génération n’a été lancée.

## 2. Commit / push

Commit/push normal `main` après suite verte. Pas de force push. Pas de deploy manuel. Pas d’ouverture de flags.

## 3. Politique no-text

`providerTextPolicy=no_text` · version `no-text-v1`.  
Le prompt v2 impose : aucune lettre, mot, chiffre, légende, bouton textuel, logo textuel, watermark, pseudo-texte, UI simulée avec glyphes.  
Les chaînes overlay ne sont **jamais** envoyées au provider.

## 4. Contrat overlay

`ImageTextOverlaySpec` (`studio/src/domain/production/image-text-overlay.ts`) — Zod **strict** :

locale, title, subtitle?, callToAction?, legalLine?, fontFamily allowlistée, fontWeight, fontSize, lineHeight, alignment, textColor, backgroundColor, safeArea, maxLines, overflowPolicy=`reject`, contrastRequirement ≥ 4.5, version.

Bornes de longueur ; refus HTML / script / URL / instructions provider ; fingerprint SHA-256 déterministe ; aucune donnée Motion.

## 5. Séparation contenu

`separatePhase11AVisualAndText` : visuel (sujet, action, décor, caméra, DA) vs chaînes overlay.  
`screenText.renderMode=model_generated` est **fail-closed** sur le chemin image 11A.  
Copy issue d’artifacts validés uniquement.

## 6. Prompt provider

`phase-11a-image-prompt-v2` : composition / ambiance / palette / sujet / espace négatif / cadrage / DA + bloc no-text.  
Metadata redacted : `providerTextPolicy`, `textOverlayMode=deterministic`, version politique, `promptHash`.  
Le prompt complet n’est pas persisté.

## 7. OCR gate

Port `ImageOcrPort` provider-agnostic.  
Tests : fake strict. Cette phase : **aucun OCR réel payant**.  
Texte au-delà du seuil → `provider_image_text_detected` (fail-closed avant composition).  
OCR non configuré → `unavailable_humanOnly` (pas de garantie d’absence totale de texte).  
Aucune activation automatique.

## 8. Composeur

`composePhase11ADeterministicOverlay` — PNG 1024×1024, police bitmap locale, wrap, safe area, refus overflow/clipping, pas de mutation de chaînes, checksum, metadata redacted.  
Pas de fal-compose. Pas de système parallèle Motion.

## 9. Polices

Allowlist unique : `vhs-overlay-latin-bitmap-v1` (bitmap 8×8 embarquée).  
Couverture : ASCII printable, Latin-1, apostrophes typographiques, Œ/œ, €.  
Glyphe hors couverture → fail-closed.  
Aucune police distante, aucun téléchargement réseau.

## 10. Déterminisme

Même buffer provider + même spec → même checksum PNG.  
Fingerprint overlay + fingerprint composé (parent checksum ⊕ overlay ⊕ version composeur).  
Replay Storage : même objet, `wrote=false`.

## 11. Accents / Unicode

Accents français, apostrophes `'` / `’`, Latin-1 : rendus tels quels.  
Hors couverture (ex. CJK) : rejeté. Pas de substitution silencieuse.

## 12. Safe areas / overflow

Insets du spec ; bounding boxes dans la zone.  
`overflowPolicy=reject` : pas de troncature silencieuse.  
Dépassement maxLines / token incassable / hauteur → `overlay_overflow`.

## 13. Contraste

Ratio WCAG relatif texte/fond ; défaut ≥ 4.5.  
Sous le seuil → `overlay_contrast_insufficient` avant peinture.

## 14. Assets parent / enfant

| Rôle | Path | Statut |
|---|---|---|
| Provider original | `…/media/image/provider/{id}.png` (historique smoke : 5 segments) | immuable, `active=false`, jamais écrasé |
| Composé | `…/media/image/composed/{id}.png` | nouvel `assetId`, parent + overlay hash, `active=false` |

L’asset rejeté `5d68ef64…` n’est **pas** réutilisé comme final. Isolation Motion.

## 15. Storage paths

Bucket privé `director-final-assets`.  
6 segments pour les nouveaux rôles. 5 segments conservés pour l’asset historique.  
Aucun overwrite/upsert divergent. Checksum obligatoire. **0 write Production cette phase.**

## 16. Provenance

Composé : `mediaRole=composed_overlay_image`, `parentAssetId`, `overlayVersion`, `overlayFingerprint`, `compositorVersion`.  
Pas d’URL, pas de base64, pas de secret, `motionRole=null`.

## 17. QC technique

PNG valide, 1024×1024, taille, checksum, provenance, décodabilité — inchangé pour le provider ; appliqué au dérivé composé.

## 18. QC typographique

Chaînes identiques ; rien de manquant/extra ; maxLines ; bbox safe area ; pas de clipping ; contraste ; police allowlistée ; locale ; ordre title → subtitle → CTA → legal.  
Défauts visuels provider non mesurables → `humanOnly`.

## 19. Human Review

Carte comparative redacted : provider vs composé vs chaînes vs QC typo vs OCR vs provenance vs coût 1¢ déjà soldé vs version composeur.  
Décisions futures : APPROVE / REJECT / RETRY_WITH_UPDATED_CONSTRAINTS / REQUEST_NEW_REFERENCE.  
Retry = **intent-only** (0 job, 0 appel).  
La décision REJECT existante **n’est pas** modifiée.

## 20. Scene-2 future revision

`preparePhase11AScene2TextFreeRevision` : visuel no-text + overlay séparé ; `execute=false` ; `reuseRejectedAsFinal=false` ; nouvelle idempotency key **future** ; nouvelle Auth provider obligatoire ; 0 retry auto depuis le REJECT.

## 21. Idempotence

Fingerprint composé → `assetId` UUID v5-like. Replay sans second objet ni second asset.

## 22. Guards

Refus testés : copy overlay dans le prompt ; consigne « dessiner des mots » ; overlay sans locale ; police hors allowlist ; texte trop long ; overflow ; clipping ; contraste ; mutation silencieuse ; overwrite provider ; composé auto-actif ; URL/base64 ; double write ; Motion ; legacy ; downstream ; HR absente ; `model_generated`.

## 23–26. Tests / typecheck / lint / build / secret scan

| Check | Résultat |
|---|---|
| Tests ciblés overlay / prompt / QC / HR / guards | **8/8 PASS** |
| 11A allowlist / Prompt Director path image | PASS (prompt v2 no-text) |
| Suite unitaire | **1556/1556 PASS** |
| typecheck | PASS |
| lint (fichiers touchés) | 0 error |
| build | PASS |
| migrations-static | **14 PASS** |
| DB integration | N/A (daemon Docker local non prêt) |
| secret scan (diff) | 0 secret / média réel / URL signée / base64 provider |

## 27–28. Provider / Production / flags

```text
REAL_PROVIDER_CALLS_THIS_PHASE = 0
PRODUCTION_STORAGE_WRITES = 0
NEW_RUN_JOB_ATTEMPT = 0
NEW_ASSET_PRODUCTION = 0
LEDGER_WRITES = 0
FLAGS = OFF
RUNTIME_PAID_MEDIA = OFF
VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION = OFF
```

## 29. Documentation

Ce rapport + `00_README` · `101_`–`110_` (pointeur ops) · `02_` · `12_` · `14_` · `15_` · BACKLOG · CHANGELOG · GLOSSARY · CHECKLIST.

## 30. P0 / P1

| Priorité | Item |
|---|---|
| P0 | **ne pas** lancer de nouvelle génération image sans Auth provider distincte |
| P0 | **ne pas** activer / recycler l’asset rejeté `5d68ef64…` |
| P1 fermé | contrat no-text + overlay déterministe WIRED_DISABLED |
| P1 ouvert | preflight retry text-free (nouvelle Auth) — pas d’exécution ici |

## 31. Prochaine porte

```text
NEXT = AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT (no provider)
        — dry-run scene-2 sans texte + overlay spec + nouvelle idempotency key
        — 0 OpenAI jusqu’à Auth provider ultérieure
DO_NOT = exécuter la génération · modifier le REJECT · activer un asset
         · flags ON · fal · Motion · legacy · Storage Production
```
