# README Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: documentation
> Status: stable

---

## EN

### Purpose
Generate a project or module README.

### Variables
- `{{character}}` — the character identity reference.
- `{{project}}` — the project or module name.
- `{{purpose}}` — what it does.
- `{{usage}}` — how to use it.

### Prompt Template
```text
README for {{project}}, authored by {{character}}.
Sections: title + one-line summary, {{purpose}}, install/setup, {{usage}} with examples, structure, license.
Clear, concise, onboarding-friendly.
```

### Output Structure
- Title + one-line summary.
- Purpose, setup, usage examples.
- Structure and license.

### Rules
- Must not redefine the Virtual Human identity.
- Only document what exists; no invented features.
- Comply with the core standards.

---

## FR

### Objectif
Générer un README de projet ou de module.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{project}}` — le nom du projet ou module.
- `{{purpose}}` — ce qu'il fait.
- `{{usage}}` — comment l'utiliser.

### Modèle de prompt
```text
README de {{project}}, rédigé par {{character}}.
Sections : titre + résumé d'une ligne, {{purpose}}, installation, {{usage}} avec exemples, structure, licence.
Clair, concis, adapté à la prise en main.
```

### Structure de sortie
- Titre + résumé d'une ligne.
- Objectif, installation, exemples d'usage.
- Structure et licence.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Ne documenter que l'existant ; pas de fonctionnalités inventées.
- Respecter les standards `core/`.
