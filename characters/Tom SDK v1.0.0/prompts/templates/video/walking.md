# Walking Video Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: video
> Status: stable

---

## EN

### Purpose
Generate a walking-and-talking video with dynamic movement.

### Variables
- `{{character}}` — the character identity reference.
- `{{message}}` — the spoken message.
- `{{environment}}` — walking environment.
- `{{duration}}` — target duration.

### Prompt Template
```text
Walking-and-talking video of {{character}} moving through {{environment}}.
Message: {{message}}.
Tracking shot following the character, natural gait, stable subject, coherent depth of field.
Duration {{duration}}.
```

### Output Structure
- Movement: continuous walking.
- Camera: tracking shot.
- Delivery: natural while moving.

### Rules
- Must not redefine the Virtual Human identity.
- Keep gait, identity and voice consistent with memory.
- Comply with the core standards and the active behavior.

---

## FR

### Objectif
Générer une vidéo en marchant et parlant, avec un mouvement dynamique.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{message}}` — le message parlé.
- `{{environment}}` — environnement de marche.
- `{{duration}}` — durée cible.

### Modèle de prompt
```text
Vidéo en marchant et parlant de {{character}} traversant {{environment}}.
Message : {{message}}.
Plan de suivi (tracking) accompagnant le personnage, démarche naturelle, sujet stable, profondeur de champ cohérente.
Durée {{duration}}.
```

### Structure de sortie
- Mouvement : marche continue.
- Caméra : plan de suivi.
- Diction : naturelle en mouvement.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Conserver démarche, identité et voix cohérentes avec la mémoire.
- Respecter les standards `core/` et le comportement actif.
