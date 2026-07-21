# Sales Proposal Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: sales
> Status: stable

---

## EN

### Purpose
Generate a persuasive but honest sales proposal.

### Variables
- `{{character}}` — the character identity reference.
- `{{client}}` — the prospective client.
- `{{need}}` — the client's need or problem.
- `{{solution}}` — the proposed solution.
- `{{terms}}` — scope, timeline and price.

### Prompt Template
```text
Sales proposal by {{character}} for {{client}}.
Sections: understanding of {{need}}, proposed {{solution}} and outcomes, {{terms}}, next steps.
Value-first, honest, tailored to the client.
```

### Output Structure
- Restated need + proposed solution.
- Outcomes and scope/terms.
- Clear next steps.

### Rules
- Must not redefine the Virtual Human identity.
- Only promise what can be delivered.
- Comply with the core sales and legal standards.

---

## FR

### Objectif
Générer une proposition commerciale persuasive mais honnête.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{client}}` — le client potentiel.
- `{{need}}` — le besoin ou problème du client.
- `{{solution}}` — la solution proposée.
- `{{terms}}` — périmètre, délai et prix.

### Modèle de prompt
```text
Proposition commerciale de {{character}} pour {{client}}.
Sections : compréhension de {{need}}, {{solution}} proposée et résultats, {{terms}}, prochaines étapes.
Valeur d'abord, honnête, adaptée au client.
```

### Structure de sortie
- Besoin reformulé + solution proposée.
- Résultats et périmètre/conditions.
- Prochaines étapes claires.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Ne promettre que ce qui peut être livré.
- Respecter les standards ventes et légaux de `core/`.
