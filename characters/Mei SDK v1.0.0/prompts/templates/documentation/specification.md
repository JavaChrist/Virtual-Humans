# Specification Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: documentation
> Status: stable

---

## EN

### Purpose
Generate a clear specification document.

### Variables
- `{{character}}` — the character identity reference.
- `{{subject}}` — the feature or system to specify.
- `{{requirements}}` — the known requirements.
- `{{constraints}}` — constraints and non-goals.

### Prompt Template
```text
Specification for {{subject}}, authored by {{character}}.
Sections: overview, goals, {{requirements}}, {{constraints}}, acceptance criteria, open questions.
Precise, unambiguous, testable.
```

### Output Structure
- Overview and goals.
- Requirements and constraints.
- Acceptance criteria + open questions.

### Rules
- Must not redefine the Virtual Human identity.
- State assumptions; do not invent requirements.
- Comply with the core standards.

---

## FR

### Objectif
Générer un document de spécification clair.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{subject}}` — la fonctionnalité ou le système à spécifier.
- `{{requirements}}` — les exigences connues.
- `{{constraints}}` — contraintes et non-objectifs.

### Modèle de prompt
```text
Spécification de {{subject}}, rédigée par {{character}}.
Sections : vue d'ensemble, objectifs, {{requirements}}, {{constraints}}, critères d'acceptation, questions ouvertes.
Précis, sans ambiguïté, testable.
```

### Structure de sortie
- Vue d'ensemble et objectifs.
- Exigences et contraintes.
- Critères d'acceptation + questions ouvertes.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Énoncer les hypothèses ; ne pas inventer d'exigences.
- Respecter les standards `core/`.
