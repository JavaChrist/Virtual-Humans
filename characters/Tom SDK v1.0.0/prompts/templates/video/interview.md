# Interview Video Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: video
> Status: stable

---

## EN

### Purpose
Generate an interview-style video where the character answers questions.

### Variables
- `{{character}}` — the character identity reference.
- `{{questions}}` — list of interview questions.
- `{{setting}}` — environment and framing.
- `{{duration}}` — target duration.

### Prompt Template
```text
Interview-style video of {{character}} in {{setting}}.
Questions: {{questions}}.
The character answers naturally, one question at a time, seated or standing, medium shot.
Duration {{duration}}, calm pacing, authentic delivery.
```

### Output Structure
- Setting: consistent environment.
- Flow: question, then concise authentic answer.
- Framing: medium shot.

### Rules
- Must not redefine the Virtual Human identity.
- Answers must stay consistent with memory and identity.
- Comply with the core standards and the active behavior.

---

## FR

### Objectif
Générer une vidéo de type interview où le personnage répond à des questions.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{questions}}` — liste des questions d'interview.
- `{{setting}}` — environnement et cadrage.
- `{{duration}}` — durée cible.

### Modèle de prompt
```text
Vidéo de type interview de {{character}} dans {{setting}}.
Questions : {{questions}}.
Le personnage répond naturellement, une question à la fois, assis ou debout, plan moyen.
Durée {{duration}}, rythme calme, diction authentique.
```

### Structure de sortie
- Décor : environnement cohérent.
- Déroulé : question, puis réponse concise et authentique.
- Cadrage : plan moyen.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Les réponses doivent rester cohérentes avec la mémoire et l'identité.
- Respecter les standards `core/` et le comportement actif.
