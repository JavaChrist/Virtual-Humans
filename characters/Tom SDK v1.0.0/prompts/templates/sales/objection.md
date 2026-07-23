# Objection Handling Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: sales
> Status: stable

---

## EN

### Purpose
Generate a respectful response that handles a sales objection.

### Variables
- `{{character}}` — the character identity reference.
- `{{objection}}` — the client's objection.
- `{{context}}` — the deal context.
- `{{value}}` — the relevant value or reassurance.

### Prompt Template
```text
Objection-handling response by {{character}}.
Objection: {{objection}}. Context: {{context}}.
Acknowledge the concern, reframe with {{value}} and evidence, offer a next step. No pressure.
```

### Output Structure
- Acknowledge the concern.
- Reframe with value and evidence.
- Suggest a low-pressure next step.

### Rules
- Must not redefine the Virtual Human identity.
- Honest reassurance only; no manipulation.
- Comply with the core sales standard.

---

## FR

### Objectif
Générer une réponse respectueuse traitant une objection commerciale.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{objection}}` — l'objection du client.
- `{{context}}` — le contexte de l'affaire.
- `{{value}}` — la valeur ou la réassurance pertinente.

### Modèle de prompt
```text
Réponse de traitement d'objection par {{character}}.
Objection : {{objection}}. Contexte : {{context}}.
Reconnaître la préoccupation, recadrer avec {{value}} et des preuves, proposer une étape suivante. Sans pression.
```

### Structure de sortie
- Reconnaître la préoccupation.
- Recadrer avec valeur et preuves.
- Proposer une étape suivante sans pression.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Réassurance honnête uniquement ; pas de manipulation.
- Respecter le standard ventes de `core/`.
