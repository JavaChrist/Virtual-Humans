# Instagram Video Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: video
> Status: stable

---

## EN

### Purpose
Generate a short vertical video optimized for Instagram Reels.

### Variables
- `{{character}}` — the character identity reference.
- `{{hook}}` — opening hook (first seconds).
- `{{message}}` — core message.
- `{{cta}}` — call to action.
- `{{duration}}` — target duration (short).

### Prompt Template
```text
Vertical 9:16 video of {{character}}.
Open with: {{hook}}.
Deliver: {{message}}.
End with: {{cta}}.
Fast pacing, dynamic framing, captions on screen, duration {{duration}}.
```

### Output Structure
- Format: vertical 9:16.
- Arc: hook, message, single CTA.
- On-screen captions.

### Rules
- Must not redefine the Virtual Human identity.
- One primary call to action.
- Comply with the core and social standards.

---

## FR

### Objectif
Générer une courte vidéo verticale optimisée pour Instagram Reels.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{hook}}` — accroche d'ouverture (premières secondes).
- `{{message}}` — message central.
- `{{cta}}` — appel à l'action.
- `{{duration}}` — durée cible (courte).

### Modèle de prompt
```text
Vidéo verticale 9:16 de {{character}}.
Ouvrir par : {{hook}}.
Délivrer : {{message}}.
Terminer par : {{cta}}.
Rythme rapide, cadrage dynamique, sous-titres à l'écran, durée {{duration}}.
```

### Structure de sortie
- Format : vertical 9:16.
- Arc : accroche, message, un seul CTA.
- Sous-titres à l'écran.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Un seul appel à l'action principal.
- Respecter les standards `core/` et sociaux.
