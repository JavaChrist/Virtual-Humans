# 121 — Phase 11A — Corrected Overlay Recomposition Preflight

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_CORRECTED_OVERLAY_RECOMPOSITION_PREFLIGHT_NO_PROVIDER`  
**Nature :** deploy contrôlé `245bea2` · lecture unique du parent · composition **mémoire seulement** ×2 · **0** OpenAI · **0** écriture Storage/DB  
**Source runtime :** `245bea2152d29ff158197a946bf5856b3055b929` (`245bea2`)

```text
VERDICT = READY_FOR_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION
SOURCE_COMMIT = 245bea2
PROVIDER_CALLED = false
PROVIDER_ASSET_READ = true
PROVIDER_ASSET_CHECKSUM_MATCH = true
PNG_DECODED = true
PNG_FILTERS_ENCOUNTERED = 1,2,3,4
COMPOSITOR = phase-11a-bitmap-compositor-1.1.0
ATLAS = vhs-overlay-latin-bitmap-shapes-v1
LEGACY_LCG_SELECTED = false
COMPOSITION_SUCCEEDED = true
DETERMINISTIC_PAIR = true
TITLE_EXACT = true
CTA_EXACT = true
VISUAL = PASS
PRODUCTION_STORAGE_WRITE = false
COMPOSED_ASSET_CREATED = false
HUMAN_REVIEW_DECISIONS = 0
RUNTIME_PAID_MEDIA = OFF
```

---

## 1. Verdict

**`READY_FOR_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION`**

Le parent `7832765d…` a été lu une fois, décodé (filtres PNG **1–4**), puis composé **deux fois en mémoire** avec le composeur **1.1.0** et l’atlas `shapes-v1`.  
Titre et CTA sont **lisibles**. Checksum corrigé distinct du parent et du composé rejeté. Aucune écriture Production. Aucun nouvel asset.

## 2. SHA runtime / déploiements

| | |
|---|---|
| SHA exigé | `245bea2152d29ff158197a946bf5856b3055b929` |
| Alias avant lecture | Ready `245bea2` |
| ON | `virtual-humans-qokxs3ckr-…` · même SHA |
| OFF | `virtual-humans-8un7uflj1-…` · même SHA |
| Root / gates | `studio` · OpenAI/VHS-124/worker/Motion **écrits à 0** |

Première tentative : STOP `required codepoints 22` (le living `120_` comptait 23 par erreur). Fermeture OFF effectuée. Seconde tentative : PASS.  
`60cc335` n’a **pas** servi de preuve applicative.

## 3. Atlas / LCG

`glyphRowsForCodepoint` → `bitmapGlyphRows` (atlas `vhs-overlay-latin-bitmap-shapes-v1`).  
Chaque glyphe requis ≠ `legacyHashGlyphRows()`. LCG historique **non sélectionné** sur le chemin runtime.

## 4. Intégrité parent

`7832765d…` · checksum `1ac51f484420ef88…` · PNG 1024×1024 · 1 131 237 o · `pending_review` · `active=false` · inchangé.  
`6a2beca9…` / `5d68ef64…` / décision `f1fcb832…` : **inchangés**.

## 5. URL / téléchargement

Count **1** (tentative PASS) · TTL **60 s** · HTTPS · MIME `image/png` · max 8 MiB · buffer remis à zéro.  
URL **non persistée** (absente de Git, docs, `.tmp` versionné).

## 6. Checksum corrigé

`b284e877e5a80e7af19a84fdce9db79f0ab1e31298b6f9b43fcb9e18a7921fe5`  
Taille composée 1 309 704 o · 1024×1024 · décodable.  
≠ parent `1ac51f484420ef88…` · ≠ rejeté `d056b85aa4f9452d…`.

## 7. Future identité (non créée)

Fingerprint préfixe `4429654f9bf92525…` · assetId préfixe `4429654f…` · `compositorVersion=1.1.0`.  
Distinct de `6a2beca9…`. **created=false**.

## 8. Déterminisme

Deux compositions mémoire sur le même buffer : même checksum, pixels, boxes, lignes. **0** second téléchargement.

## 9. Overlay exact

locale `fr` · titre `De l’idée à la structure` (U+2019) · CTA `Découvrir Virtual Humans Studio` · wrap `Découvrir Virtual Humans` / `Studio` · FP `fdfae63fe1c7d003…` · police `vhs-overlay-latin-bitmap-v1` · bold 32 · overflow `reject` · contraste **15.01**.

Code points uniques : **22** (espace, `D H S V a c d e i l m n o r s t u v`, `é`, `à`, U+2019). Le décompte `23` de `120_` était une erreur de dénombrement ; U+2019 est présent.

## 10. Contrôle visuel

Preview gitignorée : `studio/.tmp/phase-11a-corrected-recomposition-preflight/`  
**PASS** — mots lisibles, accents et U+2019 visibles, pas de bruit LCG. Non uploadée, non versionnée.

## 11. Compteurs

| Compteur | Δ |
|---|---|
| runs / jobs / attempts / reservations | 0 |
| assets / HR / QR / ledger 66 | 0 |
| storage objects | 0 |
| budget 274 / 249 / 0 / 25 | 0 |

Storage writes **0** · nouveaux assets/artifacts/HR **0**.

## 12. Flags finaux

Paid Media / VHS-124 / worker / Directors Paid AI / Motion / `PHASE_11A_COMPOSITION_PREFLIGHT` : **OFF**.  
Probe `/prompts` : **401**. Overlay déterministe **UNAVAILABLE**.

## 13. Tests

Unitaires **1604/1604** · typecheck PASS · lint 0 error (fichiers de phase) · build PASS · freshness PASS · secret scan PASS.

## 14. Documentation / Git

Ce rapport · living handover · index / backlog / changelog **2.0.144** / checklist.  
Commit docs+script **après** fermeture. **Ne pas** promouvoir ce commit docs comme runtime. Runtime applicatif reste **`245bea2`**.

## 15. Prochaine autorisation

**`AUTH_11A_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION`**

Écrire exactement un nouvel asset enfant corrigé, privé, inactif, avec QC + nouvelle Human Review. **0** OpenAI.
