# 58 — Phase 11A — First Real Media Smoke Audit & Preparation

**Date :** 11 août 2026  
**Entrée :** Phase 10F-V4-EXECUTE PASS (`98c9c3f`) · runtime OFF · Storyboard rev.1 actif  
**Provider calls :** **0**  
**Jobs / assets / ledger / budget / flags / deploy :** **0**

---

## Verdict

```text
DECISION_REQUIRED  (historique 11 août)
→ supersédé ops : BLOCKED_MEDIA_PRODUCTION_WIRING  (voir 101_ Phase 11A-RESUME)
```

Audit et préparation verts. Smoke média recommandé **identifié** (1 image OpenAI sync, ~1–2¢).  
**Blocage architectural :** le chemin `/director` **interdit** les adapters réels (VHS-124 / `assertDirectorProductionUsesFakes`).  
Une autorisation humaine doit choisir le chemin d’exécution avant tout wiring ou smoke.

**Mise à jour 13 août 2026 (`101_`) :** budget désormais 274/247/27 ; Motion MV-001 done (chemin séparé) ;  
MV-002 DEFERRED ; **wiring Production média toujours absent** — ne pas Auth smoke tant que  
`11A-WIRE-OPENAI-IMAGE-ALLOWLIST` n’est pas autorisé. Legacy `/api/generate/image` ≠ PASS Production.

---

## Chaîne post-Storyboard (réelle)

```text
storyboard_project
  → scene_package_set        (Prompt Director — déterministe)
  → generation_plan          (Model Router — pure fonction)
  → approvals                (generation_plan + brief + storyboard)
  → production_runs/jobs     (Production Director — enqueue only)
  → worker run-once          (Generation Engine → adapters)
  → production_result
  → quality_report           (QC)
  → human_review_decisions   (optionnel)
  → merge_plan / export_package
```

| Élément | Statut |
|---|---|
| Prompt déterministe | implémenté ; **0** artifact Production aujourd’hui |
| Model Router | implémenté ; **0** `generation_plan` Production |
| Production + queue + ledger | validés **fakes** locaux / E2E |
| Worker borné | validé fakes ; flags OFF en prod |
| Adapters fal / OpenAI image / ElevenLabs | **code réel** présent, **non branchés** sur `/director` |
| Merge fal-compose | code + tests ; stack director = **fake merge** |
| Providers médias réels sur `/director` | **jamais prouvés** |

Artifacts actifs Production : Brief / Marketing / Creative / Script / Visual / Storyboard (**tous rev.1**).  
Intermédiaires absents : `scene_package_set`, `generation_plan`, `production_result`, QC, merge, export.  
`production_jobs` = **0** · `production_runs` = **0** · `assets` = **0**.

---

## Capabilities média (extrait)

| Capability | Provider | Model | Sync/Async | Estimate indicatif | Kill switch |
|---|---|---|---|---|---|
| Text→Image | OpenAI | `gpt-image-1` | sync | **1¢** (1024 low) | `PAID_GENERATION` ∧ `WORKER` |
| Scene still PuLID | fal | `flux-pulid` | sync | **5¢** | idem |
| Voice TTS | ElevenLabs | `eleven_multilingual_v2` | sync | ~2¢ (texte court) | idem |
| Text→Video Hailuo min | fal | hailuo-02 | async | **30¢** (6 s) | idem |
| Image→Video / lipsync / carousel / merge | fal | divers | async | ≥5–30¢+ | idem |

Source prix : `studio/src/lib/pricing.ts`.  
Stack Director défaut : `createDirectorFakeProviderAdapters()` uniquement.

---

## Options de premier smoke

| Option | Estimate | Fits 10¢ | Preuve | Risque |
|---|---:|---|---|---|
| **A — Image OpenAI still** | **1¢** (réserve reco **2¢**) | oui | adapter + asset + ledger | bas ; sync |
| B — Image fal PuLID | 5¢ | oui | fal image | identité ; refs=0 sur scènes |
| C — Vidéo Hailuo 6 s | 30¢ | **non** (shortfall 20) | async queue | orphelin / cancel limité |
| D — Voice ElevenLabs | ~2¢ | oui | audio seul | faible valeur visuelle |

**Recommandation : A.**

### Pourquoi

- plus petite unité média utile ;
- sync (pas de polling / orphan async) ;
- 1 call / 1 job / 1 asset ;
- pas de chaîne video/voice obligatoire si shot `text_motion` ;
- tient dans available **10¢** sans budget raise ;
- adapter OpenAI image déjà mature hors `/director`.

---

## Shot retenu

| Champ | Valeur |
|---|---|
| Scene | `scene-2` (prefix) · order **2** · purpose `problem` |
| Intent | `text_motion` |
| Capability Prompt | `image.text_to_image` (1 variant) |
| Pourquoi pas scene-1 | `voice_over_visual` → video + voice (chaîne) |
| Inputs | ScenePackage dérivé Storyboard+Visual+Script (déterministe) ; pas de ref identité |
| Output | 1 asset `image` (PNG) |

Dry-run local : `studio/scripts/phase-11a-media-prep-dry-run.mjs`  
Evidence : `studio/.tmp/phase-11a-media-prep-dry-run.json`

Routing full-plan Production : `no_eligible_strategy` avec fallbacks=0 (registre legacy partiel) — **renforce** le smoke single-step allowlist, pas le plan complet.

---

## Budget

| Champ | Valeur |
|---|---|
| hard / committed / reserved / available | **122 / 112 / 0 / 10** |
| estimate smoke | **1¢** |
| reservation recommandée | **2¢** (marge arrondi) |
| shortfall | **0** |
| hard min strict | 113 (=112+1) |
| hard recommandé | **122** (inchangé) |
| delta | **0** |

Aucune écriture budget.

---

## Kill switches futurs (concept)

| Flag | Smoke |
|---|---|
| Director + Persistence | ON |
| `PAID_GENERATION` + `WORKER` | ON (bornés) |
| Text AI / Marketing…Storyboard AI | **OFF** |
| Cron | OFF |
| Fallback / retry auto | OFF |
| Merge/export auto | OFF |
| Autres médias | allowlist **openai image only** |

Worker indispensable pour claim job sur `/director` (`canExecutePaidGeneration` = WORKER ∧ PAID_GENERATION).  
Périmètre : **1 job** · mode `execute` sync · pas de resubmit · fermeture OFF immédiate.

---

## Idempotence / arrêt (concept)

- clé : job/step fingerprint + scene + model + action ;
- 1 submit max ; polling N/A (sync) ;
- `existing` / terminal reuse fail-closed ;
- timeout client court ;
- cancel N/A sync ;
- ledger reserve→commit/release ;
- résultat tardif : ignorer si flags OFF + job terminal ;
- prévention orphelins : pas d’async video au premier smoke.

---

## Backup P1

```text
DOES_NOT_BLOCK_BOUNDED_MEDIA_SMOKE
```

Écritures additives bornées (job/asset/ledger) sans mutation destructive amont.  
P1 `BACKUP_PRESENT_RESTORE_UNPROVEN` **reste ouvert** (non fermé).

---

## Décision humaine requise

Choisir **exactement une** option d’exécution :

1. **VHS-124 exception (recommandé)** — autoriser un wiring temporaire d’**un** adapter OpenAI image réel sur un chemin smoke borné `/director` (allowlist), puis smoke 1 image.  
2. **Legacy** — smoke via `/api/generate/image` (prouve le provider, **pas** `production_jobs` / Production Director).

Sans cette décision : **aucun** média réel ne peut être lancé sans violer VHS-124 ou sans sortir du pipeline V2.

### Autorisation media exacte future (brouillon)

```text
ONE_MEDIA_IMAGE_CALL_MAX_2_CENTS_OPENAI_GPT_IMAGE_1_SCENE_2_TEXT_MOTION
+ VHS124_EXCEPTION_OPENAI_IMAGE_ONLY_DIRECTOR_SMOKE
```

---

## Validations PREP

| Check | Résultat |
|---|---|
| Unitaires | **1122/1122** |
| Guards 11A | **6/6** |
| Typecheck | PASS |
| Lint | 0 erreur (19 warnings historiques) |
| Build | PASS |
| Syntax script | PASS |
| Provider calls | **0** |
| Remote writes | **0** |
| Push | **non** |

---

## Scripts / tests

- `studio/scripts/phase-11a-media-prep-dry-run.mjs`
- `studio/src/application/production/__tests__/phase-11a-media-prep-guards.test.ts`
