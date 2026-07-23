# Green Screen Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: video
> Status: stable

---

## EN

### Purpose
Generate a green-screen video of the character for later compositing.

### Variables
- `{{character}}` — the character identity reference.
- `{{topic}}` — the subject or message.
- `{{duration}}` — target duration.
- `{{outfit}}` — selected outfit reference.
- `{{tone}}` — active behavior tone.

### Prompt Template
```text
{{character}} speaking directly to camera on a uniform green background.
Subject: {{topic}}.
Duration: {{duration}}. Outfit: {{outfit}}. Tone: {{tone}}.
Even lighting, no shadows on the background, stable framing, lips synced to speech.
```

### Output Structure
- Background: uniform green, evenly lit.
- Framing: consistent, centered subject.
- Delivery: clear speech aligned with `{{tone}}`.

### Rules
- Must not redefine the Virtual Human identity.
- Keep identity, outfit and voice consistent with memory.
- Comply with the core standards and the active behavior.

---

## FR

### Objectif
Générer une vidéo sur fond vert du personnage en vue d'une incrustation ultérieure.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{topic}}` — le sujet ou le message.
- `{{duration}}` — durée cible.
- `{{outfit}}` — référence de tenue.
- `{{tone}}` — ton du comportement actif.

### Modèle de prompt
```text
{{character}} s'adresse directement à la caméra sur un fond vert uniforme.
Sujet : {{topic}}.
Durée : {{duration}}. Tenue : {{outfit}}. Ton : {{tone}}.
Éclairage homogène, aucune ombre sur le fond, cadrage stable, lèvres synchronisées.
```

### Structure de sortie
- Fond : vert uniforme, bien éclairé.
- Cadrage : cohérent, sujet centré.
- Diction : claire, alignée sur `{{tone}}`.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Conserver identité, tenue et voix cohérentes avec la mémoire.
- Respecter les standards `core/` et le comportement actif.
