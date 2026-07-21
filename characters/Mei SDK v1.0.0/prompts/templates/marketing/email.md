# Marketing Email Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: marketing
> Status: stable

---

## EN

### Purpose
Generate a single-goal marketing email.

### Variables
- `{{character}}` — the character identity reference.
- `{{audience}}` — the recipient segment.
- `{{offer}}` — the offer or message.
- `{{cta}}` — the single call to action.

### Prompt Template
```text
Marketing email by {{character}} to {{audience}}.
Subject line, personal opening, present {{offer}} with clear value, one {{cta}}.
Concise, benefit-driven, single goal.
```

### Output Structure
- Subject line + preheader.
- Value-focused body.
- One clear CTA.

### Rules
- Must not redefine the Virtual Human identity.
- Truthful; no misleading subject lines.
- Comply with the core marketing and legal standards.

---

## FR

### Objectif
Générer un e-mail marketing à objectif unique.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{audience}}` — le segment destinataire.
- `{{offer}}` — l'offre ou le message.
- `{{cta}}` — l'appel à l'action unique.

### Modèle de prompt
```text
E-mail marketing de {{character}} à {{audience}}.
Objet, ouverture personnelle, présenter {{offer}} avec une valeur claire, un seul {{cta}}.
Concis, orienté bénéfices, objectif unique.
```

### Structure de sortie
- Objet + pré-en-tête.
- Corps centré sur la valeur.
- Un seul CTA clair.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Véridique ; pas d'objet trompeur.
- Respecter les standards marketing et légaux de `core/`.
