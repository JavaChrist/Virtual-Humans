# 86 — MT-013G2 MV-001 8s Media Preparation

**Date :** 12 août 2026  
**Auth :** `AUTH_MV001_PREPARE_LOCAL_8S_VIDEO_ONLY`  
**Scope :** dérivé local 8s 720p · profil MV-001 8s · manifeste redacted

```text
VERDICT                 = MEDIA_PREPARED_8S_720P
MEDIA_VALIDATED         = YES (local revalidate)
MEDIA_UPLOADED          = NO
ORIGINAL_SOURCE_MUTATED = NO
PROVIDER_CALLS          = 0
RESERVATION             = 0
HARD_LIMIT_CHANGED      = NO
BUDGET                  = 174 / 112 / 0 / 62
SHORTFALL               = 100¢  (= 162 − 62)
DEPLOYED                = NO
RUNTIME                 = UNAVAILABLE
```

Chemins absolus, contenus et miniatures **absents** de ce rapport et de Git.

---

## 1. Dérivé vidéo (local)

| Champ | Valeur |
|---|---|
| Intervalle source | 00:07.000 → 00:15.000 |
| Durée | **8.000 s** |
| Dimensions | **1280 × 720** (upscale 16:9 depuis 640×360) |
| Codec / pix_fmt | H.264 / **yuv420p** |
| fps | **25** (sans interpolation de mouvement) |
| Audio | **supprimé** |
| Métadonnées | strip (`-map_metadata -1`) |
| Path manifeste | `mv001/source.mp4` |
| SHA-256 | `91b32ec502454e46a93122f250fcde51431ce5e83d1947d645c8f9c40a58fc5a` |
| Taille | 2 672 339 bytes |

Fichier original : **non modifié / non supprimé**.

---

## 2. Identité (inchangée, revalidée)

| Champ | Valeur |
|---|---|
| MIME | `image/png` |
| Dimensions | 971 × 1619 |
| Path manifeste | `mv001/identity.png` |
| SHA-256 | `9e270cd7d31bbb3e7cd6955059eff1c4d23c93d982cf5e2b03f19d8346561dae` |
| Status | `validated` |

---

## 3. Profil MV-001 (mis à jour)

| Champ | Avant (3s) | Après (8s) |
|---|---|---|
| duration | 3s | **8s** |
| estimate | 51¢ | **135¢** |
| reservation | 62¢ | **162¢** |
| absoluteCap | 100¢ | **200¢** |
| maxCalls/Jobs/Outputs | 1/1/1 | 1/1/1 |
| fallbacks / autoRetry | 0 / 0 | 0 / 0 |
| humanReview | required | required |
| shortfall | — | **100¢** |

Budget workspace **inchangé** : hard 174 / committed 112 / reserved 0 / available 62.

Gate `budget_covers_reservation` reste en échec jusqu’à Auth raise distincte (+100¢ available min.).

---

## 4. Validations

| Check | Résultat |
|---|---|
| Local validate (source 8s + identity) | **MEDIA_VALIDATED** |
| Tests MT-013F/G guards | **PASS** |
| typecheck | **PASS** |
| Upload / fal / réserve / deploy | **0** |
| Médias dans Git | **NON** |

---

## 5. Code

- Profil `mv001-benchmark-profile.ts` (8s / 135 / 162 / 200 / shortfall 100)
- Gates budget observé + shortfall + cover (cover ∈ AWAIT_AUTH)
- Script `scripts/mt013g2-mv001-prepare-8s-video.ts` (env paths only)
- Tests mis à jour

---

## 6. Suite (ne pas fusionner)

1. Auth **budget raise** (+≥100¢ available) — non autorisée ici.  
2. Auth **private upload** ×2.  
3. Auth **deploy / flags**.  
4. Auth **paid single call** (réserve 162¢, max 1 fal).
