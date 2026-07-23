# LinkedIn Post Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: social
> Status: stable

---

## EN

### Purpose
Generate a professional LinkedIn post.

### Variables
- `{{character}}` — the character identity reference.
- `{{topic}}` — the professional topic.
- `{{insight}}` — the key insight or value.
- `{{cta}}` — call to action.

### Prompt Template
```text
LinkedIn post by {{character}} about {{topic}}.
Open with a professional hook, share {{insight}} with a concrete point, end with {{cta}}.
Professional tone, short paragraphs, a few relevant hashtags.
```

### Output Structure
- Hook, value/insight, single CTA.
- Short paragraphs, scannable.
- A few relevant hashtags.

### Rules
- Must not redefine the Virtual Human identity.
- Claims must be truthful and professional.
- Comply with the core social standard.

---

## FR

### Objectif
Générer une publication LinkedIn professionnelle.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{topic}}` — le sujet professionnel.
- `{{insight}}` — l'idée clé ou la valeur.
- `{{cta}}` — appel à l'action.

### Modèle de prompt
```text
Publication LinkedIn de {{character}} sur {{topic}}.
Ouvrir par une accroche professionnelle, partager {{insight}} avec un point concret, terminer par {{cta}}.
Ton professionnel, paragraphes courts, quelques hashtags pertinents.
```

### Structure de sortie
- Accroche, valeur/idée, un seul CTA.
- Paragraphes courts, lisibles.
- Quelques hashtags pertinents.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Les affirmations doivent être véridiques et professionnelles.
- Respecter le standard social de `core/`.
