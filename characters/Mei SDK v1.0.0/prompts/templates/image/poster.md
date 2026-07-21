# Poster Image Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: image
> Status: stable

---

## EN

### Purpose
Generate a promotional poster featuring the character.

### Variables
- `{{character}}` — the character identity reference.
- `{{headline}}` — poster headline.
- `{{event}}` — event or offer.
- `{{brand}}` — brand style reference.

### Prompt Template
```text
Promotional poster featuring {{character}}.
Headline: {{headline}}. Subject: {{event}}.
{{brand}} visual style, clear hierarchy, strong composition, space for headline and details.
```

### Output Structure
- Layout: clear visual hierarchy.
- Elements: character, headline, key details.
- Brand-aligned style.

### Rules
- Must not redefine the Virtual Human identity.
- Claims and offers must be truthful.
- Comply with the core photo, brand and legal standards.

---

## FR

### Objectif
Générer une affiche promotionnelle mettant en scène le personnage.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{headline}}` — titre de l'affiche.
- `{{event}}` — événement ou offre.
- `{{brand}}` — référence de style de marque.

### Modèle de prompt
```text
Affiche promotionnelle mettant en scène {{character}}.
Titre : {{headline}}. Sujet : {{event}}.
Style visuel {{brand}}, hiérarchie claire, composition forte, espace pour le titre et les détails.
```

### Structure de sortie
- Mise en page : hiérarchie visuelle claire.
- Éléments : personnage, titre, détails clés.
- Style aligné à la marque.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Les affirmations et offres doivent être véridiques.
- Respecter les standards photo, marque et légaux de `core/`.
