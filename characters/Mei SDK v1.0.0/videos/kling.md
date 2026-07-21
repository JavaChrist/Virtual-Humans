# KLING VIDEO GUIDE — MEI

Version : 1.0  
Statut : Guide fournisseur  
Fournisseur : Kling AI

---

# 1. OBJECTIF

Ce fichier définit la méthode de production de Mei avec Kling.

Les noms de modèles, modes et paramètres pouvant évoluer, leur disponibilité doit être vérifiée au moment de chaque production.

---

# 2. MODE RECOMMANDÉ

Pour Mei, privilégier :

- image-to-video ;
- référence de personnage lorsqu’elle est disponible ;
- mouvement modéré ;
- plans courts ;
- cadrages compatibles avec l’image initiale.

---

# 3. STRUCTURE DU PROMPT

```text
Shot type
Character action
Facial expression
Hand gesture
Gaze
Camera movement
Motion quality
Identity preservation
```

---

# 4. PROMPT — FACE CAMÉRA

```text
Medium close-up at eye level.

Mei looks directly into the camera with a warm,
natural and confident expression.
She makes one subtle open-hand gesture while speaking.
Natural blinking, gentle breathing and slight head movement.
Her posture remains relaxed and professional.

The camera is locked and stable.
Smooth realistic motion.
Preserve her exact facial identity, hairstyle,
body proportions, outfit and accessories.
```

---

# 5. PROMPT — GESTUELLE CONTRÔLÉE

```text
Mei maintains eye contact with the camera.
She slowly raises one open hand to chest height,
holds the gesture briefly, then gently lowers it.
Her other arm remains relaxed.
Natural facial movement and stable posture.
The camera remains fixed.
```

---

# 6. PROMPT — PRÉSENTATION D’APPLICATION

```text
Medium shot at eye level.

Mei holds a smartphone naturally in one hand.
She looks briefly at the screen,
then looks back at the camera with a friendly smile.
She slightly turns the phone toward the viewer.
Her hands and fingers remain stable and anatomically correct.
The camera remains fixed.
Preserve her exact appearance and outfit.
```

L’écran final de l’application doit être incrusté au montage.

---

# 7. PROMPT — MOUVEMENT CAMÉRA

Pour un mouvement léger :

```text
A slow, smooth camera push-in at eye level
while Mei remains relaxed and maintains direct eye contact.
```

Pour un suivi :

```text
The camera smoothly tracks Mei at a constant distance
while she walks slowly and naturally.
```

Ne pas cumuler plusieurs mouvements de caméra dans le même plan.

---

# 8. NEGATIVE PROMPT

Lorsque le mode utilisé propose un champ dédié :

```text
face morphing, identity drift, changing hairstyle,
changing clothes, deformed hands, extra fingers,
fused fingers, unstable eyes, robotic motion,
sudden movement, camera shake, background change,
object deformation, flicker, frozen expression
```

---

# 9. INTENSITÉ DU MOUVEMENT

Démarrer avec une intensité faible ou modérée lorsque ce réglage existe.

Augmenter uniquement si :

* le visage reste stable ;
* les mains restent correctes ;
* le look ne change pas ;
* la caméra reste cohérente.

Une intensité élevée n’est pas une valeur par défaut pour Mei.

---

# 10. IMAGES DE DÉPART

L’image doit :

* être nette ;
* avoir un visage suffisamment détaillé ;
* présenter des mains propres lorsqu’elles sont visibles ;
* contenir une pose physiquement crédible ;
* éviter les objets partiellement masqués ;
* correspondre au cadrage final attendu.

Une mauvaise image de départ ne doit pas être compensée par un prompt plus long.

---

# 11. LIP-SYNC

Lorsque le lip-sync intégré ou séparé est utilisé :

* employer la voix officielle ;
* limiter les mouvements de tête ;
* conserver le visage suffisamment visible ;
* éviter les mains devant la bouche ;
* contrôler chaque phrase ;
* rejeter les déformations des lèvres ou des dents.

---

# 12. ERREURS FRÉQUENTES

## Visage qui dérive

* réduire le mouvement ;
* raccourcir la durée ;
* utiliser une référence plus nette ;
* stabiliser la caméra.

## Gestes artificiels

* décrire un seul geste ;
* préciser sa direction ;
* décrire son début et sa fin ;
* réduire son amplitude.

## Déformation du téléphone

* limiter sa rotation ;
* garder l’objet près du corps ;
* remplacer l’écran en postproduction.

## Mouvement excessivement cinématique

* supprimer les adjectifs spectaculaires ;
* demander une caméra fixe ;
* demander un comportement documentaire ou réaliste.

---

# 13. CONTRÔLE QUALITÉ KLING

Vérifier :

* visage au début, au milieu et à la fin ;
* yeux ;
* lèvres ;
* dents ;
* doigts ;
* accessoires ;
* stabilité du look ;
* continuité de l’objet ;
* continuité du décor ;
* respect de la trajectoire de caméra.

---

# 14. RÈGLE FINALE

Avec Kling, les mouvements doivent être construits progressivement.

La stabilité de Mei doit être validée avant d’augmenter la complexité.
