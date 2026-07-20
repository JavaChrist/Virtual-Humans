# Audit de l'arborescence — Virtual Humans SDK

> Date de l'audit : 20 juillet 2026 (régénéré après consolidation dans `characters/`)
> Légende : ✅ = rédigé / rempli · ❌ = vide (0 octet, à écrire) · ⚠️ = point d'attention

---

## 1. Synthèse

| Catégorie | Nombre |
|-----------|:---:|
| Documents Markdown **rédigés** (métier) | 12 |
| Documents Markdown **vides** (à rédiger) | 35 |
| Schémas JSON (`schema/`) | 12 |
| Fichiers `look.json` (outfits) | 10 |
| Fichiers `look.md` + `OUTFITS_INDEX.md` (rédigés) | 11 |
| Images PNG (assets) | 61 |
| Archives | 1 |
| `.gitkeep` (non comptés comme documents) | 5 |

**Total des fichiers texte encore à rédiger : 35**
(7 `core/` + 13 docs numérotées + 8 `prompts/` + 7 `videos/`)

---

## 2. Structure globale

```text
virtual-humans/
├── AUDIT_ARBORESCENCE.md        (audit courant)
├── docs/archive/                (documents historiques)
├── core/                        (7 standards globaux)
├── schema/                      (12 schémas JSON)
└── characters/                  (SDK par personnage)
    └── Mei SDK v1.0.0/
```

> ⚠️ Dossiers vides parasites détectés à la racine : `emma/`, `lucas/`, `tom/`, `templates/` (voir §13).

---

## 3. `core/` — Standards globaux ❌ *entièrement vide (7)*

| Fichier | État |
|---------|:---:|
| `core/CHARACTER_STANDARD.md` | ❌ |
| `core/LEGAL_STANDARD.md` | ❌ |
| `core/PHOTO_STANDARD.md` | ❌ |
| `core/PROMPT_STANDARD.md` | ❌ |
| `core/QUALITY_STANDARD.md` | ❌ |
| `core/SOCIAL_STANDARD.md` | ❌ |
| `core/VIDEO_STANDARD.md` | ❌ |

---

## 4. `schema/` — 12 schémas JSON ✅ *complet*

`asset` · `character` · `expression` · `identity` · `memory` · `outfit` · `personality` · `pose` · `prompt` · `scene` · `video` · `voice`

Aucun chemin physique obsolète détecté dans les schémas.

---

## 5. `characters/Mei SDK v1.0.0/`

SDK complet du personnage **Mei**, déplacé depuis la racine. Contient les documents numérotés, `prompts/`, `videos/` et `assets/`.

---

## 6. Documents rédigés (12) ✅

| Fichier | Taille |
|---------|:---:|
| `00_IDENTITY.md` | 3,2 Ko |
| `01_APPEARANCE.md` | 3,7 Ko |
| `02_PERSONALITY.md` | 3,4 Ko |
| `03_WARDROBE.md` | 3,3 Ko |
| `20_CHARACTER_PACKAGE.md` | 2,9 Ko |
| `21_CHARACTER_MEMORY.md` | 3,1 Ko |
| `22_PRODUCT_MEMORY.md` | 5,5 Ko |
| `23_BRAND_MEMORY.md` | 4,4 Ko |
| `24_MARKETING_MEMORY.md` | 4,9 Ko |
| `25_SOCIAL_MEMORY.md` | 5,9 Ko |
| `26_VIDEO_MEMORY.md` | 6,0 Ko |
| `videos/README.md` | 57,9 Ko |

---

## 7. Documents vides (13 numérotés à rédiger) ❌

| Fichier | État |
|---------|:---:|
| `04_VOICE.md` | ❌ |
| `05_CAMERA.md` | ❌ |
| `06_BRAND.md` | ❌ |
| `07_BEHAVIOR.md` | ❌ |
| `08_PROMPTS.md` | ❌ |
| `09_WORKFLOWS.md` | ❌ |
| `11_CAPABILITIES.md` | ❌ |
| `12_LIMITATIONS.md` | ❌ |
| `13_RELATIONSHIPS.md` | ❌ |
| `14_SOCIAL_MEDIA.md` | ❌ |
| `15_MEMORY_STRUCTURE.md` | ❌ |
| `16_EVOLUTION.md` | ❌ |
| `99_CHARACTER_LOCK.md` | ❌ |

> ⚠️ Numérotation discontinue volontaire : pas de `10_`, `17_`, `18_`, `19_`.

---

## 8. Prompts — ❌ *entièrement vide (8)*

`green_screen.md` · `instagram.md` · `interview.md` · `micro_trottoir.md` · `portrait.md` · `selfie.md` · `walking.md` · `youtube.md`

---

## 9. Documentation vidéo (`videos/`)

| Fichier | État |
|---------|:---:|
| `README.md` | ✅ (57,9 Ko) |
| `shared.md` | ❌ |
| `runway.md` | ❌ |
| `veo.md` | ❌ |
| `kling.md` | ❌ |
| `minimax.md` | ❌ |
| `openai.md` | ❌ |
| `future-models.md` | ❌ |

---

## 10. Assets ✅ *complet*

| Dossier | Contenu | État |
|---------|---------|:---:|
| `assets/identity/` | portraits, profils, corps entier, marche, planches | ✅ |
| `assets/poses/` | 13 poses + planche | ✅ |
| `assets/expressions/` | 11 expressions + planche | ✅ |
| `assets/outfits/` | 10 looks (`LOOK_001`→`LOOK_010`) : `look.json`, `look.md`, `look.png`, `thumbnail.png` + `OUTFITS_INDEX.md` | ✅ |
| `assets/videos/` | médias — 5 sous-dossiers avec `.gitkeep` | prêt (vide) |

Sous-dossiers médias vidéo :
- `approved/` — vidéos finales validées
- `drafts/` — essais / générations non validées
- `references/` — vidéos de référence
- `social/` — exports réseaux sociaux
- `presentations/` — présentations / démos longues

> Total images PNG : 61. Aucun média vidéo réel présent pour l'instant.

---

## 11. Archives

| Fichier | Emplacement | État |
|---------|-------------|:---:|
| `AUDIT — VIRTUAL HUMAN SDK.md` | `docs/archive/` | historique, conservé (7,2 Ko) |

---

## 12. Références obsolètes détectées

| Fichier | Occurrence | Action |
|---------|-----------|--------|
| `videos/README.md` | 8 en-têtes `# FICHIER : mei/videos/…` | ✅ corrigés → `characters/Mei SDK v1.0.0/videos/…` |
| `videos/README.md` | racine `mei/` du schéma d'architecture (l.86) | ✅ corrigée → `characters/Mei SDK v1.0.0/` |
| `26_VIDEO_MEMORY.md` | chemins relatifs `videos/*.md` | ✅ valides — aucun changement |
| `schema/*.json` | — | aucun chemin obsolète |

Aucune référence obsolète résiduelle.

---

## 13. Points d'attention ⚠️

1. **Dossiers vides parasites à la racine** : `emma/`, `lucas/`, `tom/`, `templates/` — tous vides, non conformes à la nouvelle structure `characters/`. À supprimer ou migrer dans `characters/` (décision humaine requise).
2. **Schéma d'architecture interne de `videos/README.md`** : décrit encore des sous-dossiers conceptuels `memory/` et `voice/` qui ne correspondent pas à la structure réelle (documents numérotés à plat + pas de dossier `voice/`). Contenu métier laissé intact.
3. **Dépôt Git non initialisé** : les `.gitkeep` n'auront d'effet qu'après `git init`.

---

## 14. Arborescence finale

```text
virtual-humans/
├── AUDIT_ARBORESCENCE.md
│
├── docs/
│   └── archive/
│       └── AUDIT — VIRTUAL HUMAN SDK.md
│
├── core/                                 (7 standards, vides)
│   ├── CHARACTER_STANDARD.md
│   ├── LEGAL_STANDARD.md
│   ├── PHOTO_STANDARD.md
│   ├── PROMPT_STANDARD.md
│   ├── QUALITY_STANDARD.md
│   ├── SOCIAL_STANDARD.md
│   └── VIDEO_STANDARD.md
│
├── schema/                               (12 schémas JSON)
│   ├── asset.schema.json
│   ├── character.schema.json
│   ├── expression.schema.json
│   ├── identity.schema.json
│   ├── memory.schema.json
│   ├── outfit.schema.json
│   ├── personality.schema.json
│   ├── pose.schema.json
│   ├── prompt.schema.json
│   ├── scene.schema.json
│   ├── video.schema.json
│   └── voice.schema.json
│
└── characters/
    └── Mei SDK v1.0.0/
        ├── 00_IDENTITY.md            ✅
        ├── 01_APPEARANCE.md          ✅
        ├── 02_PERSONALITY.md         ✅
        ├── 03_WARDROBE.md            ✅
        ├── 04_VOICE.md               ❌
        ├── 05_CAMERA.md              ❌
        ├── 06_BRAND.md               ❌
        ├── 07_BEHAVIOR.md            ❌
        ├── 08_PROMPTS.md             ❌
        ├── 09_WORKFLOWS.md           ❌
        ├── 11_CAPABILITIES.md        ❌
        ├── 12_LIMITATIONS.md         ❌
        ├── 13_RELATIONSHIPS.md       ❌
        ├── 14_SOCIAL_MEDIA.md        ❌
        ├── 15_MEMORY_STRUCTURE.md    ❌
        ├── 16_EVOLUTION.md           ❌
        ├── 20_CHARACTER_PACKAGE.md   ✅
        ├── 21_CHARACTER_MEMORY.md    ✅
        ├── 22_PRODUCT_MEMORY.md      ✅
        ├── 23_BRAND_MEMORY.md        ✅
        ├── 24_MARKETING_MEMORY.md    ✅
        ├── 25_SOCIAL_MEMORY.md       ✅
        ├── 26_VIDEO_MEMORY.md        ✅
        ├── 99_CHARACTER_LOCK.md      ❌
        │
        ├── prompts/                  (8 fichiers vides)
        │   ├── green_screen.md
        │   ├── instagram.md
        │   ├── interview.md
        │   ├── micro_trottoir.md
        │   ├── portrait.md
        │   ├── selfie.md
        │   ├── walking.md
        │   └── youtube.md
        │
        ├── videos/                   (documentation technique)
        │   ├── README.md             ✅ 57,9 Ko
        │   ├── shared.md             ❌
        │   ├── runway.md             ❌
        │   ├── veo.md                ❌
        │   ├── kling.md              ❌
        │   ├── minimax.md            ❌
        │   ├── openai.md             ❌
        │   └── future-models.md      ❌
        │
        └── assets/
            ├── identity/            ✅
            ├── poses/               ✅
            ├── expressions/         ✅
            ├── outfits/             ✅ (LOOK_001 → LOOK_010 + OUTFITS_INDEX.md)
            └── videos/              (médias, structure prête)
                ├── approved/        └ .gitkeep
                ├── drafts/          └ .gitkeep
                ├── references/      └ .gitkeep
                ├── social/          └ .gitkeep
                └── presentations/   └ .gitkeep
```

---

## 15. Priorités recommandées

1. **`core/` (7 standards)** — socle référencé partout, à faire en premier.
2. **Arbitrer les dossiers parasites** `emma/`, `lucas/`, `tom/`, `templates/` à la racine.
3. **Docs `04` → `16`** du SDK Mei (clarifier les trous `10`, `17`–`19`).
4. **`videos/` techniques** (7 fichiers restants).
5. **`prompts/` (8 fichiers)**.
