# Micro-Trottoir Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: video
> Status: stable

---

## EN

### Purpose
Generate a street-interview (vox pop) style video with a spontaneous tone.

### Variables
- `{{character}}` — the character identity reference.
- `{{question}}` — the single street question.
- `{{location}}` — outdoor public setting.
- `{{duration}}` — short target duration.

### Prompt Template
```text
Street-interview (vox pop) video of {{character}} in {{location}}.
Single question: {{question}}.
Handheld feel, natural outdoor light, spontaneous and lively delivery.
Duration {{duration}}.
```

### Output Structure
- Location: public outdoor setting.
- Style: spontaneous, handheld.
- Content: one question, natural answer.

### Rules
- Must not redefine the Virtual Human identity.
- Keep the spontaneous tone without breaking identity.
- Comply with the core standards and the active behavior.

---

## FR

### Objectif
Générer une vidéo de type micro-trottoir (vox pop) au ton spontané.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{question}}` — la question unique de rue.
- `{{location}}` — lieu public extérieur.
- `{{duration}}` — durée cible courte.

### Modèle de prompt
```text
Vidéo de type micro-trottoir de {{character}} à {{location}}.
Question unique : {{question}}.
Ambiance caméra à l'épaule, lumière naturelle extérieure, diction spontanée et vivante.
Durée {{duration}}.
```

### Structure de sortie
- Lieu : espace public extérieur.
- Style : spontané, caméra portée.
- Contenu : une question, réponse naturelle.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Garder le ton spontané sans rompre l'identité.
- Respecter les standards `core/` et le comportement actif.
