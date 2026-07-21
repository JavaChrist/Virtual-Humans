# Facebook Post Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: social
> Status: stable

---

## EN

### Purpose
Generate a Facebook post.

### Variables
- `{{character}}` — the character identity reference.
- `{{topic}}` — the post subject.
- `{{message}}` — the main message.
- `{{cta}}` — call to action.

### Prompt Template
```text
Facebook post by {{character}} about {{topic}}.
Friendly, conversational tone, share {{message}} clearly, end with {{cta}}.
Approachable and community-oriented.
```

### Output Structure
- Friendly opening, clear message.
- Single CTA.
- Community-oriented tone.

### Rules
- Must not redefine the Virtual Human identity.
- Claims must be truthful.
- Comply with the core social standard.

---

## FR

### Objectif
Générer une publication Facebook.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{topic}}` — le sujet de la publication.
- `{{message}}` — le message principal.
- `{{cta}}` — appel à l'action.

### Modèle de prompt
```text
Publication Facebook de {{character}} sur {{topic}}.
Ton amical et conversationnel, partager {{message}} clairement, terminer par {{cta}}.
Accessible et orienté communauté.
```

### Structure de sortie
- Ouverture amicale, message clair.
- Un seul CTA.
- Ton orienté communauté.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Les affirmations doivent être véridiques.
- Respecter le standard social de `core/`.
