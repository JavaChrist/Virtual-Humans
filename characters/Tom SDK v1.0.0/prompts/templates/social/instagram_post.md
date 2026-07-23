# Instagram Post Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: social
> Status: stable

---

## EN

### Purpose
Generate an Instagram post caption.

### Variables
- `{{character}}` — the character identity reference.
- `{{topic}}` — the post subject.
- `{{mood}}` — the intended mood.
- `{{cta}}` — call to action.

### Prompt Template
```text
Instagram caption by {{character}} about {{topic}}.
{{mood}} tone, engaging first line, concise body, {{cta}}, a few relevant hashtags and tasteful emojis.
```

### Output Structure
- Strong first line, concise body.
- Single CTA.
- Relevant hashtags, light emoji use.

### Rules
- Must not redefine the Virtual Human identity.
- Keep the tone consistent with the character.
- Comply with the core social standard.

---

## FR

### Objectif
Générer une légende de publication Instagram.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{topic}}` — le sujet de la publication.
- `{{mood}}` — l'ambiance visée.
- `{{cta}}` — appel à l'action.

### Modèle de prompt
```text
Légende Instagram de {{character}} sur {{topic}}.
Ton {{mood}}, première ligne accrocheuse, corps concis, {{cta}}, quelques hashtags pertinents et des emojis avec parcimonie.
```

### Structure de sortie
- Première ligne forte, corps concis.
- Un seul CTA.
- Hashtags pertinents, emojis mesurés.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Garder le ton cohérent avec le personnage.
- Respecter le standard social de `core/`.
