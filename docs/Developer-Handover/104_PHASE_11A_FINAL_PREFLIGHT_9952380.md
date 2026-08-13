# 104 — Phase 11A — Final Preflight after prompt-gate fix (`9952380`)

**Date :** 2026-08-13  
**Auth :** `AUTH_PHASE_11A_FINAL_PREFLIGHT_COMMIT_9952380_NO_PROVIDER`  
**Nature :** preflight live · **0** appel OpenAI · **0** réservation · **0** job/asset

```text
VERDICT = READY_FOR_11A_PAID_AUTH
SOURCE_COMMIT = 9952380
REAL_MEDIA_CALLS = 0
PRODUCTION_MEDIA_WRITES = 0
RUNTIME_PAID_MEDIA = OFF
OPENAI_IMAGE_REAL_EXECUTION = UNAVAILABLE
MOTION_RUNTIME = UNAVAILABLE
```

---

## 1. Verdict

**`READY_FOR_11A_PAID_AUTH`**

Commit exact **`9952380`** (correctif prompt-gate `[DATA:…]`) validé en Production  
avec dry-run `providerCalled=false`, puis runtime refermé OFF depuis la même source.

---

## 2. Source / déploiements

| Étape | Host | Commit |
|---|---|---|
| Pré-condition Ready | `virtual-humans-rcdfpe502-…` | **9952380** |
| Redeploy ON | `virtual-humans-28twjkezr-…` | **9952380** |
| Redeploy OFF | `virtual-humans-29avc9o8l-…` | **9952380** |
| Root directory | `studio` | — |

Script : `studio/scripts/phase-11a-final-preflight-9952380.mjs`  
Salt fingerprint : `6b3c68d54d5b8ba3` (valeur non documentée).

---

## 3. Validation correctif `[DATA:…]`

| Check | Résultat |
|---|---|
| Prompt valide avec délimiteurs `[DATA:…]` | **accepté** |
| Injection `https://…` | **rejetée** |
| Marqueurs Motion (`motion_transfer` / kling) | **rejetés** |
| Prompt complet persisté | **non** |
| Persisté | promptHash + metadata redacted only |

promptHash (sha256) préfixe : `9ad3ad284ec236f9…`

---

## 4. Dry-run

### HTTP

| Check | Valeur |
|---|---|
| Login / project | 200 / 200 |
| POST `/prompts` dry-run | 200 · `providerCalled=false` · executable |
| Storyboard | rev.1 |
| ScenePackageSet existant | **absent** |
| Worker probe | **401** · non invoqué |
| Post-fermeture prompts | **404** |

### Local allowlist

| Champ | Valeur |
|---|---|
| sourceCommit | **9952380** |
| project / scene | `984507af-…` / `scene-2` |
| capability | `image.text_to_image` |
| provider / model | `openai` / `gpt-image-1` |
| quality / size | `low` / `1024x1024` |
| estimate / reservationMax | **1¢** / **2¢** |
| max calls/jobs/outputs | 1/1/1 |
| retry / fallback / downstream | 0/0/false |
| adapter mode | `vhs124_openai_image_allowlist` |
| plan fingerprint | `1c5011b7f3bee767…` |
| ScenePackageSet / GenerationPlan DB | **non persistés** |
| OPENAI_API_KEY | present · non lue |
| Legacy / Motion | isolés |

---

## 5. Compteurs (inchangés)

| Δ | Valeur |
|---|---:|
| new runs / jobs / attempts | **0** |
| new ledger / reservations | **0** |
| new assets / artifacts | **0** |
| provider calls | **0** |
| worker invocations | **0** |

Budget : **274 / 247 / 0 / 27** ¢ · migrations SQL locales **30/30**.

---

## 6. Fermeture

- VHS-124 exception **OFF**
- Paid Media / Director / Persistence **OFF**
- Worker / retry / fallback / downstream / Motion **OFF**
- `RUNTIME_PAID_MEDIA=OFF`
- `OPENAI_IMAGE_REAL_EXECUTION=UNAVAILABLE`
- `MOTION_RUNTIME=UNAVAILABLE`

---

## 7. Prochaine autorisation exacte

```text
NEXT = 11A-PAID-SMOKE BLOCKED (`105_`) → STORAGE/PLAN DONE (`106_`)
FOLLOW-UP = 11A-LIVE-PREFLIGHT-NO-PROVIDER (nouveau SHA · FP `c532c400334f5b22`)
DO_NOT = fal · Motion · legacy · multi-call · auto-activate
```

> **Update :** `106_` résout Storage/plan/sanitize · provider toujours non consommé.
