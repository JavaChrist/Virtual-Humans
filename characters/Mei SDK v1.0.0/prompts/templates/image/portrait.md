# Portrait Image Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: image
> Status: stable

---

## EN

### Purpose
Generate a portrait image of the character.

### Variables
- `{{character}}` — the character identity reference.
- `{{expression}}` — expression reference.
- `{{outfit}}` — outfit reference.
- `{{background}}` — background style.

### Prompt Template
```text
Portrait of {{character}}, {{expression}} expression, wearing {{outfit}}.
{{background}} background, soft even lighting, sharp focus on the face, natural skin tones.
```

### Output Structure
- Framing: head-and-shoulders portrait.
- Focus: face.
- Background: consistent, unobtrusive.

### Rules
- Must not redefine the Virtual Human identity.
- Use identity, expression and outfit references from memory.
- Comply with the core photo standard.

---

## FR

### Objectif
Générer une image portrait du personnage.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{expression}}` — référence d'expression.
- `{{outfit}}` — référence de tenue.
- `{{background}}` — style d'arrière-plan.

### Modèle de prompt
```text
Portrait de {{character}}, expression {{expression}}, portant {{outfit}}.
Arrière-plan {{background}}, lumière douce et homogène, netteté sur le visage, teints naturels.
```

### Structure de sortie
- Cadrage : portrait tête et épaules.
- Netteté : le visage.
- Arrière-plan : cohérent, discret.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Utiliser les références d'identité, d'expression et de tenue de la mémoire.
- Respecter le standard photo de `core/`.
