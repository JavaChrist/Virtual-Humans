# RUNWAY VIDEO GUIDE — TOM

Version : 1.0  
Statut : Guide fournisseur  
Fournisseur : Runway

---

# 1. OBJECTIF

Ce fichier adapte les règles vidéo de Tom aux modèles vidéo disponibles dans Runway.

Les noms de modèles, durées et options pouvant évoluer, l’opérateur doit toujours vérifier les capacités présentes dans l’interface ou l’API au moment de la production.

---

# 2. MODE RECOMMANDÉ

Pour Tom, privilégier :

```text
Image-to-video
```

L’image de référence définit :

* l’identité ;
* le cadrage ;
* le look ;
* le décor ;
* l’éclairage ;
* la composition initiale.

Le prompt doit principalement décrire :

* le mouvement ;
* l’action ;
* la caméra ;
* l’évolution temporelle.

Le text-to-video reste adapté aux plans sans exigence forte de continuité du personnage.

---

# 3. STRUCTURE DU PROMPT

Structure recommandée :

```text
Camera + subject motion + gesture + gaze + temporal progression + stability
```

Exemple :

```text
The camera remains at eye level with a very slow push-in.

Tom looks directly into the camera and gives a small natural smile.
He makes one subtle open-hand gesture, then gently lowers his hand.
Natural blinking, subtle breathing and realistic facial movement.
His posture remains relaxed and professional throughout the shot.
```

Ne pas redécrire inutilement tous les détails déjà présents dans l’image.

---

# 4. PROMPT — PRÉSENTATION FACE CAMÉRA

```text
The camera remains stable at eye level with a very slow cinematic push-in.

Tom maintains direct eye contact with the camera.
He speaks naturally with subtle breathing and realistic blinking.
He gives a small friendly smile and makes one restrained open-hand gesture.
His head and shoulders move slightly in a natural human way.
His posture stays relaxed and professional.
Smooth continuous motion throughout the shot.
```

---

# 5. PROMPT — PRÉSENTATION D’UN TÉLÉPHONE

```text
The camera remains stable at eye level.

Tom naturally holds the smartphone at chest height.
He briefly looks at the screen, then returns his gaze to the camera.
He presents the phone with one subtle, controlled gesture.
His fingers remain steady around the device.
Natural blinking and subtle breathing.
Smooth realistic movement.
```

---

# 6. PROMPT — MARCHE

```text
Tom walks forward slowly with a relaxed, confident posture.
His steps are natural and his arms move gently.
He maintains a soft friendly expression.
The camera tracks backward smoothly at eye level,
keeping the same distance from his throughout the shot.
The movement remains stable and cinematic.
```

---

# 7. PROMPT — MOUVEMENT MINIMAL

Lorsque la stabilité de l’identité est prioritaire :

```text
Locked camera.

Tom remains mostly still while maintaining direct eye contact.
Only subtle breathing, natural blinking,
a slight head movement and a small friendly smile.
Realistic minimal human motion.
```

---

# 8. RÈGLES SPÉCIFIQUES

## Commencer simplement

La première génération doit contenir :

* une action ;
* un mouvement de caméra maximum ;
* une expression ;
* aucun changement de décor.

## Décrire le mouvement

Privilégier :

```text
He slowly raises his right hand.
```

Plutôt que :

```text
He is confident and engaging.
```

La seconde formulation décrit une intention, mais pas un mouvement visible précis.

## Décrire la chronologie

```text
At first, Tom looks into the camera.
He then makes a small hand gesture.
At the end, he gently lowers his hand.
```

## Préserver le cadrage

Ne pas demander une action incompatible avec l’image de départ.

Une image cadrée en plan poitrine ne doit pas recevoir une instruction demandant une marche en plein pied.

---

# 9. ITÉRATION

Procédure recommandée :

1. image officielle validée ;
2. mouvement minimal ;
3. validation du visage ;
4. ajout d’un geste ;
5. validation des mains ;
6. ajout éventuel d’un mouvement de caméra ;
7. sélection du meilleur résultat ;
8. lip-sync séparé si nécessaire.

---

# 10. ERREURS FRÉQUENTES

## Mouvement trop important

Correction :

* réduire le nombre d’actions ;
* supprimer les grands gestes ;
* stabiliser la caméra.

## Visage instable

Correction :

* choisir une meilleure image de référence ;
* réduire le mouvement de tête ;
* raccourcir le plan ;
* utiliser un cadrage plus stable.

## Mains déformées

Correction :

* limiter les gestes ;
* garder les mains éloignées du visage ;
* utiliser une pose de départ claire ;
* éviter les interactions complexes avec un objet.

## Téléphone instable

Correction :

* limiter le mouvement du téléphone ;
* conserver la main près du torse ;
* incruster l’écran au montage.

---

# 11. NEGATIVE PROMPT

Lorsque l’interface ou le modèle accepte un negative prompt séparé, utiliser la version canonique de `shared.md`.

Si aucun champ négatif n’est proposé, ne pas transformer le prompt principal en longue liste d’interdictions.

Décrire prioritairement ce qui doit se produire.

---

# 12. CONTRÔLE QUALITÉ RUNWAY

Valider :

* stabilité de l’identité ;
* cohérence du visage entre la première et la dernière image ;
* mouvement naturel des yeux ;
* stabilité des mains ;
* stabilité des vêtements ;
* respect du mouvement demandé ;
* absence de mouvement caméra parasite ;
* absence de transformation du décor.

---

# 13. RÈGLE FINALE

Dans Runway, l’image décrit l’apparence.

Le prompt décrit principalement ce qui bouge et comment cela bouge.
