# Portrait Video Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: video
> Status: stable

---

## EN

### Purpose
Generate a portrait talking-head video of the character.

### Variables
- `{{character}}` — the character identity reference.
- `{{message}}` — the spoken message.
- `{{background}}` — background style.
- `{{duration}}` — target duration.

### Prompt Template
```text
Talking-head portrait video of {{character}}.
Message: {{message}}.
Close to medium shot, {{background}} background, soft even lighting, steady eye contact.
Duration {{duration}}.
```

### Output Structure
- Framing: close to medium shot.
- Background: consistent, unobtrusive.
- Delivery: direct eye contact.

### Rules
- Must not redefine the Virtual Human identity.
- Keep identity and voice consistent with memory.
- Comply with the core standards and the active behavior.

---

## FR

### Objectif
Générer une vidéo portrait (plan buste face caméra) du personnage.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{message}}` — le message parlé.
- `{{background}}` — style d'arrière-plan.
- `{{duration}}` — durée cible.

### Modèle de prompt
```text
Vidéo portrait face caméra de {{character}}.
Message : {{message}}.
Plan serré à moyen, arrière-plan {{background}}, lumière douce et homogène, regard stable.
Durée {{duration}}.
```

### Structure de sortie
- Cadrage : plan serré à moyen.
- Arrière-plan : cohérent, discret.
- Diction : regard direct.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Conserver identité et voix cohérentes avec la mémoire.
- Respecter les standards `core/` et le comportement actif.
