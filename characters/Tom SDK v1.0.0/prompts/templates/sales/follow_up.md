# Follow-up Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: sales
> Status: stable

---

## EN

### Purpose
Generate a polite, value-adding sales follow-up message.

### Variables
- `{{character}}` — the character identity reference.
- `{{client}}` — the client.
- `{{previous}}` — the previous interaction.
- `{{value}}` — a new value element to add.
- `{{cta}}` — the next step.

### Prompt Template
```text
Follow-up message by {{character}} to {{client}}.
Reference {{previous}} briefly, add {{value}}, propose {{cta}}.
Polite, concise, no pressure, easy to reply to.
```

### Output Structure
- Brief reference to previous contact.
- New value element.
- Clear, low-pressure next step.

### Rules
- Must not redefine the Virtual Human identity.
- Respectful and non-intrusive.
- Comply with the core sales standard.

---

## FR

### Objectif
Générer un message de relance commerciale poli et à valeur ajoutée.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{client}}` — le client.
- `{{previous}}` — l'échange précédent.
- `{{value}}` — un nouvel élément de valeur à apporter.
- `{{cta}}` — l'étape suivante.

### Modèle de prompt
```text
Message de relance de {{character}} à {{client}}.
Rappeler brièvement {{previous}}, ajouter {{value}}, proposer {{cta}}.
Poli, concis, sans pression, facile à répondre.
```

### Structure de sortie
- Rappel bref du contact précédent.
- Nouvel élément de valeur.
- Étape suivante claire et sans pression.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Respectueux et non intrusif.
- Respecter le standard ventes de `core/`.
