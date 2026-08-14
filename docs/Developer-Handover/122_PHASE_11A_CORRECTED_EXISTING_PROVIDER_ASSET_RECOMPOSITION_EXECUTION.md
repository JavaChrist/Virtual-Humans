# 122 — Phase 11A — Corrected Existing Provider Asset Recomposition Execution

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION`  
**Nature :** recomposition déterministe Production du parent existant avec le composeur **1.1.0** · **0** OpenAI · **0** flag Vercel · **0** déploiement  
**Source applicative :** `245bea2152d29ff158197a946bf5856b3055b929` (`245bea2`)  
**Commit docs `a0db8c7` :** preflight seulement — **pas** une preuve applicative

```text
VERDICT = CORRECTED_COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING
APPLICATIVE_SOURCE = 245bea2
PROVIDER_CALLED = 0
PARENT = 7832765d / 1ac51f484420ef88 (inchangé)
CORRECTED = 4429654f / b284e877e5a80e7a
BYTES = 1309704
DIMS = 1024x1024
MIME = image/png
STORAGE = {workspaceId}/{projectId}/media/image/composed/{assetId}.png
COMPOSITOR = phase-11a-bitmap-compositor-1.1.0
ATLAS = vhs-overlay-latin-bitmap-shapes-v1
QC_TECHNICAL = PASS
QC_TYPOGRAPHIC = PASS
OCR = unavailable_humanOnly
HUMAN_REVIEW_DECISION = none
REPLAY_IDEMPOTENT = true
LEDGER = 274/249/0/25
RUNTIME_PAID_MEDIA = OFF
```

---

## 1. Source applicative

Décodeur / composeur / font / atlas / overlay / QC / ingest / chemins Storage : **identiques à `245bea2`** (`git diff 245bea2` vide).

Invariants du code réellement exécuté, vérifiés avant écriture :

- atlas `vhs-overlay-latin-bitmap-shapes-v1` ;
- composeur `phase-11a-bitmap-compositor-1.1.0` ;
- lookup Unicode fail-closed (`overlay_glyph_unsupported`) ;
- `legacyHashGlyphRows()` **absent** du chemin runtime (`overlay-font` → `bitmapGlyphRows` uniquement).

Composition **locale/administrative** via `.env.remote.local`. Aucun flag Paid Media / VHS-124 / OpenAI Image / worker / overlay execution / Motion ouvert. Aucun redeploy.

## 2. Asset parent

`7832765d…` · checksum `1ac51f484420ef88…` · PNG 1024×1024 · 1 131 237 octets · `pending_review` · `active=false` · provider OpenAI / `gpt-image-1` / `no_text` · **inchangé**.  
Lecture unique : 1 URL signée TTL 60 s · HTTPS · MIME `image/png` · max 8 MiB · checksum vérifié · URL non persistée · buffer remis à zéro.  
Filtres PNG relus : **1, 2, 3, 4**.

## 3. Nouvel asset enfant corrigé

`4429654f…` · checksum exact `b284e877e5a80e7af19a84fdce9db79f0ab1e31298b6f9b43fcb9e18a7921fe5` · 1 309 704 octets · 1024×1024 · `image/png` · `composed_overlay_image` · `pending_review` · `active=false`.  
Fingerprint `4429654f9bf92525…` · identité déterministe préfixe `4429654f…` (match preflight `121_`).

## 4. Chemin Storage (redacted)

`{workspaceId}/{projectId}/media/image/composed/{assetId}.png`  
Bucket privé `director-final-assets`. Objet rejeté `6a2beca9…` **non écrasé**.

## 5. Provenance parent/enfant

`parentAssetId` = `7832765d…` · overlay FP `fdfae63fe1c7d003…` · composeur `phase-11a-bitmap-compositor-1.1.0` · atlas `vhs-overlay-latin-bitmap-shapes-v1`.

## 6. QC technique

PNG décodable · MIME exact · 1024×1024 · taille exacte · checksum exact · bucket privé · provenance parent/enfant · composeur/atlas exacts · aucune URL ou base64 persistée. **PASS**.

## 7. QC typographique

Titre exact · CTA exact · U+2019 exact · `é` / `à` rendus · **22** code points couverts · atlas réel · aucun motif LCG · safe areas · overflow false · contraste **15.01** · wrap CTA `Découvrir Virtual Humans` / `Studio`. **PASS**.

## 8. OCR / validation visuelle

OCR : `unavailable_humanOnly`.  
Validation visuelle : **Human Review obligatoire**. Aucune auto-approbation.

## 9. Human Review

Seedée sans décision : quality_report `ce3a2b6d…` · production_result `a5a109e3…` · reviewRequest `11a-compose-hr-ce520c60…`.  
Identifie le nouvel enfant, le parent et le quality report corrigé. Distincte de `f1fcb832…` et du REJECT smoke.  
**Aucune** décision (`APPROVE` / `REJECT` / `RETRY_*` / `REQUEST_NEW_REFERENCE` absents).

## 10. États des quatre assets

| Asset | Statut | active | Note |
|---|---|---|---|
| `7832765d…` parent | `pending_review` | false | inchangé |
| `6a2beca9…` composé 1.0.0 | `rejected` | false | décision `f1fcb832…` inchangée |
| `5d68ef64…` smoke | `rejected` | false | décision historique inchangée |
| `4429654f…` composé 1.1.0 | `pending_review` | false | nouvelle HR pending |

## 11. Run / job / delivery

Run `39329a01…` : reste **`completed`** · `waitingReason=needs_review` (borné, sans remettre le job en cours).  
Job `edc6e84a…` : **`completed`** inchangé.  
Aucun nouveau run / job / attempt. Delivery en attente de Human Review pour le nouvel enfant. La décision `f1fcb832…` reste attachée uniquement à `6a2beca9…`.

## 12. Idempotence

Premier passage : Storage write **1** · asset insert **1** · quality report **1** · production result **1** · HR seed **1**.  
Replay in-process : Storage **0** · asset **0** · scaffold **0** · collision fail-closed. `replayIdempotent=true`.

## 13–15. Deltas

| | Avant | Après 1er write | Replay |
|---|---|---|---|
| assets | 3 | 4 | 4 |
| storage PNG | 3 | 4 | 4 |
| quality_report | 2 | 3 | 3 |
| production_result | 4 | 5 | 5 |
| HR decisions | 2 | 2 | 2 |
| runs/jobs/attempts | 2/2/0 | 2/2/0 | 2/2/0 |
| ledger | 66 · 274/249/0/25 | inchangé | inchangé |

## 16–17. Ledger / provider / runtime

Ledger **274 / 249 / 0 / 25** ¢ inchangé. Composition locale **0¢**.  
Provider calls **0** (OpenAI 0 · fal 0 · submit 0 · retry 0 · fallback 0). Cumul OpenAI Image toujours **2**.  
Paid Media / OpenAI Image / overlay execution / Motion : **OFF / UNAVAILABLE**.

## 18. Tests

Unitaires **1604/1604** · typecheck PASS · lint 0 error (fichiers de phase) · build PASS · freshness PASS · secret scan PASS.

## 19–21. Docs / Git / living

Ce rapport · living handover · `00_README` · BACKLOG · CHANGELOG 2.0.145 · CHECKLIST · `12_`/`14_`/`15_`/`02_`/`GLOSSARY`.  
Commit/push du script + docs **après** clôture. **Ne pas** redéployer le commit docs. Runtime applicatif reste **`245bea2`**.

## P0 / P1

**P0 :** pas de 3ᵉ OpenAI · ne pas activer les 4 assets · ne pas décider HR sans Auth.  
**P1 fermé :** écriture composed 1.1.0 + scaffold HR.  
**P1 ouverts :** preview privée temporaire du nouvel enfant.

## Prochaine autorisation

**`AUTH_11A_CORRECTED_COMPOSED_ASSET_PRIVATE_PREVIEW`** — consommée.

Suite : [`123_PHASE_11A_CORRECTED_COMPOSED_ASSET_HUMAN_REVIEW_REJECT.md`](./123_PHASE_11A_CORRECTED_COMPOSED_ASSET_HUMAN_REVIEW_REJECT.md) · **PASS_PROVIDER_AND_GLYPHS_TECHNICAL_COMPOSED_ASSET_HUMAN_REJECTED**.
