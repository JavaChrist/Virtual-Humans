# 85 — MT-013G MV-001 Local Media Validation

**Date :** 12 août 2026  
**Auth :** `AUTH_MV001_LOCAL_MEDIA_VALIDATE_ONLY`  
**Scope :** lecture locale hors réseau · SHA-256 · manifeste redacted

```text
VERDICT              = MEDIA_INVALID
MEDIA_VALIDATED      = NO
MEDIA_UPLOADED       = NO
MEDIA_READ           = YES (local only)
PROVIDER_CALLS       = 0
RESERVATION          = 0
DEPLOYED             = NO
RUNTIME              = UNAVAILABLE
```

Les chemins absolus, contenus, miniatures et données brutes **n’apparaissent pas** dans ce rapport ni dans Git.

---

## 1. Verdict

```text
MEDIA_INVALID
```

Les deux fichiers locaux ont été lus hors réseau.  
L’**image d’identité** passe les gates techniques.  
La **vidéo source** échoue les gates MV-001 (durée + résolution).

---

## 2. Résultats techniques (redacted)

### 2.1 Source vidéo (`motion_source_video`)

| Champ | Observé | Attendu MV-001 | Gate |
|---|---|---|---|
| MIME | `video/mp4` | `video/mp4` | PASS |
| Durée | **16.040 s** | **3 s ± 0.25** | **FAIL** |
| Dimensions | **640 × 360** | short side ≥ 720 | **FAIL** |
| fps | **25** | ≈ 24 (±1) | PASS |
| Taille | 2 445 503 bytes | > 0 | PASS |
| SHA-256 | `48efa1c18516c632d4f62a9ade1628393d8c2b5822d5d178a6592be49c22af05` | présent | PASS |
| Path manifeste | `mv001/source.mp4` | opaque | PASS |
| Status | `invalid` | `validated` | FAIL |

**Framing technique :** landscape 16:9 · shortSide 360 · `meetsMin720p=false` · `fpsNear24=true` · full-body sémantique = `requires_human_attestation`.

### 2.2 Identité (`motion_identity_reference`)

| Champ | Observé | Attendu | Gate |
|---|---|---|---|
| MIME | `image/png` | png/jpeg/webp | PASS |
| Dimensions | **971 × 1619** | short side ≥ 256 | PASS |
| Taille | 1 467 232 bytes | > 0 | PASS |
| SHA-256 | `9e270cd7d31bbb3e7cd6955059eff1c4d23c93d982cf5e2b03f19d8346561dae` | présent | PASS |
| Path manifeste | `mv001/identity.png` | opaque | PASS |
| Status | `validated` | `validated` | PASS |

**Framing technique :** portrait-ish 971:1619 · `meetsMinShortSide=true` · face/body sémantique = `requires_human_attestation`.

---

## 3. Issues bloquantes

```text
source_duration_out_of_tolerance:observed=16.040
source_resolution_below_720p:shortSide=360
```

Actions opérateur (hors Auth actuelle) :

1. Produire / trimmer une source **exactement 3 s** (±0.25).  
2. Résolution short side **≥ 720** (1080 recommandé).  
3. Relancer `AUTH_MV001_LOCAL_MEDIA_VALIDATE_ONLY` sur la nouvelle source (identity réutilisable si inchangée).

---

## 4. Correctif probe

Le premier passage lisait la piste **audio** (`soun`) comme dimensions (artefact 2×16).  
Le probe sélectionne désormais la piste **`vide`** (`avc1` / équivalents).

---

## 5. Livrables code

| Fichier | Rôle |
|---|---|
| `mv001-local-media-probe.ts` | Probe MP4 (piste vide) / PNG / JPEG / WebP + SHA-256 |
| `mv001-local-media-validate.ts` | Gates MV-001 + manifeste redacted |
| `scripts/mt013g-mv001-local-media-validate.ts` | CLI → `.tmp/` gitignored |
| `mt013g-*.test.ts` | Guards synthétiques tmpdir |

Relance locale (chemins via env, jamais commités) :

```bash
cd studio
npx tsx scripts/mt013g-mv001-local-media-validate.ts
```

---

## 6. Interdictions respectées

Pas d’upload · pas de copie Git/docs · pas d’asset Production · pas d’URL signée · pas de fal · pas de réservation · pas de run/job · pas de deploy/Vercel.

---

## 7. Suite

1. Corriger la **source vidéo** (3 s · ≥720p).  
2. Relancer validation locale → viser `MEDIA_VALIDATED`.  
3. Auth **séparée** : private upload ×2 — **non autorisée ici**.
