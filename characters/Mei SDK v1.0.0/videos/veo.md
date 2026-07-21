# VEO VIDEO GUIDE — MEI

Version : 1.0  
Statut : Guide fournisseur  
Fournisseur : Google  
Moteur : Veo

---

# 1. OBJECTIF

Ce fichier adapte le Video SDK de Mei aux générations réalisées avec Veo.

Les options disponibles peuvent dépendre :

- du modèle Veo utilisé ;
- de Vertex AI ;
- de Gemini ;
- de l’interface ;
- de la région ;
- de la date de production.

Toujours enregistrer le nom exact du modèle et les paramètres employés.

---

# 2. MODES RECOMMANDÉS

Ordre de préférence pour Mei :

1. image-to-video avec image officielle ;
2. références de sujet lorsqu’elles sont disponibles ;
3. première et dernière images pour contrôler une transition ;
4. text-to-video pour les décors et plans sans identité critique.

---

# 3. STRUCTURE DU PROMPT

Veo peut recevoir une description cinématographique structurée.

Ordre conseillé :

```text
Sujet
Action
Expression
Gestuelle
Décor
Cadrage
Caméra
Éclairage
Rythme
Audio ou dialogue
Contraintes de continuité
```

---

# 4. PROMPT — FACE CAMÉRA

```text
A realistic medium close-up of Mei at eye level.

Mei looks directly into the camera with a warm,
confident and approachable expression.
She speaks naturally and makes one small open-hand gesture.
Her breathing, blinking and facial movements are subtle and realistic.
Her posture remains relaxed and professional.

The camera is stable with a very slow cinematic push-in.
Soft natural lighting illuminates her face evenly.
The background remains clean, modern and unchanged.

Preserve Mei's facial identity, hairstyle, hair color,
skin tone, body proportions, outfit and accessories
throughout the entire shot.
```

---

# 5. PROMPT — AVEC DIALOGUE

Lorsque le modèle produit l’audio :

```text
Medium close-up at eye level.

Mei looks directly into the camera and says in French:
« [INSÉRER LE DIALOGUE VALIDÉ] »

She speaks with a warm, clear and professional voice.
Her delivery is natural, confident and conversational.
She makes one subtle open-hand gesture while speaking.
Her lip movement is synchronized with the dialogue.

The camera remains stable.
Soft natural lighting.
No background music.
No additional voices.
Preserve her exact identity throughout the shot.
```

Le dialogue doit être court.

Pour un texte long, préférer plusieurs plans.

---

# 6. PROMPT — TÉLÉPHONE

```text
Medium shot at eye level.

Mei holds a smartphone naturally at chest height.
She briefly looks at the phone screen,
then returns her gaze to the camera with a small confident smile.
She subtly turns the phone toward the viewer without moving it excessively.
Her fingers remain naturally positioned around the device.

The camera stays stable.
Soft realistic lighting.
The phone, her hands, her outfit and the background remain consistent.
Preserve Mei's exact facial identity throughout the shot.
```

---

# 7. PROMPT — PREMIÈRE ET DERNIÈRE IMAGE

Utiliser ce mode pour contrôler :

* une légère rotation du corps ;
* le passage d’une pose neutre à une pose de présentation ;
* un déplacement limité ;
* une transition entre deux cadrages compatibles.

Les deux images doivent conserver :

* le même visage ;
* la même tenue ;
* la même coiffure ;
* le même décor ;
* le même éclairage ;
* les mêmes accessoires.

Prompt :

```text
Create a smooth and realistic transition between the first and last frames.

Mei moves naturally from the initial pose to the final pose.
Her facial identity, hairstyle, body proportions,
outfit, accessories, lighting and background remain unchanged.
The motion is subtle, continuous and physically plausible.
The camera remains stable.
```

---

# 8. AUDIO

Lorsque l’audio natif est utilisé, définir explicitement :

* langue ;
* dialogue ;
* type de voix ;
* ambiance ;
* musique ;
* effets sonores ;
* éléments interdits.

Exemple :

```text
Audio:
clean studio-quality French dialogue,
subtle natural room tone,
no music,
no crowd,
no additional speaker,
no sound effects.
```

Ne pas laisser l’ambiance sonore entièrement implicite lorsqu’elle est importante.

---

# 9. PROMPT REWRITING

Lorsqu’une fonction d’amélioration automatique du prompt est active :

* comparer le prompt initial et le résultat ;
* vérifier qu’aucun détail d’identité n’a été ajouté ;
* vérifier qu’aucun nouveau vêtement n’a été inventé ;
* vérifier qu’aucune action supplémentaire n’a été introduite ;
* désactiver ou contourner la réécriture lorsqu’elle nuit à la cohérence.

Le moteur ne doit pas enrichir librement l’identité de Mei.

---

# 10. RÉFÉRENCES DE SUJET

Lorsqu’un mode de références multiples est disponible :

* utiliser uniquement des images officielles ;
* sélectionner des angles complémentaires ;
* conserver le même look ;
* éviter des maquillages ou éclairages incompatibles ;
* ne pas mélanger plusieurs périodes ou versions du personnage.

Jeu recommandé :

1. portrait frontal ;
2. vue trois-quarts ;
3. plan taille ou plein pied.

---

# 11. ERREURS FRÉQUENTES

## Le modèle ajoute une ambiance sonore

Préciser :

```text
No music. No additional voices. Only clean dialogue and subtle room tone.
```

## Le dialogue est trop long

Découper le texte en plusieurs plans.

## L’identité évolue

* renforcer les références ;
* réduire les actions ;
* raccourcir le plan ;
* utiliser un cadrage plus stable ;
* supprimer les mouvements de tête importants.

## Le moteur enrichit trop la scène

Décrire explicitement :

```text
The background remains unchanged.
No new objects enter the scene.
```

---

# 12. CONTRÔLE QUALITÉ VEO

Contrôler séparément :

* image ;
* identité ;
* mouvement ;
* dialogue ;
* synchronisation ;
* bruit de fond ;
* musique ;
* voix secondaires ;
* continuité de la scène.

Une excellente image avec une mauvaise voix ne doit pas être validée.

---

# 13. RÈGLE FINALE

Veo peut recevoir une direction de scène détaillée.

Cette richesse doit servir le plan, pas réinventer Mei.
