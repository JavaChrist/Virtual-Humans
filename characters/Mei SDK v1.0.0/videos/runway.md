# RUNWAY VIDEO GUIDE — MEI

Version : 1.0  
Statut : Guide fournisseur  
Fournisseur : Runway

---

# 1. OBJECTIF

Ce fichier adapte les règles vidéo de Mei aux modèles vidéo disponibles dans Runway.

Les noms de modèles, durées et options pouvant évoluer, l’opérateur doit toujours vérifier les capacités présentes dans l’interface ou l’API au moment de la production.

---

# 2. MODE RECOMMANDÉ

Pour Mei, privilégier :

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

Mei looks directly into the camera and gives a small natural smile.
She makes one subtle open-hand gesture, then gently lowers her hand.
Natural blinking, subtle breathing and realistic facial movement.
Her posture remains relaxed and professional throughout the shot.
```

Ne pas redécrire inutilement tous les détails déjà présents dans l’image.

---

# 4. PROMPT — PRÉSENTATION FACE CAMÉRA

```text
The camera remains stable at eye level with a very slow cinematic push-in.

Mei maintains direct eye contact with the camera.
She speaks naturally with subtle breathing and realistic blinking.
She gives a small friendly smile and makes one restrained open-hand gesture.
Her head and shoulders move slightly in a natural human way.
Her posture stays relaxed and professional.
Smooth continuous motion throughout the shot.
```

---

# 5. PROMPT — PRÉSENTATION D’UN TÉLÉPHONE

```text
The camera remains stable at eye level.

Mei naturally holds the smartphone at chest height.
She briefly looks at the screen, then returns her gaze to the camera.
She presents the phone with one subtle, controlled gesture.
Her fingers remain steady around the device.
Natural blinking and subtle breathing.
Smooth realistic movement.
```

---

# 6. PROMPT — MARCHE

```text
Mei walks forward slowly with a relaxed, confident posture.
Her steps are natural and her arms move gently.
She maintains a soft friendly expression.
The camera tracks backward smoothly at eye level,
keeping the same distance from her throughout the shot.
The movement remains stable and cinematic.
```

---

# 7. PROMPT — MOUVEMENT MINIMAL

Lorsque la stabilité de l’identité est prioritaire :

```text
Locked camera.

Mei remains mostly still while maintaining direct eye contact.
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
She slowly raises her right hand.
```

Plutôt que :

```text
She is confident and engaging.
```

La seconde formulation décrit une intention, mais pas un mouvement visible précis.

## Décrire la chronologie

```text
At first, Mei looks into the camera.
She then makes a small hand gesture.
At the end, she gently lowers her hand.
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
