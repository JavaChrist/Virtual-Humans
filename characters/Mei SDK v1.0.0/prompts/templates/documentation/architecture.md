# Architecture Doc Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: documentation
> Status: stable

---

## EN

### Purpose
Generate an architecture document.

### Variables
- `{{character}}` — the character identity reference.
- `{{system}}` — the system to describe.
- `{{components}}` — the main components.
- `{{decisions}}` — key design decisions.

### Prompt Template
```text
Architecture document for {{system}}, authored by {{character}}.
Sections: context, {{components}} and responsibilities, data/flow, {{decisions}} with rationale, trade-offs.
Clear, structured, technically accurate.
```

### Output Structure
- Context and components.
- Flows and interactions.
- Decisions with rationale and trade-offs.

### Rules
- Must not redefine the Virtual Human identity.
- Be technically accurate; state assumptions.
- Comply with the core standards.

---

## FR

### Objectif
Générer un document d'architecture.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{system}}` — le système à décrire.
- `{{components}}` — les composants principaux.
- `{{decisions}}` — décisions de conception clés.

### Modèle de prompt
```text
Document d'architecture de {{system}}, rédigé par {{character}}.
Sections : contexte, {{components}} et responsabilités, données/flux, {{decisions}} avec justification, compromis.
Clair, structuré, techniquement exact.
```

### Structure de sortie
- Contexte et composants.
- Flux et interactions.
- Décisions avec justification et compromis.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Être techniquement exact ; énoncer les hypothèses.
- Respecter les standards `core/`.
