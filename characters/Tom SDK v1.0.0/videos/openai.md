# OPENAI VIDEO GUIDE — TOM

Version : 1.0  
Statut : Guide fournisseur  
Fournisseur : OpenAI

---

# 1. OBJECTIF

Ce fichier adapte le Video SDK de Tom aux modèles vidéo proposés par OpenAI.

Les modèles, interfaces, API et paramètres peuvent évoluer.

La disponibilité réil doit être contrôlée au moment de la production.

---

# 2. MODE RECOMMANDÉ

Pour maintenir l’identité de Tom :

- fournir une image officielle lorsque le produit le permet ;
- décrire précisément le plan ;
- limiter le nombre d’actions ;
- privilégier une continuité simple ;
- créer les séquences complexes en plusieurs plans.

---

# 3. STRUCTURE DE PROMPT

```text
Format visuel
Sujet
Action
Expression
Gestuelle
Caméra
Éclairage
Décor
Évolution temporelle
Continuité
Audio éventuel
```

---

# 4. PROMPT — FACE CAMÉRA

```text
Create a realistic vertical social-media video.

Medium close-up of Tom at eye level.
He looks directly into the camera with a warm,
confident and approachable expression.
He speaks naturally and makes one small open-hand gesture.
Natural blinking, subtle breathing and realistic facial movement.
His posture remains relaxed and professional.

The camera remains stable with a very slow push-in.
Soft natural lighting.
Clean modern background.

Preserve Tom's exact facial identity, hairstyle,
hair color, skin tone, body proportions,
outfit and accessories throughout the shot.
No sudden movement or visual transformation.
```

---

# 5. PROMPT — SCRIPT FRANÇAIS

Lorsque la génération prend en charge le dialogue :

```text
Tom looks directly into the camera and says in French:

« [SCRIPT VALIDÉ] »

His delivery is warm, clear, natural and professional.
He speaks at a conversational pace with short natural pauses.
His facial expression supports the meaning of the sentence.
He makes one subtle gesture while speaking.

No music.
No additional speaker.
Only light natural room tone.
```

---

# 6. PROMPT — SANS AUDIO

```text
Generate the video without dialogue or music.

Tom silently maintains direct eye contact,
gives a small natural smile
and makes one subtle open-hand gesture.
Only realistic ambient room tone if audio is generated.
```

La voix officielle sera ajoutée séparément.

---

# 7. PROMPT — PLAN PRODUIT

```text
Vertical medium shot at eye level.

Tom holds a smartphone naturally at chest height.
He briefly looks at the screen,
then returns his gaze to the camera.
He slightly presents the phone toward the viewer.
His hands and fingers remain natural and stable.
The phone keeps the same shape throughout the shot.

The camera remains stable.
Soft natural lighting.
Preserve his exact identity, outfit and accessories.
```

---

# 8. PROMPT — PLAN CINÉMATIQUE SIMPLE

```text
A realistic medium shot of Tom in a clean modern workspace.

He turns slightly toward the camera,
makes eye contact and gives a subtle confident smile.
The camera performs a slow smooth lateral movement.
Soft daylight enters from the side.
The scene remains natural, premium and understated.

Preserve Tom's exact appearance throughout the shot.
```

---

# 9. DÉCOUPAGE D’UNE VIDÉO

Pour une vidéo sociale de trente secondes :

```text
Plan 1 — Hook
3 à 5 secondes
Face caméra

Plan 2 — Explication
5 à 10 secondes
Face caméra ou plan taille

Plan 3 — Illustration
3 à 6 secondes
Produit ou plan de coupe

Plan 4 — Bénéfice
5 à 8 secondes
Face caméra

Plan 5 — CTA
3 à 5 secondes
Face caméra
```

Générer les plans séparément lorsque cela améliore la stabilité.

---

# 10. CONTINUITÉ

Pour relier plusieurs plans, conserver :

* la même image de référence ;
* le même look ;
* le même maquillage ;
* les mêmes accessoires ;
* une lumière compatible ;
* un décor compatible ;
* une position logique des objets.

Ne pas demander au modèle de mémoriser implicitement un plan précédent.

Chaque prompt doit contenir les informations nécessaires à la continuité.

---

# 11. ERREURS FRÉQUENTES

## Prompt trop littéraire

Correction :

* décrire ce qui est visible ;
* décrire ce qui bouge ;
* décrire l’ordre des actions ;
* retirer les intentions abstraites inutiles.

## Trop d’actions

Correction :

* diviser le plan ;
* conserver une action principale ;
* déplacer la complexité au montage.

## Identité instable

Correction :

* employer une référence officielle ;
* réduire les angles ;
* réduire la durée ;
* réduire les mouvements du visage.

## Dialogue incorrect

Correction :

* produire la voix séparément ;
* utiliser le texte exact ;
* contrôler les noms de produits et les mots français.

---

# 12. CONTRÔLE QUALITÉ OPENAI

Valider :

* identité ;
* expression ;
* regard ;
* mains ;
* vêtements ;
* accessoires ;
* caméra ;
* décor ;
* continuité ;
* voix ;
* synchronisation ;
* prononciation ;
* respect du script.

---

# 13. RÈGLE FINALE

Le prompt doit décrire un plan réalisable et observable.

Une intention marketing abstraite doit être traduite en comportement visible avant d’être envoyée au moteur.
