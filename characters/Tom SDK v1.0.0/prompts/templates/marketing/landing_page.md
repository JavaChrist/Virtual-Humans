# Landing Page Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: marketing
> Status: stable

---

## EN

### Purpose
Generate landing page copy that converts around a single offer.

### Variables
- `{{character}}` — the character identity reference.
- `{{offer}}` — the product or offer.
- `{{audience}}` — the target audience.
- `{{benefits}}` — key benefits.
- `{{cta}}` — primary call to action.

### Prompt Template
```text
Landing page copy for {{offer}}, voiced by {{character}} for {{audience}}.
Sections: hero headline + subheadline, {{benefits}} as benefit blocks, proof, FAQ, primary {{cta}}.
Clear value first, benefit-driven, one primary action.
```

### Output Structure
- Hero: headline + subheadline.
- Benefit blocks from `{{benefits}}`.
- Proof, FAQ, single primary CTA.

### Rules
- Must not redefine the Virtual Human identity.
- Claims must be truthful; no invented proof.
- Comply with the core marketing and legal standards.

---

## FR

### Objectif
Générer le texte d'une landing page qui convertit autour d'une offre unique.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{offer}}` — le produit ou l'offre.
- `{{audience}}` — l'audience cible.
- `{{benefits}}` — bénéfices clés.
- `{{cta}}` — appel à l'action principal.

### Modèle de prompt
```text
Texte de landing page pour {{offer}}, porté par {{character}} pour {{audience}}.
Sections : titre héros + sous-titre, {{benefits}} en blocs de bénéfices, preuves, FAQ, {{cta}} principal.
Valeur claire d'abord, orienté bénéfices, une seule action principale.
```

### Structure de sortie
- Héros : titre + sous-titre.
- Blocs de bénéfices à partir de `{{benefits}}`.
- Preuves, FAQ, un seul CTA principal.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Affirmations véridiques ; aucune preuve inventée.
- Respecter les standards marketing et légaux de `core/`.
