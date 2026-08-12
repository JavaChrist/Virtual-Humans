# 88 — MT-013I MV-001 Private Media Upload (+ I-A project)

**Date :** 12 août 2026  
**Auth :** `AUTH_CREATE_EXACTLY_ONE_MV001_VIDEO_PROJECT` · `AUTH_MV001_UPLOAD_EXACTLY_TWO_PRIVATE_MEDIA`  
**Cible :** Virtual Humans Studio · `ejdb…nmvi` · workspace `3c308f57-…6d01`  
**video_project :** `390c25db-…5e84` · name `MV-001 — Tai Chi Motion Transfer Benchmark`

```text
MEDIA_UPLOADED                = YES (exactly 2 private objects + 2 assets)
VIDEO_PROJECT_MV001           = 390c25db-69e1-403a-83c5-7afcb4b85e84
BUCKET                        = director-final-assets (public=false)
AUDIT_UPLOAD_ROWS             = 2
LEDGER                        = 59 (inchangé)
JOBS / RUNS                   = 0 / 0
PROVIDER_CALLS                = 0
RUNTIME_MOTION                = UNAVAILABLE
SIGNED_URLS_PERSISTED         = NO
DEPLOY / VERCEL               = NOT_ATTEMPTED
```

---

## 1. MT-013I-A — video_project (préalable)

| Champ | Valeur |
|---|---|
| id | `390c25db-69e1-403a-83c5-7afcb4b85e84` |
| name | MV-001 — Tai Chi Motion Transfer Benchmark |
| correlationId | `mt013ia-mv001-create-video-project` |
| audit | `motion.mv001.video_project.created` ×1 |
| artifacts créés | **0** |

---

## 2. Uploads (exactement 2)

| Rôle | assetId | MIME | size | SHA-256 (prefix…suffix) | path suffix |
|---|---|---|---|---|---|
| `motion_source_video` | `12c4bd0b-…0320` | video/mp4 | 2672339 | `91b32ec50245…58fc5a` | `motion/source/{assetId}.mp4` |
| `motion_identity_reference` | `f42393ae-…e77c` | image/png | 1467232 | `9e270cd7d31b…561dae` | `motion/identity/{assetId}.png` |

- Bucket privé `director-final-assets` · `upsert: false` · chemins 5 segments workspace/project/motion/…  
- Lifecycle `available` · consent/reference IDs **redacted** · expires Privacy `2026-09-10`  
- Vérification post-upload par **download privé** (checksum/taille/MIME/chemin) — aucune URL signée persistée  
- Script Auth : `studio/scripts/mt013i-mv001-private-media-upload.ts` (credentials via `.env.remote.local`, hors Git)

---

## 3. Post-vérification

| Check | Résultat |
|---|---|
| storage.objects sous `…/motion/%` | **2** |
| assets MV-001 (rôles source/identity) | **2** |
| checksums vs sources locales | **identiques** |
| bucket `public` | **false** |
| fuites URL dans assets/provenance | **0** |
| audit `mt013i-mv001-private-media-upload` | **2** |
| cost_ledger | **59** |
| production_jobs / production_runs | **0 / 0** |
| fal / réservation / deploy | **0** |
| Runtime Motion | **UNAVAILABLE** |

---

## 4. Interdictions respectées

Pas de 3ᵉ upload · pas de fal · pas de ledger reserve · pas de run/job/attempt · pas de deploy/Vercel · pas d’activation Motion · pas de QC/review/merge/export · pas de suppression auto des fichiers locaux/distants · aucun média/base64/URL signée dans Git/docs/DB.

---

## 5. Suite (Auth distinctes, non fusionnées)

1. Auth **deploy / flags** Motion (benchmark-scoped) si requis.  
2. Auth **paid single call MV-001** — réserve ≤162¢ · max 1 appel fal.
