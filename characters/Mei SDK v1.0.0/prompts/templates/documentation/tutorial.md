# Tutorial Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: documentation
> Status: stable

---

## EN

### Purpose
Generate a step-by-step tutorial.

### Variables
- `{{character}}` — the character identity reference.
- `{{goal}}` — what the reader will achieve.
- `{{prerequisites}}` — prerequisites.
- `{{steps}}` — the ordered steps.

### Prompt Template
```text
Tutorial by {{character}} to achieve {{goal}}.
Sections: what you'll build, {{prerequisites}}, {{steps}} as numbered actions with expected results, troubleshooting, next steps.
Beginner-friendly, verifiable at each step.
```

### Output Structure
- Goal + prerequisites.
- Numbered steps with expected results.
- Troubleshooting + next steps.

### Rules
- Must not redefine the Virtual Human identity.
- Steps must be accurate and reproducible.
- Comply with the core standards.

---

## FR

### Objectif
Générer un tutoriel pas à pas.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{goal}}` — ce que le lecteur va réaliser.
- `{{prerequisites}}` — prérequis.
- `{{steps}}` — les étapes ordonnées.

### Modèle de prompt
```text
Tutoriel de {{character}} pour réaliser {{goal}}.
Sections : ce que vous allez construire, {{prerequisites}}, {{steps}} en actions numérotées avec résultats attendus, dépannage, étapes suivantes.
Accessible aux débutants, vérifiable à chaque étape.
```

### Structure de sortie
- Objectif + prérequis.
- Étapes numérotées avec résultats attendus.
- Dépannage + étapes suivantes.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Les étapes doivent être exactes et reproductibles.
- Respecter les standards `core/`.
