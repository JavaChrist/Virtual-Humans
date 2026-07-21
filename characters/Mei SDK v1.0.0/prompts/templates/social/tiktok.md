# TikTok Template

> Virtual Humans SDK — Prompt Architecture v1.0.0
> Layer: template
> Category: social
> Status: stable

---

## EN

### Purpose
Generate a TikTok caption and short script hook.

### Variables
- `{{character}}` — the character identity reference.
- `{{topic}}` — the subject.
- `{{hook}}` — opening hook.
- `{{cta}}` — call to action.

### Prompt Template
```text
TikTok caption and hook by {{character}} about {{topic}}.
Script hook (first 3 seconds): {{hook}}.
Energetic, trend-aware tone, concise caption, {{cta}}, a few relevant hashtags.
```

### Output Structure
- Script hook for the first seconds.
- Concise caption.
- Single CTA, relevant hashtags.

### Rules
- Must not redefine the Virtual Human identity.
- Keep it truthful and platform-appropriate.
- Comply with the core social standard.

---

## FR

### Objectif
Générer une légende TikTok et une accroche de script courte.

### Variables
- `{{character}}` — référence d'identité du personnage.
- `{{topic}}` — le sujet.
- `{{hook}}` — accroche d'ouverture.
- `{{cta}}` — appel à l'action.

### Modèle de prompt
```text
Légende et accroche TikTok de {{character}} sur {{topic}}.
Accroche de script (3 premières secondes) : {{hook}}.
Ton énergique et dans l'air du temps, légende concise, {{cta}}, quelques hashtags pertinents.
```

### Structure de sortie
- Accroche de script pour les premières secondes.
- Légende concise.
- Un seul CTA, hashtags pertinents.

### Règles
- Ne pas redéfinir l'identité du Virtual Human.
- Rester véridique et adapté à la plateforme.
- Respecter le standard social de `core/`.
