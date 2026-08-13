# 103 — Phase 11A — OpenAI Image Live Preflight (no provider)

**Date :** 2026-08-13  
**Auth :** `AUTH_PHASE_11A_OPENAI_IMAGE_PREFLIGHT_NO_PROVIDER`  
**Nature :** preflight live · **0** appel OpenAI · **0** réservation · **0** job/asset  
**Ops 14 août 2026 :** overlay déterministe / provider no-text = WIRED_DISABLED (`111_`) — ce rapport historique n’est pas réécrit.

```text
VERDICT = READY_FOR_11A_PAID_AUTH
SOURCE_COMMIT = be415f5
REAL_MEDIA_CALLS = 0
PRODUCTION_MEDIA_WRITES = 0
RUNTIME_PAID_MEDIA = OFF
OPENAI_IMAGE_REAL_EXECUTION = UNAVAILABLE
MOTION_RUNTIME = UNAVAILABLE
```

---

## 1. Verdict

**`READY_FOR_11A_PAID_AUTH`**

Fenêtre dry-run Production ouverte puis refermée depuis `be415f5`.  
Composition allowlist VHS-124 + estimate 1¢ / réserve 2¢ / shortfall 0 prouvés.  
Aucun write métier (ScenePackageSet / GenerationPlan restent absents en DB).

---

## 2. Source / déploiements

| Étape | Host | Commit |
|---|---|---|
| Pré-condition Ready | `virtual-humans-drhn7q5i8-…` | **be415f5** |
| Redeploy ON (fenêtre) | `virtual-humans-8ogyywzsz-…` | **be415f5** |
| Redeploy OFF (fermeture) | `virtual-humans-gyg6l61ex-…` | **be415f5** |
| Root directory | `studio` | — |
| Alias Production | `https://virtual-humans.vercel.app` | OFF final |

Script : `studio/scripts/phase-11a-openai-image-live-preflight.mjs`

---

## 3. Matrice temporaire

| Flag / env | Pendant dry-run | Après fermeture |
|---|---|---|
| `DIRECTOR_V2_ENABLED` | 1 | 0 |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | 1 | 0 |
| `DIRECTOR_V2_PAID_GENERATION_ENABLED` | 1 | 0 |
| `VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION` | 1 | 0 |
| `DIRECTOR_V2_WORKER_ENABLED` | **0** | 0 |
| Text AI (Marketing…Storyboard) | 0 | 0 |
| Motion Transfer / fal / worker Motion | **0** | 0 |
| Cron / retry / fallback / downstream | OFF | OFF |

Salt idempotence : `PHASE_11A_OPENAI_IMAGE_IDEMPOTENCY_SALT` present · fingerprint sha256[:16] = `ac4be4348208fcb4`  
(valeur non documentée).

---

## 4. Dry-run HTTP + local

### HTTP (`providerCalled=false`)

| Check | Résultat |
|---|---|
| Login | 200 |
| GET project | 200 |
| POST `/prompts` dry-run | 200 · executable · Storyboard rev.1 |
| `existingPackageSet` | **absent** |
| Worker `run-once` probe | **401** (non invoqué) |

### Local allowlist (code path Production)

| Champ | Valeur |
|---|---|
| capability / provider / model | `image.text_to_image` / `openai` / `gpt-image-1` |
| quality / size | `low` / `1024x1024` |
| estimate | **1¢** ($0.011) |
| reservation | **2¢** |
| available / shortfall | **27¢** / **0** |
| adapter mode | `vhs124_openai_image_allowlist` |
| exception | active (fenêtre) · non expirée · scoped |
| Registry claim | ne déclare **pas** compat globale réelle |
| wildcard `providerMode=real` | **interdit** (throw) |
| OPENAI_API_KEY | present=true · valeur **non lue** |
| ScenePackage scene-2 | memory-only · `persisted=false` |
| GenerationPlan | 1 step · 0 fallback · `persisted=false` |
| plan fingerprint | `1c5011b7f3bee767…` (sha256) |
| promptHash | `9ad3ad284ec236f9…` (sha256) |
| Storage path pattern | `{ws}/{project}/media/image/{asset}.png` |
| QC / HR | technique + visual humanOnly · HR required |
| Legacy / Motion | isolés |

---

## 5. Artifacts amont (actifs)

| Artifact | Revision |
|---|---|
| Brief / Marketing / Creative / Script / Visual / Storyboard | **1** chacun |
| ScenePackageSet Production | **absent** |
| GenerationPlan Production | **absent** |

Aucun Director texte régénéré. Aucune persistance déterministe pendant ce preflight  
(écriture ScenePackageSet/Plan = Auth séparée si exigée avant smoke).

---

## 6. Compteurs DB

| Compteur | Avant | Après | Δ |
|---|---:|---:|---:|
| production_runs | 0 | 0 | 0 |
| production_jobs | 0 | 0 | 0 |
| generation_attempts | 0 | 0 | 0 |
| active reservations | 0 | 0 | 0 |
| assets (projet) | 0 | 0 | 0 |
| scene_package_set active | 0 | 0 | 0 |
| generation_plan active | 0 | 0 | 0 |
| human_review_decisions | 0 | 0 | 0 |
| cost_ledger rows (workspace) | 62 | 62 | 0 |
| provider calls | — | — | **0** |
| worker invocations | — | — | **0** |

Budget : hard **274** / committed **247** / reserved **0** / available **27** ¢  
Migrations SQL locales : **30/30** (table `schema_migrations` non lisible PostgREST).

---

## 7. Fermeture

- Exception VHS-124 **OFF**  
- Paid media / Director / Persistence **OFF**  
- Worker / Motion / cron **OFF**  
- Probe post-fermeture prompts dry-run → **404**  
- Runtime final : `RUNTIME_PAID_MEDIA=OFF` · `OPENAI_IMAGE_REAL_EXECUTION=UNAVAILABLE` · `MOTION_RUNTIME=UNAVAILABLE`

---

## 8. Note code post-preflight

Correctif mineur `phase-11a-image-prompt.ts` : éviter faux positifs `data:` sur marqueurs `[DATA:…]` du renderer.  
Inclus dans le commit documentaire — **ne pas** redéployer ce commit docs ; le prochain Auth smoke devra déployer la source applicative à jour si ce correctif n’est pas déjà sur `be415f5` (il ne l’est pas).  
Pour le smoke payant : déployer HEAD contenant le correctif **ou** revalider le prompt gate sur `be415f5` seul (HTTP preflight n’a pas nécessité le correctif ; le dry-run local plan/prompt oui).

---

## 9. Prochaine autorisation exacte

```text
NEXT = 11A-FINAL-PREFLIGHT → SMOKE-BLOCKED → STORAGE/PLAN (`106_`) DONE
FOLLOW-UP = 11A-LIVE-PREFLIGHT-NO-PROVIDER (nouveau SHA applicatif)
DO_NOT = fal · Motion · legacy · multi-call · auto-activate
```

> **Update :** `106_` a câblé Storage/plan/sanitize · suite = nouveau live preflight.
