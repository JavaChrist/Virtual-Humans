# MINIMAX VIDEO GUIDE — TOM

Version : 1.0  
Statut : Guide fournisseur  
Fournisseur : MiniMax / Hailuo

---

# 1. OBJECTIF

Ce fichier adapte le Video SDK de Tom aux capacités vidéo de MiniMax.

Selon le modèle et l’accès disponible, plusieurs modes peuvent être proposés :

- text-to-video ;
- image-to-video ;
- première et dernière images ;
- référence de sujet ;
- commandes de caméra.

Toujours enregistrer le nom exact du modèle utilisé.

---

# 2. ORDRE DE PRÉFÉRENCE

Pour Tom :

1. référence de sujet officielle lorsqu’il est disponible ;
2. image-to-video ;
3. première et dernière images ;
4. text-to-video uniquement pour les plans non critiques.

---

# 3. PROMPT — IMAGE-TO-VIDEO

```text
Tom looks directly into the camera with a warm,
confident and natural expression.
He gives a small friendly smile and makes one subtle open-hand gesture.
Natural blinking, subtle breathing and realistic facial movement.
His posture remains relaxed and professional.
The camera remains stable at eye level.
Preserve his exact identity, hairstyle, proportions,
outfit and accessories throughout the shot.
```

---

# 4. PROMPT — SUJET DE RÉFÉRENCE

Lorsque le modèle accepte une référence du sujet :

```text
Use the provided subject reference as the permanent identity of Tom.

Create a medium close-up at eye level.
Tom looks directly into the camera,
speaks naturally and makes one small open-hand gesture.
His facial identity, hairstyle, skin tone,
body proportions and general appearance remain identical
to the reference throughout the shot.
Soft natural lighting and stable camera.
```

La référence doit provenir exclusivement de l’Identity Library.

---

# 5. PROMPT — PREMIÈRE ET DERNIÈRE IMAGES

```text
Create a smooth, realistic and continuous movement
from the first frame to the last frame.

Tom naturally transitions between the two poses.
His identity, hairstyle, face, body proportions,
outfit, accessories, lighting and background remain unchanged.
The camera remains stable.
No sudden movement.
```

Les deux images doivent être cohérentes avant génération.

---

# 6. COMMANDES DE CAMÉRA

Lorsque le modèle accepte une syntaxe spéciale de commande caméra :

* utiliser uniquement une commande documentée ;
* ne pas inventer de commande ;
* employer un seul mouvement principal ;
* stocker la commande exacte dans les métadonnées ;
* vérifier sa compatibilité avec le modèle sélectionné.

La documentation du fournisseur reste prioritaire pour la syntaxe technique.

Exemple conceptuel :

```text
[CAMERA_COMMAND]
Tom maintains direct eye contact and makes a subtle hand gesture.
```

Le placeholder doit être remplacé par une commande officiellement prise en charge.

---

# 7. PROMPT — TÉLÉPHONE

```text
Medium shot at eye level.

Tom holds a smartphone naturally at chest height.
He briefly looks at the screen,
then returns his gaze to the camera.
He presents the phone with a subtle controlled movement.
His hands, fingers and the phone remain stable.
Soft natural lighting.
Preserve his exact identity and outfit.
```

---

# 8. PROMPT — TEXT-TO-VIDEO POUR PLAN DE COUPE

```text
A clean modern workspace with soft natural daylight.
A smartphone rests on a minimalist desk beside a laptop.
Subtle cinematic camera movement.
Realistic materials and stable objects.
No person visible.
No readable text on screens.
```

Ce mode est adapté aux plans de coupe sans Tom.

---

# 9. API ET TÂCHES ASYNCHRONES

Lorsque MiniMax est utilisé par API :

* enregistrer l’identifiant de tâche ;
* conserver la requête envoyée ;
* suivre le statut jusqu’à la fin ;
* enregistrer le fichier final ;
* gérer les échecs et expirations ;
* ne pas considérer la création de tâche comme une génération réussie.

Métadonnées minimales :

```yaml
provider: minimax
model:
task_id:
mode:
prompt:
reference_file:
created_at:
completed_at:
status:
output_file:
```

---

# 10. ERREURS FRÉQUENTES

## Sujet ressemblant mais non identique

* utiliser une référence officielle plus forte ;
* limiter les changements d’angle ;
* réduire la durée ;
* éviter le text-to-video pour Tom.

## Commande caméra ignorée

* vérifier le modèle ;
* vérifier la syntaxe ;
* réduire les autres instructions ;
* tester la commande seule.

## Objet instable

* simplifier l’interaction ;
* réduire le mouvement ;
* incruster les détails au montage.

## Première et dernière images incompatibles

* rapprocher les poses ;
* conserver le même cadrage ;
* conserver la même lumière ;
* éviter une transformation trop importante.

---

# 11. CONTRÔLE QUALITÉ MINIMAX

Contrôler :

* fidélité à la référence ;
* visage sur toute la durée ;
* mains ;
* transitions ;
* mouvement demandé ;
* mouvement caméra ;
* stabilité des objets ;
* absence de transformation du décor.

---

# 12. RÈGLE FINALE

Les modes de référence doivent être privilégiés chaque fois que l’identité de Tom est visible.

Les commandes propres au fournisseur restent une couche technique et ne modifient jamais la mémoire du personnage.
