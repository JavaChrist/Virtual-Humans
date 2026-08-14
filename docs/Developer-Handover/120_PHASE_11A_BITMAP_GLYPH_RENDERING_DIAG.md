# 120 — Phase 11A — Diagnose Bitmap Glyph Rendering

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_DIAGNOSE_BITMAP_GLYPH_RENDERING_NO_PROVIDER_NO_PRODUCTION_MEDIA`  
**Nature :** diagnostic local + correction du moteur typographique bitmap · fixtures synthétiques · **0** provider · **0** média Production  
**HEAD de départ :** `2a586a9` (`119_`)  
**Runtime Production inchangé :** `60cc335`

```text
VERDICT = BITMAP_GLYPH_RENDERING_FIXED_READY_FOR_RECOMPOSITION_PREFLIGHT
PROVIDER_NO_TEXT = PASS
PARENT_PROVIDER = PRESERVED
OLD_COMPOSITOR = VISUAL_FAIL
ROOT_CAUSE = PROVEN
CORRECTION = LOCAL_NOT_DEPLOYED
PROVIDER_CALLS = 0
PRODUCTION_WRITES = 0
PRODUCTION_MEDIA_READ = 0
RUNTIME_PAID_MEDIA = OFF
DETERMINISTIC_OVERLAY_RUNTIME = WIRED_DISABLED
```

---

## 1. Verdict

**`BITMAP_GLYPH_RENDERING_FIXED_READY_FOR_RECOMPOSITION_PREFLIGHT`**

La génération provider no-text reste **PASS**.  
Le parent `7832765d…` reste privé, inactif, réutilisable.  
L’ancien composeur `phase-11a-bitmap-compositor-1.0.0` a produit des glyphes illisibles.  
La cause racine est **prouvée** par un test reproductible : l’atlas n’existait pas — chaque code point était transformé en motif 8×8 pseudo-aléatoire.  
La correction est **locale**, versionnée, **non déployée**. Aucun preflight live n’a encore recomposé le parent.

## 2. Cause racine exacte

`glyphRowsForCodepoint` dans `phase-11a-overlay-font.ts` (composeur **1.0.0**) ne contenait **aucune forme de lettre**.

Pour tout code point non espace, le moteur générait 8 octets via un LCG :

- graine `imul(cp + 1, 0x9e3779b1)` ;
- itération `imul(s, 1664525) + 1013904223` ;
- masque `(s >>> 10) & 0x7e` ;
- barres haut/bas `0x18`.

Le résultat était un bruit déterministe, pas une police.  
`paintGlyph` peignait correctement le bit 7 à gauche : **ce n’était pas** un bug d’ordre de bits, d’UTF-16, de wrap, de contraste ou de fingerprint.

Les tests `111_` / `118_` vérifiaient métadonnées, checksum d’idempotence, fail-closed et QC typographique — **pas** que les pixels formaient `D`, `é` ou `’`.

Le motif Human Review `human.corrupted_overlay_glyphs` (`119_`, décision `f1fcb832…`) est donc la lecture visuelle de ce hash.

Fonction fautive historique : `glyphRowsForCodepoint` (hash).  
La reproduction est conservée sous `legacyHashGlyphRows()` pour prouver que les nouvelles formes ≠ l’ancien motif.

## 3. Hypothèses écartées

| Hypothèse | Verdict |
|---|---|
| Atlas / table de glyphes incorrecte | **cause** — il n’y avait pas d’atlas de formes |
| Indexation code point → glyphe | écartée — le lookup n’existait pas |
| Confusion UTF-16 / octet | écartée — U+2019 est BMP ; `overlayCodepoints` itère des code points |
| Mauvaise gestion U+2019 / accents | secondaire — ils étaient hashés comme le reste |
| Ordre de bits inversé | écartée — MSB-left déjà correct dans `paintGlyph` |
| Largeur / stride / baseline | secondaire — métriques 8×8 monospace cohérentes |
| Échelle / rasterisation | écartée — scale 4 (32/8) correcte |
| Mélange texte / motif | **cause** — le « glyphe » était le motif |
| Corruption peinture RGB | écartée |
| Wrap / chevauchement | écarté pour la corruption ; le CTA wrappait déjà (31×32 > 896) |
| Police déclarée ≠ rendue | écartée — `vhs-overlay-latin-bitmap-v1` était bien le moteur local |
| Tests métadonnées only | **facteur** — n’ont pas détecté le hash |

## 4. Correction appliquée

1. Atlas local `vhs-overlay-latin-bitmap-shapes-v1` dans `phase-11a-overlay-latin-bitmap.ts` : ASCII `0x20–0x7E`, accents FR composés, extras `Œœ‘’«»€`, U+2019 dédié.
2. `glyphRowsForCodepoint` = lookup atlas. Glyphe absent → `overlay_glyph_unsupported:U+…` fail-closed. Aucun fallback silencieux, aucune substitution d’apostrophe.
3. `measure` / `measureOverlayTextWidth` comptent des **codepoints**, pas `text.length`.
4. Composeur bumpé `phase-11a-bitmap-compositor-1.1.0`. Le fingerprint overlay reste `fdfae63fe1c7d003…` (`fontFamily` inchangé).
5. Tests pixels + golden synthétique + script de preview gitignoré.

Décision police : **conserver** une bitmap 8×8 locale déterministe (pas de police distante, pas de dépendance native). Lisibilité 8×8 monospace assumée ; ce n’est plus du bruit.

## 5. Couverture Unicode exacte

Chaînes exactes (aucune mutation) :

- titre `De l’idée à la structure` (U+2019) ;
- CTA `Découvrir Virtual Humans Studio` ;
- sous-titre / légal absents.

Code points uniques requis (23) :

`U+0020` espace · `U+0044` D · `U+0048` H · `U+0053` S · `U+0056` V · `U+0061` a · `U+0063` c · `U+0064` d · `U+0065` e · `U+0069` i · `U+006C` l · `U+006D` m · `U+006E` n · `U+006F` o · `U+0072` r · `U+0073` s · `U+0074` t · `U+0075` u · `U+0076` v · `U+00E0` à · `U+00E9` é · `U+2019` ’.

Chacun est reconnu, pointe vers un glyphe distinct, a une avance 32 px à taille 32, et est peint sans fallback.  
`你好` → `overlay_glyph_unsupported`. U+2019 ≠ U+0027. `é` ≠ `e`. `à` ≠ `a`.

## 6. Accents et U+2019

- `é` / `à` : base `e`/`a` + rangée d’accent (aigu `0x0c`, grave `0x30`) sur la ligne 0.
- U+2019 : forme dédiée `18180800…` (tick), distincte de `'` ASCII.
- Aucun remplacement silencieux dans le spec ni dans le composeur.

## 7. Preuve pixels / golden

Tests `phase-11a-bitmap-glyph-rendering.test.ts` :

- glyphes sensibles `D e l i d é à ’ V H S` : pixels distincts, avance 32, pas de collision ;
- titre / CTA / overlay complet : chaque cellule 8×8 extraite du PNG **égale** à l’atlas ;
- golden synthétique (grille 0x3a/0x52, spec scene-2 exacte, bold 32) composé deux fois : mêmes pixels, mêmes boxes, pas de troncature, dans la safe area.

Checksum golden figé :

`9dec964f3103cfcbd255f3583793d5fbf82688cb4573764408cc2e522e417c78`

Pas de média Production dans la fixture. Taille raisonnable via hash, pas un PNG versionné.

## 8. Contrôle visuel local

Script : `studio/scripts/phase-11a-bitmap-glyph-diag-local.mjs`  
Sortie **gitignorée** : `studio/.tmp/phase-11a-glyph-diag/`

| Fichier | Rôle |
|---|---|
| `overlay-full.png` | overlay complet sur grille synthétique |
| `glyph-atlas.png` | planche locale des glyphes |
| `title-cta-crop.png` | crop titre + CTA (élargi aux lineBoxes) |
| `summary-redacted.json` | métadonnées sans URL / secret |

Checksum preview (grille **différente** 0x2c/0x3d, ne pas confondre avec le golden) : `93146d66cf844344…`.

Lecture visuelle de `title-cta-crop.png` : les mots sont **lisibles**. Titre complet sur une ligne. CTA wrappé `Découvrir Virtual Humans` / `Studio`. Accents `é`/`à` visibles. U+2019 rendu comme tick. Plus de bruit hash.  
Un premier crop trop étroit (640 px) coupait `structure` / `Humans` — bug du script de preview, **pas** du composeur ; crop élargi ensuite.

## 9. Invariants préservés

`no_text` · overlay déterministe local · 0 réseau · 0 téléchargement de police · provenance parent/enfant · idempotence · `active=false` · Human Review obligatoire.  
Aucun texte réintroduit dans le prompt OpenAI. Aucune image de texte. Aucun accent retiré. U+2019 non remplacé. Aucune dépendance native.

Assets Production **non lus / non écrits** : `7832765d…` · `6a2beca9…` · `5d68ef64…`. REJECT `f1fcb832…` inchangé.

## 10. Limites restantes

- Bitmap 8×8 monospace : lisible mais crénelage / avance large.
- Bold = décalage +1 px, pas un second atlas.
- CTA wrappé (31×32 = 992 > largeur utile 896) — attendu, overflow `reject` non déclenché (`maxLines` ≥ 3).
- Correction **non déployée** : runtime Production reste `60cc335` / composeur 1.0.0 jusqu’au preflight live.
- Pas de recomposition Production cette phase.
- QC auto ≠ validation humaine ; OCR toujours `unavailable_humanOnly`.

## 11. Tests

| Check | Résultat |
|---|---|
| Glyphes / police / composeur | 5/5 PASS |
| Overlay + QC typo + PNG + strip + guards 11A | 55/55 PASS |
| Storage / resume / allowlist / HR / migrations-static | 48/48 PASS |
| Unitaires complets | **1604/1604** |
| Typecheck | PASS |
| Lint (fichiers de phase) | 0 error |
| Build | PASS |
| Freshness living handover | PASS (après MAJ) |
| Secret scan diff | PASS |

## 12. Documentation

Ce rapport · `CURRENT_STATE_AND_RESUME.md` · `00_README` · BACKLOG · CHANGELOG **2.0.143** · CHECKLIST · `02_` / `12_` / `14_` / `15_` · GLOSSARY · pointeur `119_`.

## 13. Commit / push

Commit/push normal `main` après suite verte. Pas de force push. Pas de deploy manuel. Pas d’ouverture de flags.  
Les PNG `.tmp` ne sont **pas** versionnés.

## 14. Prochaine autorisation

**`AUTH_11A_CORRECTED_OVERLAY_RECOMPOSITION_PREFLIGHT_NO_PROVIDER`** — **consommée** (`121_`).

Suivi : [`121_PHASE_11A_CORRECTED_OVERLAY_RECOMPOSITION_PREFLIGHT.md`](./121_PHASE_11A_CORRECTED_OVERLAY_RECOMPOSITION_PREFLIGHT.md) · verdict **`READY_FOR_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION`**.  
Prochaine Auth : **`AUTH_11A_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION`**.
