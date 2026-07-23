# YouTube Video Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: video
> Status: stable

---

## EN

### Purpose
Generate a long-form YouTube video with a clear narrative structure.

### Variables
- `{{character}}` — the character identity reference.
- `{{title}}` — video title.
- `{{outline}}` — ordered sections.
- `{{cta}}` — call to action.
- `{{duration}}` — target duration (long).

### Prompt Template
```text
Long-form YouTube video of {{character}}.
Title: {{title}}.
Structure: intro hook, then sections {{outline}}, then conclusion with {{cta}}.
Horizontal 16:9, clear chapters, steady framing, consistent identity and voice.
Duration {{duration}}.
```

### Output Structure
- Format: horizontal 16:9.
- Arc: hook, chaptered body, conclusion + CTA.
- Chapters aligned with `{{outline}}`.

### Rules
- Must not redefine the Virtual Human identity.
- One primary call to action.
- Comply with the core standards and the active behavior.

---

## FR

### Objectif
Générer une vidéo YouTube longue au format narratif clair.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{title}}` — titre de la vidéo.
- `{{outline}}` — sections ordonnées.
- `{{cta}}` — appel à l'action.
- `{{duration}}` — durée cible (longue).

### Modèle de prompt
```text
Vidéo YouTube longue de {{character}}.
Titre : {{title}}.
Structure : accroche d'intro, puis sections {{outline}}, puis conclusion avec {{cta}}.
Format horizontal 16:9, chapitres clairs, cadrage stable, identité et voix cohérentes.
Durée {{duration}}.
```

### Structure de sortie
- Format : horizontal 16:9.
- Arc : accroche, corps chapitré, conclusion + CTA.
- Chapitres alignés sur `{{outline}}`.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Un seul appel à l'action principal.
- Respecter les standards `core/` et le comportement actif.
