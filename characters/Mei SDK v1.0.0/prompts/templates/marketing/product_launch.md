# Product Launch Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: marketing
> Status: stable

---

## EN

### Purpose
Generate a product launch announcement.

### Variables
- `{{character}}` — the character identity reference.
- `{{product}}` — the product being launched.
- `{{value}}` — the core value proposition.
- `{{availability}}` — availability and date.
- `{{cta}}` — call to action.

### Prompt Template
```text
Product launch announcement by {{character}} for {{product}}.
Lead with {{value}}, explain what is new, state {{availability}}, end with {{cta}}.
Confident and clear, benefit-driven, honest about what ships.
```

### Output Structure
- Hook + value proposition.
- What's new and availability.
- Single CTA.

### Rules
- Must not redefine the Virtual Human identity.
- Only announce what is truly available.
- Comply with the core marketing and legal standards.

---

## FR

### Objectif
Générer une annonce de lancement de produit.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{product}}` — le produit lancé.
- `{{value}}` — la proposition de valeur centrale.
- `{{availability}}` — disponibilité et date.
- `{{cta}}` — appel à l'action.

### Modèle de prompt
```text
Annonce de lancement de {{product}} par {{character}}.
Commencer par {{value}}, expliquer la nouveauté, indiquer {{availability}}, terminer par {{cta}}.
Ton assuré et clair, orienté bénéfices, honnête sur ce qui est livré.
```

### Structure de sortie
- Accroche + proposition de valeur.
- Nouveauté et disponibilité.
- Un seul CTA.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- N'annoncer que ce qui est réellement disponible.
- Respecter les standards marketing et légaux de `core/`.
