# Thumbnail Image Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: image
> Status: stable

---

## EN

### Purpose
Generate an eye-catching video thumbnail featuring the character.

### Variables
- `{{character}}` — the character identity reference.
- `{{title_text}}` — short overlay text.
- `{{expression}}` — expressive reference.
- `{{theme}}` — color and mood theme.

### Prompt Template
```text
Video thumbnail featuring {{character}} with {{expression}} expression.
Large readable overlay text: {{title_text}}.
{{theme}} color theme, high contrast, clear focal point, 16:9 composition.
```

### Output Structure
- Format: 16:9.
- Focal point: character + short text.
- High contrast for legibility.

### Rules
- Must not redefine the Virtual Human identity.
- Text must be truthful and match the content.
- Comply with the core photo and social standards.

---

## FR

### Objectif
Générer une miniature vidéo accrocheuse mettant en scène le personnage.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{title_text}}` — texte court en surimpression.
- `{{expression}}` — référence expressive.
- `{{theme}}` — thème de couleurs et d'ambiance.

### Modèle de prompt
```text
Miniature vidéo mettant en scène {{character}} avec une expression {{expression}}.
Texte en surimpression grand et lisible : {{title_text}}.
Thème de couleurs {{theme}}, fort contraste, point focal net, composition 16:9.
```

### Structure de sortie
- Format : 16:9.
- Point focal : personnage + texte court.
- Fort contraste pour la lisibilité.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Le texte doit être véridique et refléter le contenu.
- Respecter les standards photo et sociaux de `core/`.
