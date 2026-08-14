# 124 — Phase 11A — Overlay Typography and Layout Improvement

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_IMPROVE_OVERLAY_TYPOGRAPHY_LAYOUT_NO_PROVIDER_NO_PRODUCTION_MEDIA`  
**Nature :** audit + composeur local 1.2.0 + fixtures synthétiques · **0** OpenAI · **0** média Production · **0** write distant

```text
VERDICT = OVERLAY_TYPOGRAPHY_LAYOUT_IMPROVED_READY_FOR_REAL_PARENT_PREFLIGHT
COMPOSITOR = phase-11a-vector-compositor-1.2.0
LAYOUT = phase-11a-overlay-layout-1.2.0
FONT = vhs-overlay-latin-vector-v1
PROVIDER_CALLS = 0
PRODUCTION_WRITES = 0
PRODUCTION_MEDIA_READS = 0
ASSETS_UNCHANGED = 4
FLAGS = UNCHANGED
LEDGER = 274/249/0/25
RUNTIME_PAID_MEDIA = OFF
```

---

## 1. Verdict

**`OVERLAY_TYPOGRAPHY_LAYOUT_IMPROVED_READY_FOR_REAL_PARENT_PREFLIGHT`**

Le composeur **1.1.0** reste historiquement reproductible et **rejeté** pour typo/layout.  
Une version **1.2.0** locale, déterministe, sans nouvelle dépendance, rend la copy française exacte avec une hiérarchie titre/CTA, un CTA d’une ligne, des panneaux compacts et un contraste ≥ 4.5.  
L’inspection visuelle sur fixtures synthétiques justifie un futur preflight sur le parent réel — **sans** le préparer dans cette phase.

Les quatre assets et toutes les décisions Human Review restent **inchangés**.

## 2. Cause des défauts 1.1.0

| Défaut HR `058faa7d…` | Cause technique 1.1.0 |
|---|---|
| Police fortement pixelisée | Atlas 8×8 `vhs-overlay-latin-bitmap-v1` agrandi en nearest-neighbor |
| Espacement excessif | Avance monospace = `fontSize` pour chaque glyphe |
| Bandeaux noirs massifs | Rectangles pleins `#1A1F2B` pleine largeur de safe area |
| CTA déséquilibré / `Studio` isolé | Même corps titre/CTA + wrap greedy dans `top:720` |
| Hiérarchie faible | `fontSize` unique 32 pour titre et CTA |
| Intégration artificielle | Aplats opaques, look terminal/prototype |

Le chemin **1.1.0** n’a **pas** été muté. Checksum historique `b284e877…` / asset `4429654f…` restent reproductibles.

## 3. Alternatives évaluées

| Option | Disponible localement | Décision |
|---|---|---|
| Bitmap 8×8 + layout seul | oui | **écartée** — reste visiblement pixelisée |
| Fontes WOFF/TTF/OTF du dépôt | **aucune** | écartée |
| `next/font` / Geist | **non utilisées** dans le repo | écartée — téléchargement interdit |
| Police système Windows | oui mais non versionnée | **interdite** Production |
| `sharp` comme moteur texte | devDependency icônes seulement | écartée — pas un moteur glyphe |
| `canvas` / `opentype` / `fontkit` | **non installés** | écartées — nouvelle dep non nécessaire |
| Atlas bitmap HD dessiné | possible | écarté — trop lourd / encore bitmap |
| Moteur vectoriel local (strokes + coverage) | oui, zéro dep, Node/CI/Vercel | **retenue** |

Aucune fonte ni dépendance n’a été téléchargée.

## 4. Solution retenue

Moteur **vectoriel géométrique original** versionné dans le dépôt :

- contours déterministes (segments, anneaux, arcs via table unitaire 64 pas) ;
- rasterisation coverage 2× + anti-alias SDF local ;
- avances proportionnelles + kerning borné ;
- fail-closed `overlay_glyph_unsupported` ;
- aucun fallback système, aucun réseau.

Justification : seule option professionnelle **et** portable (Windows, CI, Vercel, Node) sans artefact natif ni licence tierce.

## 5. Police / version / provenance / licence

| Champ | Valeur |
|---|---|
| Famille | `vhs-overlay-latin-vector-v1` |
| Outlines | `vhs-overlay-latin-vector-outlines-v1` |
| Licence | `original-work-in-repo` |
| Provenance | `phase-11a-overlay-latin-vector.ts` uniquement |
| Glyphes | ASCII + chiffres + accents FR + U+2019 |
| Historique | `vhs-overlay-latin-bitmap-v1` conservée, **non** présentée Production |

## 6. Composeur et layout

| Élément | Version |
|---|---|
| Composeur nouveau | `phase-11a-vector-compositor-1.2.0` |
| Layout | `phase-11a-overlay-layout-1.2.0` |
| Panneau contraste | `phase-11a-contrast-panel-1.2.0` |
| Composeur 1.1.0 | `phase-11a-bitmap-compositor-1.1.0` **inchangé** |
| Composeur 1.0.0 | isolé via `legacyHashGlyphRows` |

Copy inchangée : locale `fr` · titre `De l’idée à la structure` (U+2019) · CTA `Découvrir Virtual Humans Studio` · pas de sous-titre/légal.

L’identité de composition change via famille + composeur + layout (fingerprint ingest distinct de `4429654f…`).

## 7. Métriques

- Titre 40 / 36 / 32 (réduction bornée) · LH 1.12 · tracking 0
- CTA 22 / 20 / 18 · LH 1.20 · tracking 8/1000 em
- Hiérarchie forcée : CTA < titre
- Kerning : paires `AV`, `VA`, `To`, `Té`, `L’`, `’i`, `De`
- Avance proportionnelle (ex. `M` > `I`)
- Gap blocs 22 · pad panneau 18×16

## 8. Wrap

Greedy word-wrap sur largeur utile = safe area − 2× pad.  
Refus : token insécable, `maxLines` 4, hauteur safe area.  
Aucune troncature, aucun clipping de glyphe encré.

Sur la copy exacte à 1024×1024 : **titre 1 ligne**, **CTA 1 ligne**.

## 9. Anti-orphelin

Si la dernière ligne n’a qu’un mot, le dernier mot de la ligne précédente est rattaché si les deux lignes tiennent.  
Si la dernière ligne CTA reste `Studio` → `overlay_overflow:orphan_word`.

## 10. Contraste

Politique `phase-11a-contrast-panel-1.2.0` :

- gradient bas 300 px, alpha max 0.42 (quadratique) ;
- panneau compact semi-transparent `#141820` par ligne (pas de bandeau pleine largeur) ;
- alpha adaptatif local 0.50–0.86, pas 0.02, calculé sur la luminance moyenne de la région (après gradient) ;
- cible interne 5.0 · contrat ≥ 4.5 ;
- mesuré : grille **12.37** · clair **5.13**.

Aucun analyseur provider distant.

## 11. Safe areas

`{ top: 640, right: 72, bottom: 56, left: 72 }` · canvas 1024.  
Régions titre puis CTA, centrées, largeur max = box − pads.  
Overflow / collision / clip → fail-closed.  
Le sujet visuel du fond synthétique reste dans les 640 px supérieurs.

## 12. Comparaison visuelle 1.1.0 / 1.2.0

Inspection réelle des PNG gitignorés `studio/.tmp/phase-11a-overlay-1.2.0/` :

| Critère | 1.1.0 (même fixture grille) | 1.2.0 |
|---|---|---|
| Police | bitmap 8×8 pixelisée | vectorielle anti-aliasée |
| CTA | wrap + `Studio` orphelin | une ligne complète |
| Hiérarchie | même corps | titre > CTA |
| Fond | bandeaux noirs pleins | panneaux + gradient |
| Espacement | monospace large | proportionnel + kerning |

Le nouveau rendu est **matériellement** meilleur : lisible, hiérarchisé, sans orphelin, sans aplat noir disproportionné.

## 13. Fonds synthétiques

| Fixture | Résultat |
|---|---|
| Uni sombre | lisible · contraste élevé |
| Uni clair | lisible · alpha panneau relevé · 5.13 |
| Contraste variable | déterministe · QC accepté |
| Grille scene-2-like | layout scene-2 · sujet haut libre |

## 14. Accents / U+2019

Titre exact conservé. Glyphes `é`, `à`, U+2019 présents et peints. Caractère hors set (`你好`) → fail-closed.

## 15. Déterminisme

Mêmes PNG d’entrée → mêmes pixels, checksum, boxes, lignes, tailles, contraste.  
Pas de date, URL, secret, font système, réseau. Table trigonométrique fixe 64 pas.

## 16. Checksums golden (fixtures synthétiques)

| Image | SHA-256 |
|---|---|
| 1.2.0 grille | `6bf3bc9dbe1912ba47eede1aa5a197980d81893372e1af9dd393d35bd365d2a7` |
| 1.2.0 sombre | `59a39655032fd30e3017333ba1b69e0b0e257f5982a918ddefb116e5b4438b10` |
| 1.2.0 clair | `7fb4b49be1a09b9402caf4003daa920ee4129c34f898a9dd556da8b5815bfc29` |
| 1.2.0 variable | `eeffd35ac67857f2e3871eb17234a19769074e470bea6ada63cce6ddcf4c65f9` |
| 1.1.0 même grille (isolement) | `f4aedba5244ceade99b89673632a8f778a8e5568506e508d59d6e9ef598a2d80` |

Aucun média Production.

## 17. QC étendu

`validatePhase11ATypographicQc` contrôle désormais : famille allowlistée, match spec, copy, line-breaks (recomposition des boxes), safe areas, contraste, et pour 1.2.0 : orphelin, hiérarchie, surface panneau ≤ 0.14, provenance composeur.  
Les tests 1.1.0 restent **accepted**.

## 18. Limites restantes

- Face géométrique originale, pas une police retail licenciée.
- Certains glyphes restent stylisés (`s`, jonctions `e`/`a`).
- Runtime Production image reste **`245bea2` / composeur 1.1.0** — 1.2.0 n’est **pas** branché sur l’execution distante.
- Human Review reste obligatoire. Aucune session/décision créée.
- Un preflight parent réel exige une Auth distincte.

## 19–21. Isolation Production

| Invariant | Preuve |
|---|---|
| Média Production | 0 lecture · 0 URL signée |
| Provider calls | **0** |
| Writes DB/Storage/ledger | **0** |
| Assets `7832765d…` `4429654f…` `6a2beca9…` `5d68ef64…` | inchangés |
| Flags / runtime | OFF · inchangés |
| Motion / legacy | non touchés |

## 22. Tests

| Check | Résultat |
|---|---|
| Unitaires | **1618/1618** |
| Police / métriques / wrap / orphelins / layout / contraste / safe / overflow / déterminisme / QC | PASS |
| 1.0.0 / 1.1.0 isolés | PASS |
| Ingest mémoire idempotent | PASS · 0 write réel |
| Guards 11A | PASS |
| Typecheck | PASS |
| Lint (fichiers de phase) | 0 error |
| Build | PASS |
| Secret scan diff | 0 secret / URL / média Production / base64 |
| Fraîcheur living handover | PASS |

## 23. Documentation

Rapport `124_` · living handover · `00_` · `02_` · `12_` · `14_` · `15_` · BACKLOG · CHANGELOG 2.0.147 · CHECKLIST · GLOSSARY.

## 24. Git

Commit + push `main` autorisés après preuves. Pas de force push. Pas de déploiement manuel.

## 25. Living handover

Mis à jour **avant** le commit de clôture.  
Prochaine porte : `AUTH_11A_PROFESSIONAL_OVERLAY_REAL_PARENT_PREFLIGHT_NO_PROVIDER`.
