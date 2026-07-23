# Newsletter Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: marketing
> Status: stable

---

## EN

### Purpose
Generate a newsletter issue.

### Variables
- `{{character}}` — the character identity reference.
- `{{theme}}` — the issue theme.
- `{{items}}` — the content items.
- `{{cta}}` — primary call to action.

### Prompt Template
```text
Newsletter issue by {{character}} on {{theme}}.
Subject line, short intro, then {{items}} as concise sections, close with {{cta}}.
Valuable, skimmable, consistent voice.
```

### Output Structure
- Subject line + short intro.
- Sections from `{{items}}`.
- Single closing CTA.

### Rules
- Must not redefine the Virtual Human identity.
- Deliver real value; claims must be truthful.
- Comply with the core marketing and legal standards.

---

## FR

### Objectif
Générer un numéro de newsletter.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{theme}}` — le thème du numéro.
- `{{items}}` — les éléments de contenu.
- `{{cta}}` — appel à l'action principal.

### Modèle de prompt
```text
Numéro de newsletter de {{character}} sur {{theme}}.
Objet de l'e-mail, courte intro, puis {{items}} en sections concises, clôture avec {{cta}}.
Utile, facile à survoler, voix cohérente.
```

### Structure de sortie
- Objet + courte intro.
- Sections à partir de `{{items}}`.
- Un seul CTA de clôture.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Apporter une vraie valeur ; affirmations véridiques.
- Respecter les standards marketing et légaux de `core/`.
