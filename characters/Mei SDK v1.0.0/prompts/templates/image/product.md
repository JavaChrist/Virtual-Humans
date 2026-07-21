# Product Image Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: image
> Status: stable

---

## EN

### Purpose
Generate an image presenting a product together with the character.

### Variables
- `{{character}}` — the character identity reference.
- `{{product}}` — product reference.
- `{{context}}` — usage context or setting.
- `{{brand}}` — brand style reference.

### Prompt Template
```text
{{character}} presenting {{product}} in {{context}}.
{{brand}} visual style, product clearly visible and in focus, natural interaction, clean composition.
```

### Output Structure
- Focus: product clearly visible.
- Interaction: natural with the character.
- Brand-aligned style.

### Rules
- Must not redefine the Virtual Human identity.
- Represent the product accurately.
- Comply with the core photo, brand and legal standards.

---

## FR

### Objectif
Générer une image présentant un produit avec le personnage.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{product}}` — référence du produit.
- `{{context}}` — contexte d'usage ou décor.
- `{{brand}}` — référence de style de marque.

### Modèle de prompt
```text
{{character}} présentant {{product}} dans {{context}}.
Style visuel {{brand}}, produit bien visible et net, interaction naturelle, composition épurée.
```

### Structure de sortie
- Netteté : produit bien visible.
- Interaction : naturelle avec le personnage.
- Style aligné à la marque.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Représenter le produit fidèlement.
- Respecter les standards photo, marque et légaux de `core/`.
