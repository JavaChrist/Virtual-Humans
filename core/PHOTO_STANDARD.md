# PHOTO STANDARD

> Virtual Humans SDK
> Standard global de création, de validation et d’archivage des images fixes
> Version : 1.0.0
> Statut : actif

---

# 1. Objectif

Ce document définit les règles globales applicables à toutes les images fixes produites dans le cadre du **Virtual Humans SDK**.

Il garantit :

* la cohérence visuelle des personnages ;
* la stabilité de leur identité ;
* la qualité photographique ;
* la compatibilité avec les workflows d’image et de vidéo ;
* la traçabilité des générations ;
* la réutilisation fiable des assets ;
* la préparation de références propres pour les moteurs vidéo.

Ce standard s’applique à tous les personnages présents et futurs dans :

```text
characters/
```

---

# 2. Champ d’application

Ce standard couvre notamment :

* les portraits ;
* les photos plein pied ;
* les profils ;
* les expressions ;
* les poses ;
* les tenues ;
* les selfies ;
* les images de présentation ;
* les miniatures ;
* les fonds verts ;
* les images publicitaires ;
* les visuels pour réseaux sociaux ;
* les images de référence pour la vidéo ;
* les planches de cohérence ;
* les images générées par intelligence artificielle.

---

# 3. Principe fondamental

Une image officielle doit d’abord préserver l’identité du personnage.

L’ordre de priorité est :

```text
Identité
→ Cohérence
→ Lisibilité
→ Réalisme
→ Composition
→ Créativité
```

Une image visuellement impressionnante mais non fidèle au personnage doit être rejetée.

---

# 4. Source de vérité

La validation d’une image doit s’appuyer sur :

```text
99_CHARACTER_LOCK.md
00_IDENTITY.md
01_APPEARANCE.md
03_WARDROBE.md
05_CAMERA.md
assets/identity/
assets/poses/
assets/expressions/
assets/outfits/
```

Les assets maîtres validés priment toujours sur une nouvelle génération.

Une image générée ne devient jamais automatiquement une nouvelle référence officielle.

---

# 5. Catégories d’images

Chaque image doit appartenir à une catégorie explicite.

Catégories recommandées :

```text
identity
portrait
profile
full-body
pose
expression
outfit
selfie
green-screen
social
marketing
product
video-reference
thumbnail
draft
```

Une image ne doit pas être utilisée dans un contexte différent sans validation.

Exemple :

Une image `draft` ne doit pas servir de référence maître.

---

# 6. Identité visuelle

Chaque image doit préserver les éléments identitaires permanents du personnage.

Cela inclut notamment :

* forme du visage ;
* proportions ;
* structure osseuse ;
* yeux ;
* nez ;
* bouche ;
* sourcils ;
* cheveux ;
* couleur de peau ;
* âge apparent ;
* morphologie ;
* signes distinctifs ;
* niveau de réalisme.

Les variations de lumière, de tenue ou de pose ne doivent pas modifier l’identité.

---

# 7. Visage

Le visage doit rester immédiatement reconnaissable.

Il faut vérifier :

* la symétrie naturelle ;
* la cohérence des yeux ;
* la forme des paupières ;
* la couleur des iris ;
* la position des sourcils ;
* la forme du nez ;
* les proportions de la bouche ;
* la mâchoire ;
* le menton ;
* la texture de peau ;
* la ligne des cheveux ;
* l’âge apparent.

Les erreurs suivantes entraînent un rejet :

* visage fusionné ;
* visage générique ;
* changement d’origine apparente ;
* âge fortement différent ;
* yeux incohérents ;
* bouche déformée ;
* peau artificielle ;
* traits trop éloignés des références.

---

# 8. Corps et proportions

Le corps doit rester cohérent avec les références validées.

À contrôler :

* taille apparente ;
* largeur des épaules ;
* longueur des bras ;
* longueur des jambes ;
* proportions du torse ;
* morphologie générale ;
* posture ;
* volume du corps ;
* position du bassin ;
* taille des mains ;
* taille de la tête par rapport au corps.

Il est interdit d’accepter une image où le personnage semble être une autre personne à cause d’un changement important de morphologie.

---

# 9. Mains

Les mains constituent un point de contrôle obligatoire.

Chaque image doit être vérifiée pour détecter :

* doigts supplémentaires ;
* doigts manquants ;
* doigts fusionnés ;
* articulations impossibles ;
* paumes déformées ;
* ongles incohérents ;
* objets traversant les mains ;
* téléphone mal tenu ;
* orientation impossible des poignets.

Une erreur visible sur les mains peut suffire à rejeter l’image.

---

# 10. Pieds et chaussures

Les pieds et chaussures doivent être vérifiés dans les plans plein pied.

Points de contrôle :

* nombre de pieds ;
* orientation ;
* position au sol ;
* symétrie ;
* cohérence avec la pose ;
* chaussures identiques ;
* absence de fusion avec le sol ;
* absence de déformation ;
* cohérence avec la tenue.

---

# 11. Cheveux

Les cheveux doivent respecter la définition officielle du personnage.

Il faut contrôler :

* couleur ;
* longueur ;
* coupe ;
* volume ;
* raie ;
* texture ;
* implantation ;
* comportement naturel ;
* cohérence avec le mouvement ;
* absence de mèches impossibles.

Une variation légère de coiffage est autorisée si elle reste compatible avec l’identité.

Un changement majeur de coiffure nécessite une validation explicite.

---

# 12. Peau

La peau doit conserver un rendu réaliste.

Elle ne doit pas paraître :

* plastique ;
* cireuse ;
* trop lissée ;
* excessivement brillante ;
* granuleuse artificiellement ;
* tachée sans raison ;
* incohérente entre le visage et le corps.

La texture doit rester visible sans exagération.

Les retouches ne doivent pas effacer entièrement les détails naturels.

---

# 13. Expressions

Les expressions doivent provenir de la bibliothèque officielle ou rester compatibles avec elle.

Elles doivent être :

* lisibles ;
* naturelles ;
* cohérentes avec la personnalité ;
* adaptées au contexte ;
* compatibles avec la posture ;
* cohérentes avec le regard.

Les expressions excessives ou caricaturales doivent être évitées sauf usage explicitement validé.

---

# 14. Regard

Le regard doit être cohérent avec la scène.

Possibilités principales :

```text
regard caméra
regard vers un interlocuteur
regard vers un objet
regard hors champ
regard en mouvement
```

Un regard caméra doit donner l’impression que le personnage regarde réellement l’objectif.

Les yeux ne doivent pas diverger ni viser des directions incompatibles.

---

# 15. Poses

Les poses doivent être naturelles et anatomiquement crédibles.

Une pose doit respecter :

* l’équilibre ;
* la répartition du poids ;
* la position des épaules ;
* la position des hanches ;
* la cohérence des jambes ;
* la position des bras ;
* l’orientation des mains ;
* l’attitude du personnage ;
* le contexte.

Les poses impossibles, rigides ou artificielles doivent être rejetées.

---

# 16. Tenues

Les tenues doivent correspondre à la garde-robe officielle.

Chaque look validé doit être associé à un identifiant :

```text
LOOK_001
LOOK_002
LOOK_003
```

L’image doit respecter :

* les couleurs ;
* les matières ;
* la coupe ;
* les accessoires ;
* les chaussures ;
* les proportions ;
* le niveau de formalité ;
* le contexte prévu.

Une tenue générée ne devient pas un look officiel sans création et validation de son package.

---

# 17. Objets et accessoires

Les objets doivent être :

* correctement dimensionnés ;
* correctement tenus ;
* cohérents avec la scène ;
* orientés naturellement ;
* visuellement crédibles ;
* compatibles avec les mains ;
* exempts de déformation.

Pour un smartphone, contrôler notamment :

* taille réaliste ;
* orientation correcte ;
* écran dans le bon sens ;
* doigts correctement positionnés ;
* absence de fusion avec la main ;
* caméra cohérente ;
* perspective correcte.

---

# 18. Marques et logos

Les logos doivent être utilisés uniquement lorsqu’ils sont autorisés.

Ils doivent rester :

* lisibles ;
* correctement orientés ;
* fidèles ;
* non déformés ;
* non inventés ;
* cohérents avec le produit présenté.

Les faux logos ou logos approximatifs doivent être évités.

Lorsqu’un moteur ne garantit pas la fidélité du logo, il est préférable d’utiliser une version sans logo puis d’ajouter le logo en postproduction.

---

# 19. Décors

Le décor doit soutenir le personnage sans distraire.

Il doit être :

* cohérent avec la scène ;
* crédible ;
* lisible ;
* compatible avec la tenue ;
* compatible avec l’usage ;
* adapté au cadrage ;
* suffisamment distinct du personnage.

Les arrière-plans doivent éviter :

* les objets fondus ;
* les perspectives impossibles ;
* les textes illisibles ;
* les personnes déformées ;
* les incohérences architecturales majeures ;
* les éléments inutiles.

---

# 20. Fond vert

Les images sur fond vert doivent utiliser un fond uniforme.

Référence recommandée :

```text
#00FF00
```

Le fond doit être :

* homogène ;
* sans ombre visible ;
* sans dégradé ;
* sans texture ;
* sans reflet ;
* sans objets ;
* sans variation de couleur.

Le personnage ne doit pas porter de vert proche de la couleur d’incrustation.

Les cheveux, doigts et contours doivent rester nets.

---

# 21. Fond transparent

Une image sur fond transparent doit présenter :

* un canal alpha propre ;
* aucun halo ;
* aucune bordure colorée ;
* aucun résidu de fond ;
* des cheveux correctement détourés ;
* des contours naturels ;
* aucun pixel parasite.

Le fond transparent doit être exporté en PNG.

---

# 22. Cadrages

Les cadrages standards sont :

```text
extreme close-up
close-up
headshot
bust
medium shot
three-quarter
full-body
wide shot
```

Chaque cadrage doit être utilisé selon son objectif.

### Portrait

Doit privilégier :

* visage ;
* expression ;
* regard ;
* reconnaissance.

### Plan taille

Doit privilégier :

* présentation ;
* gestuelle ;
* interaction avec un objet.

### Plein pied

Doit privilégier :

* tenue ;
* posture ;
* proportions ;
* déplacement.

---

# 23. Placement dans l’image

Le personnage doit être placé de manière intentionnelle.

Il peut être :

```text
centré
tiers gauche
tiers droit
premier plan
plan moyen
```

La composition doit laisser suffisamment d’espace pour :

* du texte ;
* une interface ;
* un produit ;
* un montage ;
* un recadrage ;
* un format vertical ou horizontal.

---

# 24. Formats

Les formats doivent être choisis selon l’usage.

Formats standards :

```text
1:1
4:5
3:4
9:16
16:9
21:9
```

Usages recommandés :

```text
1:1     → icônes, profils, publications carrées
4:5     → Instagram
9:16    → TikTok, Reels, Shorts
16:9    → YouTube, présentations, vidéo
3:4     → portraits
```

Une image maître doit si possible être générée avec une résolution suffisante pour permettre plusieurs recadrages.

---

# 25. Résolution

La résolution doit être adaptée à l’usage final.

Recommandations minimales :

```text
1024 × 1024   → carré
1024 × 1536   → portrait
1536 × 1024   → paysage
1080 × 1920   → vertical social
1920 × 1080   → paysage vidéo
512 × 512     → icône ou miniature
```

Un asset maître ne doit pas être créé à une résolution insuffisante.

---

# 26. Netteté

Le visage et les yeux doivent être nets lorsque le personnage constitue le sujet principal.

La profondeur de champ peut être utilisée pour séparer le personnage du décor.

Elle ne doit pas rendre flous :

* les yeux ;
* le visage ;
* les mains importantes ;
* l’objet présenté ;
* le logo essentiel.

---

# 27. Éclairage

L’éclairage doit rester naturel et cohérent.

Il doit préciser :

* source principale ;
* direction ;
* intensité ;
* température ;
* ombres ;
* contraste ;
* lumière d’ambiance.

Recommandations :

```text
soft studio lighting
natural window light
soft daylight
balanced commercial lighting
cinematic soft lighting
```

Les éclairages extrêmes doivent être réservés aux usages créatifs validés.

---

# 28. Ombres

Les ombres doivent être cohérentes avec :

* la position des sources lumineuses ;
* le décor ;
* le sol ;
* les objets ;
* la posture.

Les erreurs suivantes doivent être rejetées :

* ombres multiples injustifiées ;
* ombres dans des directions opposées ;
* absence totale d’ombre dans une scène réaliste ;
* ombre détachée du personnage ;
* ombre déformée.

---

# 29. Couleurs

Les couleurs doivent respecter :

* la peau ;
* les vêtements ;
* la marque ;
* le décor ;
* l’ambiance ;
* le produit ;
* le format final.

La saturation ne doit pas altérer l’identité du personnage.

Les filtres colorimétriques doivent rester cohérents avec les autres assets de la même série.

---

# 30. Style visuel

Chaque image doit préciser son niveau de stylisation.

Niveaux possibles :

```text
photorealistic
commercial photography
editorial photography
cinematic
documentary
studio
stylized
illustrative
```

Un personnage photoréaliste ne doit pas devenir soudainement illustré ou cartoon sans validation explicite.

---

# 31. Réalisme

Pour un personnage photoréaliste, l’image doit éviter :

* la peau artificielle ;
* les yeux trop brillants ;
* les proportions parfaites irréalistes ;
* les vêtements sans texture ;
* les arrière-plans incohérents ;
* les poses de mannequin rigides ;
* l’effet poupée ;
* l’effet rendu 3D involontaire.

Le réalisme doit rester naturel plutôt que spectaculaire.

---

# 32. Texte dans l’image

Les moteurs d’image ne doivent pas être considérés comme fiables pour générer du texte complexe.

Le texte important doit être ajouté en postproduction.

Le moteur peut générer :

* des zones libres ;
* un écran vide ;
* une affiche neutre ;
* une composition prévue pour recevoir du texte.

Il ne doit pas inventer un texte considéré comme officiel.

---

# 33. Séries d’images

Une série doit préserver :

* le même personnage ;
* le même look ;
* la même coiffure ;
* le même niveau de maquillage ;
* la même palette ;
* le même éclairage général ;
* la même période visuelle ;
* la même intention.

Les variations doivent être contrôlées.

Une série ne doit pas ressembler à plusieurs personnes différentes.

---

# 34. Images de référence vidéo

Une image destinée à être animée doit être conçue spécifiquement pour la vidéo.

Elle doit présenter :

* une pose stable ;
* des mains visibles et correctes ;
* des contours propres ;
* un visage net ;
* un regard exploitable ;
* une posture naturelle ;
* un décor cohérent ;
* suffisamment d’espace autour du corps ;
* aucun élément ambigu.

Elle doit éviter :

* les membres croisés de manière complexe ;
* les mains cachées ;
* les objets trop proches du visage ;
* les cheveux masquant les yeux ;
* les poses déséquilibrées ;
* les arrière-plans trop chargés.

---

# 35. Miniatures

Une miniature doit rester lisible à petite taille.

Elle doit privilégier :

* un visage reconnaissable ;
* une expression claire ;
* une silhouette simple ;
* un contraste suffisant ;
* peu d’éléments ;
* un cadrage rapproché ;
* une composition nette.

La miniature doit être fidèle à l’asset original qu’elle représente.

Elle ne doit pas créer une nouvelle interprétation du look.

---

# 36. Nommage des fichiers

Les noms de fichiers doivent être stables et explicites.

Format recommandé :

```text
<character-id>_<category>_<identifier>_<version>.<extension>
```

Exemples :

```text
mei_identity_front_v1.png
mei_pose_001_v1.png
mei_expression_smile_v1.png
mei_look_001_v1.png
mei_green-screen_phone_v1.png
```

Les noms génériques comme ceux-ci sont interdits :

```text
image1.png
final.png
final-final.png
test2.png
untitled.png
```

---

# 37. Métadonnées

Chaque image officielle devrait pouvoir être reliée à :

* personnage ;
* version du SDK ;
* catégorie ;
* date ;
* fournisseur ;
* modèle utilisé ;
* prompt ;
* negative prompt ;
* seed si disponible ;
* référence source ;
* look ;
* pose ;
* expression ;
* statut ;
* validateur ;
* licence ;
* destination.

Ces métadonnées peuvent être stockées dans un fichier JSON associé.

---

# 38. Statuts

Les statuts recommandés sont :

```text
draft
review
approved
rejected
archived
```

### Draft

Image de travail.

### Review

Image en cours de vérification.

### Approved

Image validée pour utilisation.

### Rejected

Image refusée.

### Archived

Ancienne image conservée pour historique.

---

# 39. Contrôle qualité

Toute image doit être vérifiée selon les critères suivants.

## Identité

* visage conforme ;
* âge conforme ;
* cheveux conformes ;
* peau conforme ;
* morphologie conforme.

## Anatomie

* mains correctes ;
* doigts corrects ;
* membres corrects ;
* posture crédible ;
* proportions correctes.

## Tenue

* look correct ;
* couleurs correctes ;
* accessoires corrects ;
* chaussures correctes.

## Scène

* décor cohérent ;
* objet correct ;
* perspective correcte ;
* lumière correcte ;
* ombres correctes.

## Technique

* résolution suffisante ;
* netteté correcte ;
* format correct ;
* absence d’artefact ;
* détourage propre si nécessaire.

---

# 40. Score de validation

Une grille de score peut être utilisée.

```text
Identité              /30
Anatomie              /20
Tenue                 /10
Expression            /10
Composition           /10
Éclairage             /10
Qualité technique     /10
Total                /100
```

Seuils recommandés :

```text
90–100  → approved
80–89   → review
60–79   → draft à corriger
0–59    → rejected
```

Une erreur majeure d’identité entraîne un rejet, même avec un score total élevé.

---

# 41. Motifs de rejet automatique

Une image doit être rejetée immédiatement en cas de :

* visage non reconnaissable ;
* changement important d’identité ;
* doigts surnuméraires visibles ;
* membre supplémentaire ;
* corps fusionné ;
* vêtement incompatible avec le look ;
* logo faux présenté comme officiel ;
* objet impossible ;
* texte officiel erroné ;
* contenu juridiquement interdit ;
* asset source non autorisé ;
* ressemblance excessive avec une personne réelle non consentante ;
* non-respect du Character Lock.

---

# 42. Correction

Une image non conforme doit être corrigée par :

1. identification précise du défaut ;
2. vérification de la référence utilisée ;
3. correction du prompt ;
4. réduction du nombre de variations ;
5. simplification de la pose ;
6. changement de workflow si nécessaire ;
7. nouvelle génération ;
8. nouveau contrôle qualité.

Il est interdit de modifier les standards pour accepter une génération défaillante.

---

# 43. Fournisseurs

Le standard reste indépendant des fournisseurs.

Il peut être appliqué à :

* OpenAI ;
* Midjourney ;
* Flux ;
* Stable Diffusion ;
* Ideogram ;
* Runway ;
* Leonardo ;
* tout autre moteur.

Les fichiers spécifiques à un fournisseur doivent adapter les règles sans modifier l’identité du personnage.

---

# 44. Archivage

Les images validées doivent être conservées dans une structure stable.

Exemple :

```text
assets/
├── identity/
├── poses/
├── expressions/
├── outfits/
├── approved/
├── drafts/
├── rejected/
└── archive/
```

Les assets maîtres ne doivent pas être remplacés silencieusement.

Une nouvelle version doit être créée.

---

# 45. Sécurité

Les fichiers originaux doivent être sauvegardés.

Les opérations suivantes doivent être réversibles :

* recadrage ;
* retouche ;
* suppression de fond ;
* colorimétrie ;
* ajout de logo ;
* compression ;
* redimensionnement.

Les versions modifiées ne doivent pas écraser les masters.

---

# 46. Compatibilité avec AI Command Center OS

AI Command Center OS doit pouvoir :

* sélectionner le personnage ;
* charger les références ;
* choisir une catégorie d’image ;
* sélectionner un look ;
* sélectionner une pose ;
* sélectionner une expression ;
* construire le prompt ;
* appeler un fournisseur ;
* enregistrer les paramètres ;
* produire plusieurs variantes ;
* contrôler la conformité ;
* attribuer un statut ;
* archiver le résultat.

La validation finale reste humaine pour les images officielles.

---

# 47. Critères minimaux d’une image officielle

Une image ne peut être classée `approved` que si :

```text
identité conforme
ET anatomie conforme
ET tenue conforme
ET contexte cohérent
ET qualité technique suffisante
ET droits vérifiés
ET validation humaine effectuée
```

---

# 48. Règle finale

Une image officielle doit renforcer l’identité du personnage.

Elle ne doit jamais :

* affaiblir sa reconnaissance ;
* introduire une nouvelle apparence par accident ;
* servir de référence si elle contient une erreur ;
* être publiée uniquement parce qu’elle est esthétiquement réussie.

La fidélité au personnage prime toujours sur l’originalité visuelle.
