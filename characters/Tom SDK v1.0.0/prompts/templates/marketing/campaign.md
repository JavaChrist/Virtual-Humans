# Campaign Brief Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: marketing
> Status: stable

---

## EN

### Purpose
Generate a multi-channel campaign brief and messaging.

### Variables
- `{{character}}` — the character identity reference.
- `{{objective}}` — the campaign objective.
- `{{audience}}` — the target audience.
- `{{channels}}` — the channels to activate.
- `{{cta}}` — the shared call to action.

### Prompt Template
```text
Multi-channel campaign brief voiced by {{character}}.
Objective: {{objective}}. Audience: {{audience}}. Channels: {{channels}}.
Provide a core message, then a short message variant per channel, all pointing to {{cta}}.
Consistent positioning across channels.
```

### Output Structure
- Core message.
- Per-channel message variants.
- Single shared CTA.

### Rules
- Must not redefine the Virtual Human identity.
- Keep positioning consistent and truthful.
- Comply with the core marketing and social standards.

---

## FR

### Objectif
Générer un brief de campagne multicanal et ses messages.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{objective}}` — l'objectif de campagne.
- `{{audience}}` — l'audience cible.
- `{{channels}}` — les canaux à activer.
- `{{cta}}` — l'appel à l'action commun.

### Modèle de prompt
```text
Brief de campagne multicanal porté par {{character}}.
Objectif : {{objective}}. Audience : {{audience}}. Canaux : {{channels}}.
Fournir un message central, puis une courte variante par canal, tous orientés vers {{cta}}.
Positionnement cohérent entre les canaux.
```

### Structure de sortie
- Message central.
- Variantes par canal.
- Un seul CTA commun.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Positionnement cohérent et véridique.
- Respecter les standards marketing et sociaux de `core/`.
