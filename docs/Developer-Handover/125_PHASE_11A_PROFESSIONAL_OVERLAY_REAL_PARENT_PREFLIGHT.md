# 125 — Phase 11A — Professional Overlay Real Parent Preflight

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_PROFESSIONAL_OVERLAY_REAL_PARENT_PREFLIGHT_NO_PROVIDER`  
**Nature :** lecture unique du parent · composition **1.2.0 mémoire ×2** · preview locale gitignorée · **0** OpenAI · **0** écriture Production  
**Source applicative :** `d395ec7d8c9ce33ab39974764de3b83a0ca670ce` (`d395ec7`)

```text
VERDICT = PROFESSIONAL_OVERLAY_REAL_PARENT_PREFLIGHT_READY_FOR_HUMAN_VISUAL_DECISION
SOURCE_COMMIT = d395ec7
DEPLOY = none_local_compositor
PROVIDER_CALLED = false
SIGNED_URL_COUNT = 1
SIGNED_URL_TTL = 60
DOWNLOADS = 1
COMPOSITOR = phase-11a-vector-compositor-1.2.0
FONT = vhs-overlay-latin-vector-v1
LAYOUT = phase-11a-overlay-layout-1.2.0
PANEL = phase-11a-contrast-panel-1.2.0
DETERMINISTIC_PAIR = true
PRODUCTION_STORAGE_WRITE = false
COMPOSED_ASSET_CREATED = false
HUMAN_REVIEW = 0
LEDGER = 274/249/0/25
RUNTIME_PAID_MEDIA = OFF
```

---

## 1. Verdict

**`PROFESSIONAL_OVERLAY_REAL_PARENT_PREFLIGHT_READY_FOR_HUMAN_VISUAL_DECISION`**

Le parent `7832765d…` a été lu **une fois**, décodé (filtres PNG **1–4**), puis composé **deux fois en mémoire** avec le composeur vectoriel **1.2.0** du commit `d395ec7`.  
Le rendu est stable, distinct des rejets historiques, et **présentable pour un jugement visuel humain**.  
Ce preflight **n’est pas** une approbation de Christian.

## 2. SHA applicatif

`d395ec7d8c9ce33ab39974764de3b83a0ca670ce`  
HEAD local = origin/main au moment du preflight.  
`245bea2` n’est **pas** la preuve du composeur 1.2.0.

## 3. Déploiements

**Aucun.** Composition locale depuis `d395ec7`. Overlay execution déjà UNAVAILABLE. Aucun flag ouvert.

## 4. Parent vérifié

`7832765d…` · checksum `1ac51f484420ef88…` · PNG 1024×1024 · 1 131 237 o · `pending_review` · `active=false` · inchangé.  
`4429654f…` / `058faa7d…` · `6a2beca9…` / `f1fcb832…` · `5d68ef64…` : **non lus, non signés, inchangés**.

## 5–6. URL / téléchargement

Count **1** · TTL **60 s** · HTTPS · MIME `image/png` · max 8 MiB · 1 download.  
URL **mémoire seulement** — absente de DB, logs, Git, rapport et `.tmp` versionné.  
Buffer parent remis à zéro après composition.

## 7. Versions

| | |
|---|---|
| Font | `vhs-overlay-latin-vector-v1` |
| Outlines | `vhs-overlay-latin-vector-outlines-v1` |
| Licence | `original-work-in-repo` |
| Composeur | `phase-11a-vector-compositor-1.2.0` |
| Layout | `phase-11a-overlay-layout-1.2.0` |
| Panneau | `phase-11a-contrast-panel-1.2.0` |
| 1.1.0 | `phase-11a-bitmap-compositor-1.1.0` intact |

## 8. Checksum futur

`9ac484b7a1db3264330ee09ddcb197fa8d83e6735a3476c7af5ab1547ff317f0`  
Taille 1 338 305 o · 1024×1024.  
≠ parent `1ac51f48…` · ≠ 1.0.0 `d056b85a…` · ≠ 1.1.0 `b284e877…`.

## 9. Future identité (non créée)

Fingerprint préfixe `49284892d6bac249…` · assetId préfixe `49284892…` · overlay FP `4cfcc445f41ca453…`.  
`created=false`.

## 10. Déterminisme

Deux compositions sur le même buffer : mêmes pixels, checksum, boxes, lignes, tailles 40/22, contraste. **0** second téléchargement.

## 11. Métriques

Titre **40** · CTA **22** · LH 1.12 / 1.20 · tracking CTA 8/1000 em.

## 12. Lignes / anti-orphelin

Titre 1 ligne `De l’idée à la structure`.  
CTA 1 ligne `Découvrir Virtual Humans Studio`.  
`Studio` non isolé.

## 13. Contraste / panneaux

Contraste **14.67** (≥ 4.5).  
Panneaux 488×72 et 404×54 — compact, pas de bandeau pleine largeur.  
Safe area `{ top:640, right:72, bottom:56, left:72 }`.

## 14–15. QC

Technique : PNG décodable · 1024×1024 · checksum cohérent · 0 URL/base64 persistée.  
Typographique : `accepted` · copy exacte · font/outlines/layout · anti-orphelin · safe areas.  
OCR : `unavailable_humanOnly`. Human Review future obligatoire. Aucun quality report Production.

## 16. Inspection visuelle Cursor

| # | Critère | Constat |
|---|---|---|
| 1–2 | Lisibilité titre / CTA | Oui |
| 3–4 | `é` `à` U+2019 | Corrects |
| 5–6 | Pixellisation / contours | Anti-aliasés, nets |
| 7–8 | Espacement / kerning | Proportionnel, régulier |
| 9 | Hiérarchie | Titre > CTA |
| 10–11 | Wrap / orphelin | CTA 1 ligne · pas d’orphelin |
| 12–13 | Panneaux / contraste | Discrets · 14.67 |
| 14–16 | Safe / clip / artefacts | Respectés · aucun clip visible |
| 17–18 | Intégration / professionnel | Sujet blueprint préservé · présentable |

**Pas une approbation humaine finale.**

## 17–18. Preview locale

Chemin absolu :

`C:\Users\JavaChrist\Desktop\virtual-humans\studio\.tmp\phase-11a-professional-overlay-real-parent-preflight\overlay-full.png`

Gitignorée · non uploadée · non versionnée. Image jointe dans le retour Cursor.

## 19–23. Isolation

Storage writes **0** · nouveaux assets/artifacts/HR **0** · ledger **274/249/0/25** · OpenAI/fal **0** · flags OFF · worker OFF · Motion UNAVAILABLE.

## 24. Tests

Unitaires **1620/1620** · typecheck PASS · lint 0 error · build PASS · secret scan PASS · fraîcheur PASS.

## 25–27. Docs / Git / living

Rapport `125_` · living handover mis à jour **avant** commit.  
Commit/push `main` autorisés (scripts + docs). Preview hors Git.

## Porte suivante

Décision humaine explicite : `ACCEPT_PREFLIGHT_VISUAL` ou `REJECT_PREFLIGHT_VISUAL`.  
Une acceptation pourra autoriser `AUTH_11A_PROFESSIONAL_OVERLAY_RECOMPOSITION_EXECUTION` (1 asset privé inactif, 0 OpenAI).
