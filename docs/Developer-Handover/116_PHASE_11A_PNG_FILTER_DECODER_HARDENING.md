# 116 — Phase 11A — Harden PNG Filter Decoder

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_HARDEN_PNG_FILTERS_NO_PROVIDER_NO_PRODUCTION_MEDIA`  
**Nature :** correctif décodeur PNG filtres 0–4 · fixtures synthétiques · **0** provider · **0** média Production  
**Source runtime inchangée :** `e4c3de3279aaaefc4db46cbfac00ac9e79d298f8` (`e4c3de3`)  
**HEAD documentaire au départ :** `f891d5f`

```text
VERDICT = READY_FOR_EXISTING_PROVIDER_ASSET_COMPOSITION_PREFLIGHT
PROVIDER_AUTH_CONSUMED = YES (115_ — not reused)
PROVIDER_CALLED = 0
PROVIDER_ASSET_READ = false
COMPOSED_ASSET = NONE
PRODUCTION_STORAGE_WRITE = false
PNG_FILTERS_SUPPORTED = 0,1,2,3,4
DECODER_STRATEGY = internal_decodeRgbPng
RUNTIME_PAID_MEDIA = OFF
DETERMINISTIC_OVERLAY_RUNTIME = WIRED_DISABLED
```

---

## 1. Verdict

**`READY_FOR_EXISTING_PROVIDER_ASSET_COMPOSITION_PREFLIGHT`**

`decodeRgbPng` accepte désormais les filtres PNG **0–4** (None, Sub, Up, Average, Paeth) conformément à la spécification.  
Le composeur déterministe reconstitue les **mêmes pixels** quel que soit le filtre d’entrée, puis écrit un PNG composé filtre 0.  
**Aucun** appel OpenAI. **Aucune** lecture ni écriture de l’asset Production `7832765d…`. **Aucun** asset composé créé.

## 2. Commit / push

Commit/push normal `main` après suite verte. Pas de force push. Pas de deploy manuel. Pas d’ouverture de flags.  
Le runtime applicatif Production reste **`e4c3de3`** jusqu’à un futur promote explicite.

## 3. SHA applicatif

Le correctif décodeur **change** le SHA Git applicatif (nouveau commit).  
Il **ne change pas** le runtime Production tant qu’aucun promote/redeploy n’est autorisé.  
Fingerprint composition routing `c532c400334f5b22` inchangé.

## 4. Cause PNG (sans relecture média)

Diagnostic redacted `115_` / diag post-paid (ne pas relancer) :

| Champ | Valeur |
|---|---|
| Signature PNG | OK |
| bitDepth | 8 |
| colorType | 2 (RGB truecolor) |
| Dimensions | 1024×1024 |
| Erreur | `png: unsupported filter` |
| Cause | `decodeRgbPng` n’acceptait que le filtre scanline **0** |
| Filtre exact 1–4 | **non relis** cette phase (interdit) |

Le PNG OpenAI est RGB 8-bit non palettisé. Le filtre par scanline n’est pas 0 partout.

## 5. Stratégie librairie

Audit préalable :

| Option | Décision |
|---|---|
| `sharp` | **écartée** — `devDependency` native, pas le runtime composeur, pas déterministe pour ce contrat |
| `pngjs` / autre PNG | **absente** du `package.json` |
| Nouvelle dépendance | **refusée** — pas d’audit licence/taille/build justifié |
| `decodeRgbPng` interne | **retenue** — zlib Node, pas de réseau, pas de binaire natif, limites configurables |

Encode composé : filtre 0, zlib level 9, pas de `tIME` ni métadonnée variable.

## 6. Filtres supportés

`0` None · `1` Sub · `2` Up · `3` Average · `4` Paeth.  
Filtre `> 4` → `Phase11APngError` `unknown_filter` (`png: unsupported filter`).  
Reconstruction ligne par ligne après inflate IDAT, modulo 256, `bpp=3`.

## 7. Formats supportés

**Accepté :** PNG · 8-bit · truecolor RGB (`colorType=2`) · non interlacé · dimensions ≤ 1024×1024.

**Refusé (typé, pas d’élargissement silencieux) :**

- RGBA (`rgba_unsupported`) — le composeur travaille en RGB
- grayscale / gray-alpha
- palette indexée
- profondeur ≠ 8
- Adam7
- chunk critique inconnu
- CRC invalide
- IDAT tronqué / taille inflatée inexacte
- dimensions nulles ou hors bornes

## 8. Interlacing

Adam7 **rejeté** (`interlaced_unsupported`). Non implémenté, non testé comme support.

## 9. Limites sécurité

| Limite | Valeur |
|---|---|
| Fichier encodé | 8 MiB |
| Largeur / hauteur | 1024 |
| Pixels | 1 048 576 |
| Décompressé | `(w×3+1)×h` borné à 3 146 752 |
| Ratio inflate | 1 048 576 (secondaire ; la borne IHDR prime) |
| Overflow | multiplications `Number.isSafeInteger` |
| Réseau / chemin | aucun |
| Logs | aucun pixel, IDAT, base64, URL |

CRC validé sur chaque chunk. Chunks ancillaires ignorés. `PLTE` ignorée (RGB).

## 10. Décompression bomb

IHDR lu **avant** inflate. Taille attendue calculée. `inflateSync({ maxOutputLength: expected })`.  
Dimensions hostiles et IDAT trop courts rejetés. Ratio excessif → `decompression_bomb`.

## 11. Paeth

`paethPredictor(a,b,c)` conforme PNG : `p=a+b-c`, plus proche de left / up / up-left.  
Première ligne : up = up-left = 0. Première colonne : left = up-left = 0.

## 12. Scanlines

Longueur exacte `(width×3+1)×height`. Trop court / trop long → `scanline_length` ou `inflated_size_mismatch`.

## 13. Déterminisme pixels

Même matrice RGB pour filtres 0, 1, 2, 3, 4 et mixte. Prouvé sur fixtures 8×8 / 16×8 et canvas 1024.

## 14. Déterminisme composeur

Même overlay + mêmes pixels → même PNG composé (filtre 0) → même checksum.  
Replay ingest mémoire : même `assetId` dérivé, `wrote=false` au second passage.  
Pas de timestamp dans l’encode.

## 15. Fixtures

Synthétiques uniquement, générées en mémoire (`encodeRgbPngWithRowFilters`).  
Aucun média Production dans le dépôt. Cas : filtres 0–4, mixte, RGB, première ligne/colonne, modulo 256, Paeth limites, tronqué, filtre 5, dimensions hostiles, bomb, gray/indexed/RGBA/Adam7/16-bit, CRC, chunk critique.

## 16. Overlay français

Copy exacte : locale `fr` · titre `De l’idée à la structure` (U+2019) · CTA `Découvrir Virtual Humans Studio` · police `vhs-overlay-latin-bitmap-v1`.  
FP overlay inchangé `fdfae63fe1c7d003…`. QC typographique `accepted` sur fixtures. Overflow/contraste toujours fail-closed.

## 17. Runtime

Node + `zlib` sync. Pas de Canvas, pas de Browser, pas de `sharp` en Production.  
Build Next.js 16.2.10 Turbopack **PASS**. Compatible Vercel serverless.

## 18. Ancien asset

`5d68ef64…` · `rejected` · `active=false` · **non lu, non modifié**.

## 19. Provider asset

`7832765d…` · checksum `1ac51f484420ef88…` · `pending_review` · `active=false` · **non lu, non modifié**.  
Futur composed = nouvel enfant de `7832765d…` — **non créé**.

## 20. Dry-run local

`runPhase11APngFilterDecoderDryRun` + `scripts/phase-11a-png-filter-decoder-dry-run.mjs` :

| Flag | Valeur |
|---|---|
| pngFiltersSupported | 0,1,2,3,4 |
| providerAssetRead | false |
| providerCalled | false |
| compositorExecutable | true |
| overlaySpecValid | true |
| deterministicChecksum | true |
| ProductionStorageWrite | false |
| HumanReviewRequired | true |

## 21. Futur preflight

Script préparé : `scripts/phase-11a-compose-existing-provider-preflight.mjs`.  
**Non exécuté.** `--execute` refuse (`not authorized`).  
Plan : vérifier l’asset exact → signed URL éphémère mémoire → télécharger l’unique PNG → décoder/composer mémoire → vérifier → 0 écriture → fermer les gates.

## 22. État run futur (lecture seule)

Run `39329a01…` : colonne `running` · `waitingReason=needs_review`.  
Job `edc6e84a…` : `completed`. Provider asset présent. Composition manquante.  
Après future composition (Auth suivante) : QC typographique · Human Review seedée **sans** décision · run en attente humaine · **pas** de succès/activation automatiques.  
**Aucune** écriture run/job/ledger cette phase.

## 23. Tests ciblés

PNG decoder 12 · composeur/overlay/typo · strip overlay · worker · migrations-static 14 · freshness · dry-run local. **PASS**.

## 24. Tests unitaires

**1590/1590 PASS.**

## 25. Typecheck / lint / build

`tsc --noEmit` PASS · lint **0 error** (warnings préexistants) · `next build` PASS.

## 26. Secret scan

Diff : 0 secret, 0 URL signée, 0 base64 média, 0 pixel, 0 clé. Living handover sans hit.

## 27. Provider / Production writes

0 OpenAI · 0 fal · 0 Motion · 0 signed URL · 0 Storage · 0 asset insert · 0 run/job/ledger · 0 HR.

## 28. Flags / runtime

Paid Media / VHS-124 / worker / Motion / Director Paid AI : **OFF**.  
Runtime overlay : **WIRED_DISABLED**. Runtime Production : **e4c3de3**.

## 29. Auto-deploy

Push `main` peut déclencher un auto-deploy. Observation lecture seule seulement. **Ne pas** promouvoir ce commit comme preuve runtime avant vérif Vercel.

## 30. Documentation

Ce rapport · living handover · `00_README` · `115_` (pointeur) · `14_` / `15_` / `02_` · BACKLOG · CHANGELOG 2.0.139 · GLOSSARY · CHECKLIST.

## 31. P0 / P1

**P0 :** pas de 3ᵉ OpenAI ; ne pas lire/activer `5d68ef64…` ni `7832765d…` ; ne pas décider HR.

**P1 fermé :** support filtres PNG 0–4 + limites + tests synthétiques.

**P1 ouverts :** preflight puis composition de `7832765d…` (0 OpenAI) ; refermer le run `39329a01` ; chemin Storage 6-seg worker.

## 32. Prochaine autorisation exacte

**`AUTH_11A_COMPOSE_EXISTING_PROVIDER_PNG_FILTERS`** — **consommée** (`117_`).

Preflight live : [`117_`](./117_PHASE_11A_EXISTING_PROVIDER_ASSET_COMPOSITION_PREFLIGHT.md) · execution : [`118_`](./118_PHASE_11A_EXISTING_PROVIDER_ASSET_COMPOSITION_EXECUTION.md) · **COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING**.  
Prochaine Auth : **`AUTH_11A_COMPOSED_ASSET_PRIVATE_PREVIEW`**.  
0 troisième appel OpenAI. 0 fallback. 0 Motion.
