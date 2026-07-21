# X Post Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: social
> Status: stable

---

## EN

### Purpose
Generate a short, punchy X (Twitter) post.

### Variables
- `{{character}}` — the character identity reference.
- `{{topic}}` — the subject.
- `{{angle}}` — the specific angle or opinion.

### Prompt Template
```text
X post by {{character}} about {{topic}}.
One sharp idea from this angle: {{angle}}.
Concise, punchy, within the platform limit, at most one or two hashtags.
```

### Output Structure
- One sharp idea.
- Concise, within character limit.
- Minimal hashtags.

### Rules
- Must not redefine the Virtual Human identity.
- Keep it truthful and respectful.
- Comply with the core social standard.

---

## FR

### Objectif
Générer une publication X (Twitter) courte et percutante.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{topic}}` — le sujet.
- `{{angle}}` — l'angle ou l'opinion spécifique.

### Modèle de prompt
```text
Publication X de {{character}} sur {{topic}}.
Une idée nette selon cet angle : {{angle}}.
Concis, percutant, dans la limite de la plateforme, un ou deux hashtags au maximum.
```

### Structure de sortie
- Une idée nette.
- Concis, dans la limite de caractères.
- Hashtags minimaux.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Rester véridique et respectueux.
- Respecter le standard social de `core/`.
