# 117 — Phase 11A — Existing Provider Asset Composition Preflight

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_COMPOSE_EXISTING_PROVIDER_PNG_FILTERS`  
**Nature :** preflight live · lecture unique de l’asset provider existant · composition **mémoire seulement** · **0** OpenAI · **0** écriture Storage/DB  
**Source runtime :** `60cc335807db0e8903a40ca2cef8d50ef27ed152` (`60cc335`)

```text
VERDICT = READY_FOR_EXISTING_PROVIDER_ASSET_COMPOSITION_EXECUTION
SOURCE_COMMIT = 60cc335
PROVIDER_CALLED = false
PROVIDER_ASSET_READ = true
PROVIDER_ASSET_CHECKSUM_MATCH = true
PNG_DECODED = true
PNG_FILTERS_ENCOUNTERED = 1,2,3,4
COMPOSITOR_EXECUTABLE = true
COMPOSITION_SUCCEEDED = true
OVERLAY_SPEC_VALID = true
TITLE_EXACT = true
CTA_EXACT = true
SAFE_AREAS_VALID = true
OVERFLOW = false
CONTRAST_VALID = true
COMPOSED_PNG_VALID = true
COMPOSED_DIMENSIONS = 1024x1024
COMPOSED_CHECKSUM_PREFIX = d056b85aa4f9452d
PRODUCTION_STORAGE_WRITE = false
COMPOSED_ASSET_CREATED = false
HUMAN_REVIEW_REQUIRED = true
RUNTIME_PAID_MEDIA = OFF
```

---

## 1. Verdict

**`READY_FOR_EXISTING_PROVIDER_ASSET_COMPOSITION_EXECUTION`**

L’asset provider `7832765d…` a été lu une fois depuis le Storage privé, validé (checksum `1ac51f484420ef88…`, PNG 1024×1024, 1 131 237 octets), décodé avec les filtres PNG **1–4**, puis composé en mémoire avec l’overlay français exact.  
QC technique et typographique **accepted**. Aucune écriture Production. Aucun asset composé créé. Human Review future **obligatoire**.

## 2. Source commit / deploy

| | |
|---|---|
| SHA applicatif exigé | `60cc335807db0e8903a40ca2cef8d50ef27ed152` |
| origin/main au départ | `behind=0` · HEAD = `60cc335` |
| Runtime Ready avant ouverture | alias déjà `60cc335` (`4s95ta7ae-…`) |
| Preuve applicative | **uniquement** `60cc335` — pas un commit docs |

Deux tentatives de script ont échoué **avant** lecture média (requête UUID `LIKE`, colonne `provider` absente). Fermeture OFF à chaque fois. La tentative réussie est documentée ci-dessous.

## 3. Déploiements ON / OFF

| Étape | Host (redacted) | Source |
|---|---|---|
| ON | `virtual-humans-pytzg4p26-…` | redeploy `60cc335` |
| OFF | `virtual-humans-fs4ephi9l-…` | redeploy **même source** `60cc335` |

Env ON uniquement : `PHASE_11A_SOURCE_COMMIT` · `PHASE_11A_COMPOSITION_PREFLIGHT=1` · salt de preflight distinct (fingerprint `222ec62e6803bbf7`).  
Paid Media / VHS-124 / worker / Motion / Directors Paid AI : **écrits à 0** pendant ON et OFF.  
Aucun `vercel deploy` depuis le working tree.

## 4. Asset provider

`7832765d…` · `pending_review` · `active=false` · rôle provider · bucket `director-final-assets` privé · path 5 segments · **0** composed child.  
Asset historique `5d68ef64…` : `rejected` · `active=false` · HR REJECT ×1 · **inchangé**.

## 5. Checksum / format / dimensions

| Champ | Valeur |
|---|---|
| SHA-256 préfixe | `1ac51f484420ef88` · match exact |
| MIME | `image/png` |
| Taille | 1 131 237 octets |
| IHDR | 1024×1024 · bitDepth 8 · colorType 2 · interlace 0 |
| Signature PNG | OK |

## 6. URL temporaire

Count **1** · TTL **60 s** · générée en mémoire · **non persistée** · absente des logs, du rapport, de `.tmp` versionné et de ce document.

## 7. Téléchargement

Count **1** · HTTPS · host Supabase attendu · `redirect: error` · AbortSignal 20 s · Content-Length / stream bornés · max 8 MiB · MIME `image/png` · buffer remis à zéro dans `finally`.  
Storage writes : **0**.

## 8. Filtre PNG détecté

Filtres scanline uniques (numériques seulement) : **`1, 2, 3, 4`**.  
Aucun filtre 0 sur cet asset — cause historique de `png: unsupported filter` (`115_`).  
Aucun pixel logué.

## 9. Décodage

`decodeRgbPng` de `60cc335` · `pngDecoded=true` · matrice RGB 1024×1024 · inflate borné · pas de `sharp` / Canvas / Browser / réseau.

## 10. Overlay exact

locale `fr` · titre `De l’idée à la structure` (U+2019) · CTA `Découvrir Virtual Humans Studio` · sous-titre absent · mention légale absente · police `vhs-overlay-latin-bitmap-v1` · bold · taille 32 · overflow `reject` · contraste ≥ 4.5 · FP `fdfae63fe1c7d003d9e4190bf0aea904fdab59caa2ddad5c2972cb6c39a423b9`.

## 11. Composition mémoire

`phase-11a-bitmap-compositor-1.0.0` · 1024×1024 · police locale · wrapping déterministe · overflow fail-closed · **0** écriture Storage/DB.

## 12. Checksum composé (redacted)

Préfixe `d056b85aa4f9452d` · taille composée 1 310 249 octets · **non écrit**.

## 13. QC technique (mémoire)

PNG valide · 1024×1024 · décodable · checksum cohérent · provenance parent/enfant calculable.  
Aucun quality report Production créé.

## 14. QC typographique (mémoire)

`accepted` · 0 raison · titre exact · CTA exact · locale `fr` · police allowlistée · safe areas · 3 lignes · maxLines respecté · overflow false · contraste **15.01** ≥ 4.5 · overlay FP exact.  
Visuel non mesuré : `humanOnly`.

## 15. OCR / residual text

Aucun OCR payant ou externe.  
`residualText=unavailable_humanOnly` · `ocr=unavailable_humanOnly`.  
Le preflight confirme le texte **déterministe ajouté** ; il ne prétend pas détecter un pseudo-texte provider. Human Review future obligatoire.

## 16. Storage writes

**0.**

## 17. Composed asset créé

**Non.**

## 18. Run / job

Run `39329a01…` : `running` · `waitingReason=needs_review` · **inchangé**.  
Job `edc6e84a…` : `completed` · **inchangé**.

## 19. Ledger

66 rows · committed **249** · reserved **0** · **inchangé**.

## 20. Provider calls

**0** OpenAI · 0 fal · 0 Motion · 0 retry · 0 fallback.

## 21. Compteurs avant / après

| Compteur | Avant | Après | Δ |
|---|---|---|---|
| production_runs | 2 | 2 | 0 |
| production_jobs | 2 | 2 | 0 |
| generation_attempts | 0 | 0 | 0 |
| active_reservations | 0 | 0 | 0 |
| assets | 2 | 2 | 0 |
| quality_reports (actifs) | 1 | 1 | 0 |
| human_review_decisions | 1 | 1 | 0 |
| ledger_rows | 66 | 66 | 0 |
| storage_objects (listés) | 2 | 2 | 0 |
| budget | 274 / 249 / 0 / 25 | idem | 0 |

Seule une lecture temporaire de l’objet existant.

## 22. Flags finaux

Écrits à **0** : Paid Generation · VHS-124 · worker · Paid AI Directors · Motion · `PHASE_11A_COMPOSITION_PREFLIGHT`.  
Salt et `PHASE_11A_SOURCE_COMMIT` : `closed`.  
Pull Vercel : valeurs sensibles **redacted** — preuve = écritures explicites `LAST_EXPLICIT_WRITE=0`.

## 23. Runtime final

`RUNTIME_PAID_MEDIA=OFF`  
`OPENAI_IMAGE_REAL_EXECUTION=UNAVAILABLE`  
`DETERMINISTIC_OVERLAY_EXECUTION=UNAVAILABLE`  
`MOTION_RUNTIME=UNAVAILABLE`  
Probe post-fermeture `/prompts` : **401** fail-closed.

## 24. Tests / secret scan

Unitaires **1592/1592**. Tests ciblés PNG filtres + inspect + confirm/redaction + composeur + overlay + QC : PASS.  
Rapport `.tmp` : leak scan (URL / base64 / token) **PASS**. Non versionné.

## 25. Documentation / living handover

Ce rapport · `CURRENT_STATE_AND_RESUME.md` · `00_README` · `115_` / `116_` pointeurs · BACKLOG · CHANGELOG 2.0.140 · CHECKLIST · `14_` / `15_`.

## 26. Commit / push

Commit documentaire + script de preflight **après** fermeture.  
**Ne pas** redéployer ce commit docs. Runtime applicatif reste `60cc335`.

## 27. P0 / P1

**P0 :** pas de 3ᵉ appel OpenAI ; ne pas activer `5d68ef64…` ni `7832765d…` ; ne pas écrire le composed sans Auth d’exécution ; ne pas décider HR.

**P1 fermé :** preflight de composition de l’asset existant (decode 1–4 + overlay mémoire).

**P1 ouverts :** exécution compose Production (écriture objet + asset enfant + QC + seed HR, 0 OpenAI) ; refermer le run `39329a01` ; chemin Storage 6-seg worker.

## 28. Prochaine autorisation exacte

**`AUTH_11A_EXISTING_PROVIDER_ASSET_COMPOSITION_EXECUTION`** — **consommée** (`118_`).

Suivi : [`118_PHASE_11A_EXISTING_PROVIDER_ASSET_COMPOSITION_EXECUTION.md`](./118_PHASE_11A_EXISTING_PROVIDER_ASSET_COMPOSITION_EXECUTION.md) · verdict **`COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING`**.  
Prochaine Auth : **`AUTH_11A_COMPOSED_ASSET_PRIVATE_PREVIEW`**.

---

## Plan de fermeture futur (non exécuté)

1. Écrire le PNG composé (Storage privé, path `composed/`).  
2. Insérer l’asset enfant `pending_review` · `active=false` · parent `7832765d…`.  
3. Créer le quality report typographique (pas un faux PASS visuel).  
4. Seeder Human Review comparative provider ± composé, **sans** décision.  
5. Ne pas muter `5d68ef64…`.  
6. Laisser le run `39329a01…` en attente humaine.  
7. Aucun provider, aucun retry, ledger inchangé.

## Interdictions consommées / restantes

Auth provider `115_` **consommée** · Auth decoder `116_` **consommée** · Auth preflight compose **consommée**.  
Un troisième appel OpenAI reste **interdit**.
