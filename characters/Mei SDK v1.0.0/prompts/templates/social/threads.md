# Threads Post Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: social
> Status: stable

---

## EN

### Purpose
Generate a conversational Threads post or short thread.

### Variables
- `{{character}}` — the character identity reference.
- `{{topic}}` — the subject.
- `{{points}}` — key points for the thread.

### Prompt Template
```text
Threads post by {{character}} about {{topic}}.
Conversational and authentic tone. If multiple, split {{points}} into a short connected thread.
Natural phrasing, easy to read.
```

### Output Structure
- Conversational opening.
- Optional short thread from `{{points}}`.
- Natural, readable tone.

### Rules
- Must not redefine the Virtual Human identity.
- Keep it authentic and truthful.
- Comply with the core social standard.

---

## FR

### Objectif
Générer une publication Threads conversationnelle ou un court fil.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{topic}}` — le sujet.
- `{{points}}` — points clés du fil.

### Modèle de prompt
```text
Publication Threads de {{character}} sur {{topic}}.
Ton conversationnel et authentique. Si plusieurs, répartir {{points}} en un court fil connecté.
Formulation naturelle, facile à lire.
```

### Structure de sortie
- Ouverture conversationnelle.
- Court fil optionnel à partir de `{{points}}`.
- Ton naturel et lisible.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Rester authentique et véridique.
- Respecter le standard social de `core/`.
