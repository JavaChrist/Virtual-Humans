# Avatar Image Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: image
> Status: stable

---

## EN

### Purpose
Generate a profile avatar image of the character.

### Variables
- `{{character}}` — the character identity reference.
- `{{expression}}` — expression reference.
- `{{background}}` — solid or simple background.

### Prompt Template
```text
Profile avatar of {{character}}, {{expression}} expression.
Centered face, {{background}} background, square 1:1 composition, sharp and clean, suitable for small sizes.
```

### Output Structure
- Format: square 1:1.
- Framing: centered face.
- Simple background for small sizes.

### Rules
- Must not redefine the Virtual Human identity.
- Keep the face consistent with the identity references.
- Comply with the core photo standard.

---

## FR

### Objectif
Générer une image d'avatar (photo de profil) du personnage.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{expression}}` — référence d'expression.
- `{{background}}` — fond uni ou simple.

### Modèle de prompt
```text
Avatar de profil de {{character}}, expression {{expression}}.
Visage centré, fond {{background}}, composition carrée 1:1, net et épuré, adapté aux petites tailles.
```

### Structure de sortie
- Format : carré 1:1.
- Cadrage : visage centré.
- Fond simple pour les petites tailles.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Garder le visage cohérent avec les références d'identité.
- Respecter le standard photo de `core/`.
