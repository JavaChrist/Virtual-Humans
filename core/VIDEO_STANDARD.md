# VIDEO STANDARD

> Virtual Humans SDK
> Standard global de création, d’animation, de validation et d’archivage des vidéos
> Version : 1.0.0
> Statut : actif

---

# 1. Objectif

Ce document définit les règles applicables à toutes les vidéos produites dans le cadre du **Virtual Humans SDK**.

Il garantit :

* la stabilité visuelle du personnage ;
* la cohérence des mouvements ;
* la qualité technique ;
* la synchronisation entre image, voix et comportement ;
* la compatibilité entre plusieurs fournisseurs ;
* la conformité avec les plateformes ;
* la traçabilité des générations ;
* la validation avant publication.

Ce standard s’applique à tous les personnages présents et futurs dans :

```text
characters/
```

---

# 2. Champ d’application

Ce standard couvre notamment :

* les vidéos générées entièrement par IA ;
* les animations à partir d’une image ;
* les vidéos face caméra ;
* les présentations produit ;
* les vidéos commerciales ;
* les vidéos sociales ;
* les Reels ;
* les TikTok ;
* les Shorts ;
* les démonstrations ;
* les vidéos sur fond vert ;
* les vidéos avec synchronisation labiale ;
* les vidéos avec voix synthétique ;
* les vidéos avec plusieurs personnages ;
* les vidéos intégrées dans une application ;
* les clips destinés à la postproduction.

---

# 3. Principe fondamental

Une vidéo officielle doit préserver l’identité du personnage pendant toute sa durée.

L’ordre de priorité est :

```text
Identité
→ Continuité
→ Mouvement
→ Synchronisation
→ Lisibilité
→ Qualité technique
→ Esthétique
```

Une vidéo spectaculaire mais instable ou infidèle au personnage doit être rejetée.

---

# 4. Sources de vérité

La création et la validation d’une vidéo doivent s’appuyer sur :

```text
core/CHARACTER_STANDARD.md
core/LEGAL_STANDARD.md
core/PHOTO_STANDARD.md
core/PROMPT_STANDARD.md
core/QUALITY_STANDARD.md
core/SOCIAL_STANDARD.md
characters/<Character SDK>/00_IDENTITY.md
characters/<Character SDK>/01_APPEARANCE.md
characters/<Character SDK>/02_PERSONALITY.md
characters/<Character SDK>/03_WARDROBE.md
characters/<Character SDK>/04_VOICE.md
characters/<Character SDK>/05_CAMERA.md
characters/<Character SDK>/07_BEHAVIOR.md
characters/<Character SDK>/11_CAPABILITIES.md
characters/<Character SDK>/12_LIMITATIONS.md
characters/<Character SDK>/99_CHARACTER_LOCK.md
```

Une vidéo générée ne devient jamais automatiquement une référence officielle.

---

# 5. Catégories de vidéos

Chaque vidéo doit appartenir à une catégorie explicite.

Catégories recommandées :

```text
portrait-motion
talking-head
full-body
walking
green-screen
product-demo
presentation
interview
social-short
tutorial
commercial
background
transition
expression-test
motion-test
lip-sync-test
draft
master
```

Une vidéo de test ne doit pas être utilisée comme master sans validation.

---

# 6. Modes de génération

Le SDK peut utiliser plusieurs modes.

## Text-to-video

La vidéo est générée depuis un prompt texte.

## Image-to-video

La vidéo est créée à partir d’une image de référence.

## Video-to-video

Une vidéo existante est transformée.

## Performance transfer

Les mouvements ou expressions d’une personne source sont transférés vers le personnage.

## Lip-sync

Une animation du visage est produite depuis une piste audio.

## Composition

Le personnage est intégré dans une scène réelle ou générée.

Chaque mode doit être documenté dans les métadonnées.

---

# 7. État initial

Toute génération vidéo doit définir clairement son état initial.

Il comprend :

* position du personnage ;
* orientation du corps ;
* position de la tête ;
* position des bras ;
* position des mains ;
* expression ;
* direction du regard ;
* tenue ;
* objet tenu ;
* position dans le cadre ;
* environnement ;
* éclairage.

L’état initial doit correspondre à l’image source lorsqu’une image de référence est utilisée.

---

# 8. État final

Une vidéo doit également définir son état final lorsque cela est pertinent.

L’état final permet :

* d’éviter une coupure brutale ;
* de préparer une transition ;
* de créer une boucle ;
* de maintenir une pose stable ;
* de faciliter le montage.

La fin ne doit pas se terminer au milieu d’un geste ou d’un mot, sauf effet volontaire.

---

# 9. Action principale

Une vidéo courte doit privilégier une seule action principale.

Exemples :

```text
parler face caméra
lever légèrement le téléphone
marcher lentement
tourner la tête
sourire
faire un geste de présentation
montrer un produit
```

Il faut éviter de cumuler trop d’actions dans une même génération.

Exemple à éviter sur cinq secondes :

```text
marcher, se retourner, prendre un téléphone, parler, sourire, s’asseoir et sortir du cadre
```

---

# 10. Durée

La durée doit être adaptée à l’action.

Durées recommandées :

```text
2–4 secondes    → expression ou mouvement simple
4–8 secondes    → action courte
8–15 secondes   → présentation ou phrase courte
15–30 secondes  → séquence sociale
30 secondes et plus → montage multi-plans
```

Les séquences longues doivent de préférence être construites à partir de plusieurs plans courts validés.

---

# 11. Continuité de l’identité

Le visage doit rester stable d’une image à l’autre.

Il faut contrôler :

* forme du visage ;
* position des yeux ;
* taille des yeux ;
* forme du nez ;
* forme de la bouche ;
* mâchoire ;
* cheveux ;
* âge apparent ;
* couleur de peau ;
* texture de peau ;
* morphologie.

Les dérives suivantes entraînent un rejet :

* changement de visage ;
* modification progressive de l’âge ;
* variation importante des yeux ;
* transformation de la coiffure ;
* changement de morphologie ;
* apparition d’un autre personnage ;
* visage qui fond ou se reconstruit.

---

# 12. Continuité du corps

Le corps doit rester cohérent pendant toute la séquence.

Il faut vérifier :

* longueur des membres ;
* largeur des épaules ;
* proportions ;
* taille apparente ;
* position du bassin ;
* volume du corps ;
* nombre de membres ;
* cohérence des vêtements ;
* relation entre le corps et le décor.

---

# 13. Mouvements

Les mouvements doivent être :

* naturels ;
* lisibles ;
* anatomiquement crédibles ;
* compatibles avec la personnalité ;
* adaptés à la durée ;
* compatibles avec la caméra ;
* cohérents avec les objets.

Les mouvements doivent éviter :

* accélérations brutales ;
* tremblements ;
* glissements ;
* rotations impossibles ;
* bras élastiques ;
* jambes instables ;
* changements soudains de posture ;
* déplacement sans contact avec le sol.

---

# 14. Mouvement du visage

Le visage doit rester naturel pendant :

* le clignement ;
* le sourire ;
* la parole ;
* les mouvements de tête ;
* les changements d’expression.

Il faut éviter :

* lèvres flottantes ;
* dents instables ;
* yeux qui changent de forme ;
* peau qui se déforme ;
* sourcils désynchronisés ;
* clignements trop fréquents ;
* visage figé ;
* expression qui disparaît brutalement.

---

# 15. Clignement des yeux

Les clignements doivent être :

* naturels ;
* peu fréquents ;
* complets ;
* synchronisés entre les deux yeux ;
* compatibles avec l’expression.

Les clignements asymétriques involontaires ou répétés doivent être rejetés.

---

# 16. Regard

Le regard doit être défini précisément.

Possibilités :

```text
direct camera
slightly off-camera
toward an object
toward another character
following movement
```

Pour une présentation face caméra, le regard doit rester principalement dirigé vers l’objectif.

Il ne doit pas dériver sans intention.

---

# 17. Tête et cou

Les mouvements de tête doivent respecter :

* l’amplitude naturelle ;
* l’axe du cou ;
* l’équilibre ;
* la posture ;
* le regard ;
* la parole.

Il faut éviter :

* rotation excessive ;
* tête flottante ;
* cou qui s’allonge ;
* cou qui disparaît ;
* inclinaison permanente ;
* mouvement indépendant du corps sans cohérence.

---

# 18. Mains

Les mains constituent un point de contrôle prioritaire.

Il faut vérifier :

* nombre de doigts ;
* forme ;
* articulation ;
* orientation ;
* continuité ;
* contact avec les objets ;
* position pendant les gestes ;
* stabilité entre les frames.

Une main correcte au début mais déformée pendant le mouvement entraîne un rejet.

---

# 19. Gestuelle

La gestuelle doit respecter la personnalité et le contexte.

Elle peut être :

```text
subtle
professional
friendly
energetic
calm
demonstrative
```

Pour un présentateur, les gestes doivent rester :

* mesurés ;
* visibles ;
* compatibles avec le cadrage ;
* non répétitifs ;
* non mécaniques.

---

# 20. Marche

Une vidéo de marche doit vérifier :

* contact des pieds avec le sol ;
* alternance des jambes ;
* balancement naturel des bras ;
* stabilité du torse ;
* mouvement du bassin ;
* vitesse cohérente ;
* perspective ;
* absence de glissement.

La marche doit être générée dans un plan suffisamment large.

---

# 21. Interaction avec un objet

Lorsqu’un objet est utilisé, il doit rester stable.

À contrôler :

* taille ;
* forme ;
* orientation ;
* position ;
* prise en main ;
* continuité ;
* perspective ;
* absence de fusion ;
* absence de duplication.

Un téléphone ne doit pas changer de modèle, de taille ou de main pendant la séquence.

---

# 22. Smartphone

Pour un smartphone, vérifier spécifiquement :

* écran dans le bon sens ;
* taille réaliste ;
* position des doigts ;
* orientation constante ;
* absence de rotation impossible ;
* absence de fusion avec la main ;
* absence de changement de couleur ;
* absence de modification de forme ;
* cohérence du contenu affiché.

Le contenu de l’écran peut être ajouté en postproduction lorsqu’il doit être précis.

---

# 23. Tenue

La tenue doit rester identique pendant toute la vidéo.

Il faut contrôler :

* couleurs ;
* coupe ;
* matière ;
* boutons ;
* manches ;
* col ;
* accessoires ;
* chaussures ;
* plis ;
* logos.

Les vêtements ne doivent pas :

* changer de couleur ;
* fusionner avec le corps ;
* apparaître ou disparaître ;
* se transformer ;
* traverser les bras ;
* perdre leurs détails essentiels.

---

# 24. Cheveux

Les cheveux doivent conserver :

* coupe ;
* longueur ;
* couleur ;
* volume ;
* implantation ;
* texture.

Le mouvement des cheveux doit rester cohérent avec :

* le mouvement du personnage ;
* le vent ;
* la gravité ;
* la vitesse ;
* le décor.

Ils ne doivent pas traverser le visage ou changer de coiffure.

---

# 25. Expression

L’expression doit rester cohérente avec :

* le texte ;
* la voix ;
* le geste ;
* l’objectif ;
* la personnalité ;
* le contexte.

Une expression peut évoluer progressivement.

Elle ne doit pas changer brutalement sans raison.

---

# 26. Comportement

Le comportement doit respecter :

```text
02_PERSONALITY.md
07_BEHAVIOR.md
```

Il faut vérifier :

* posture ;
* énergie ;
* rythme ;
* regard ;
* gestuelle ;
* sourire ;
* distance avec la caméra ;
* interaction ;
* crédibilité.

---

# 27. Vidéo parlée

Une vidéo parlée doit coordonner :

```text
texte
+ voix
+ lèvres
+ mâchoire
+ expression
+ regard
+ gestuelle
```

Ces éléments doivent paraître issus d’une même performance.

---

# 28. Synchronisation labiale

La synchronisation labiale doit être contrôlée sur :

* consonnes ;
* voyelles ;
* ouverture de bouche ;
* fermeture ;
* mouvement de mâchoire ;
* rythme ;
* pauses ;
* début de phrase ;
* fin de phrase.

Les décalages visibles doivent être corrigés.

Une mauvaise synchronisation labiale empêche la validation publique.

---

# 29. Voix

La voix doit respecter :

```text
04_VOICE.md
```

Il faut vérifier :

* timbre ;
* accent ;
* langue ;
* rythme ;
* articulation ;
* émotion ;
* énergie ;
* stabilité ;
* prononciation ;
* respiration.

La voix ne doit pas varier d’identité entre deux plans d’une même vidéo.

---

# 30. Texte parlé

Le texte doit être finalisé avant la génération vocale.

Il doit être :

* grammaticalement correct ;
* adapté à la durée ;
* compatible avec la personnalité ;
* exact ;
* validé ;
* prononçable ;
* rythmé naturellement.

Les phrases trop longues doivent être divisées.

---

# 31. Prononciation

Les termes spécifiques doivent être documentés.

Exemples :

* noms de marques ;
* noms de produits ;
* noms propres ;
* sigles ;
* termes étrangers ;
* adresses web ;
* chiffres ;
* prix.

Un dictionnaire de prononciation peut être associé au personnage.

---

# 32. Pauses

Les pauses doivent être définies pour :

* faciliter la compréhension ;
* accompagner un geste ;
* séparer les idées ;
* améliorer le montage ;
* éviter une parole trop mécanique.

Les silences ne doivent pas sembler accidentels.

---

# 33. Audio

L’audio doit être :

* clair ;
* stable ;
* sans saturation ;
* sans coupure ;
* sans souffle excessif ;
* sans variation brutale de volume ;
* correctement synchronisé ;
* adapté à la plateforme.

---

# 34. Musique

La musique doit soutenir le contenu sans masquer la voix.

Il faut contrôler :

* droits ;
* volume ;
* rythme ;
* durée ;
* boucle ;
* transitions ;
* compatibilité avec la marque ;
* compatibilité avec la plateforme.

Le volume de la musique doit diminuer sous la voix lorsque nécessaire.

---

# 35. Effets sonores

Les effets sonores doivent être :

* utiles ;
* proportionnés ;
* synchronisés ;
* cohérents ;
* légalement utilisables.

Ils ne doivent pas transformer une vidéo professionnelle en contenu caricatural sans validation.

---

# 36. Caméra

Les règles de caméra doivent suivre :

```text
05_CAMERA.md
```

La caméra doit préciser :

* type de plan ;
* hauteur ;
* angle ;
* distance ;
* focale ;
* stabilité ;
* mouvement ;
* profondeur de champ ;
* vitesse ;
* point de focus.

---

# 37. Plans standards

Les plans recommandés sont :

```text
close-up
headshot
medium close-up
medium shot
three-quarter
full-body
wide shot
over-the-shoulder
```

Le plan doit être adapté à l’action.

Une gestuelle complète ne doit pas être demandée dans un cadrage trop serré.

---

# 38. Mouvement de caméra

Les mouvements possibles incluent :

```text
static
slow push-in
slow pull-back
pan
tilt
tracking
orbit
handheld controlled
```

Une vidéo courte doit utiliser un mouvement principal.

Les mouvements complexes augmentent les risques de dérive.

---

# 39. Caméra statique

Une caméra statique est recommandée pour :

* présentations face caméra ;
* fond vert ;
* lip-sync ;
* démonstrations simples ;
* tests d’identité ;
* vidéos destinées au détourage.

Elle améliore la stabilité du personnage.

---

# 40. Mouvement combiné

Il est déconseillé de combiner simultanément :

* mouvement corporel important ;
* déplacement du personnage ;
* rotation de caméra ;
* zoom rapide ;
* changement de décor.

Lorsque plusieurs mouvements sont nécessaires, la scène doit être divisée en plans.

---

# 41. Profondeur de champ

La profondeur de champ doit conserver nets :

* les yeux ;
* le visage ;
* le produit ;
* les mains importantes ;
* l’objet présenté.

Un flou important ne doit pas masquer les erreurs d’identité.

---

# 42. Décor

Le décor doit rester stable pendant la vidéo.

Il faut détecter :

* objets qui disparaissent ;
* textures mouvantes ;
* architecture qui se transforme ;
* lumière instable ;
* personnes fusionnées ;
* textes qui changent ;
* mobilier qui se déforme ;
* perspective instable.

---

# 43. Personnes en arrière-plan

Les personnes secondaires augmentent le risque d’artefacts.

Elles doivent être :

* peu nombreuses ;
* éloignées ;
* non identifiables si elles ne sont pas essentielles ;
* cohérentes ;
* stables ;
* juridiquement utilisables.

Pour une scène de présentation, un décor sans foule est généralement préférable.

---

# 44. Fond vert

Une vidéo sur fond vert doit utiliser un fond uniforme.

Référence recommandée :

```text
#00FF00
```

Le fond doit être :

* homogène ;
* sans dégradé ;
* sans texture ;
* sans ombre ;
* sans reflet ;
* sans changement de luminosité ;
* sans élément parasite.

Le personnage ne doit pas porter une couleur proche du fond.

---

# 45. Contours pour incrustation

Les contours doivent être propres autour :

* des cheveux ;
* des doigts ;
* des bras ;
* des vêtements ;
* du téléphone ;
* des chaussures.

Il faut éviter :

* halos ;
* transparences involontaires ;
* flou excessif ;
* artefacts verts ;
* mèches fusionnées avec le fond.

---

# 46. Fond transparent

Lorsque le fournisseur permet une vidéo avec canal alpha, il faut vérifier :

* propreté du détourage ;
* stabilité des contours ;
* absence de halo ;
* cohérence entre les frames ;
* compatibilité du codec ;
* compatibilité du logiciel de montage.

---

# 47. Éclairage

L’éclairage doit rester constant pendant la séquence.

À contrôler :

* direction ;
* intensité ;
* température ;
* contraste ;
* ombres ;
* reflets ;
* lumière sur le visage ;
* lumière sur les objets.

Les variations non justifiées doivent être rejetées.

---

# 48. Ombres

Les ombres doivent suivre :

* les mouvements ;
* les sources lumineuses ;
* la position du personnage ;
* la position des objets ;
* le sol.

Une ombre qui reste immobile pendant que le personnage se déplace constitue une erreur.

---

# 49. Scènes de nuit

Les scènes sombres doivent conserver :

* visage lisible ;
* regard visible ;
* tenue identifiable ;
* produit lisible ;
* contraste suffisant ;
* absence de bruit excessif.

L’esthétique ne doit pas rendre le personnage méconnaissable.

---

# 50. Formats

Formats standards :

```text
9:16
16:9
1:1
4:5
```

Usages recommandés :

```text
9:16  → TikTok, Reels, Shorts
16:9  → YouTube, présentation, site web
1:1   → publications carrées
4:5   → Instagram
```

---

# 51. Résolutions

Résolutions recommandées :

```text
1080 × 1920  → vertical
1920 × 1080  → horizontal
1080 × 1080  → carré
1080 × 1350  → format 4:5
```

Une génération peut être produite dans une résolution intermédiaire si le workflow prévoit une amélioration validée.

---

# 52. Fréquence d’images

Fréquences courantes :

```text
24 fps
25 fps
30 fps
50 fps
60 fps
```

Recommandations :

```text
24 fps → rendu cinématographique
25 fps → standard européen
30 fps → contenu numérique et social
50/60 fps → mouvement fluide ou ralenti
```

Une même production doit conserver une fréquence cohérente.

---

# 53. Codecs

Codecs de livraison courants :

```text
H.264
H.265
ProRes
VP9
AV1
```

Le choix dépend de :

* la plateforme ;
* la qualité ;
* la transparence ;
* la postproduction ;
* le poids ;
* la compatibilité.

Les masters doivent utiliser un format limitant les pertes lorsque cela est possible.

---

# 54. Formats de fichiers

Formats courants :

```text
.mp4
.mov
.webm
```

Les fichiers de travail ne doivent pas être confondus avec les exports de diffusion.

---

# 55. Master vidéo

Un master doit être :

* sans watermark ;
* sans interface fournisseur ;
* sans compression excessive ;
* dans la meilleure résolution disponible ;
* correctement nommé ;
* versionné ;
* sauvegardé ;
* accompagné de ses métadonnées.

---

# 56. Safe Zones

Les éléments importants doivent rester dans une zone sûre.

Cela concerne :

* visage ;
* sous-titres ;
* produit ;
* logo ;
* CTA ;
* téléphone ;
* mains ;
* texte.

Les interfaces sociales peuvent masquer les bords de la vidéo.

---

# 57. Sous-titres

Les sous-titres doivent être :

* fidèles au texte parlé ;
* synchronisés ;
* lisibles ;
* correctement segmentés ;
* adaptés au mobile ;
* placés dans une zone sûre ;
* contrastés ;
* exempts de faute.

Ils doivent être ajoutés en postproduction lorsque le moteur vidéo ne peut pas les produire correctement.

---

# 58. Texte à l’écran

Le texte important doit être ajouté en postproduction.

Il faut éviter de demander au moteur vidéo de générer :

* des titres ;
* des prix ;
* des interfaces ;
* des URL ;
* des textes produits ;
* des mentions légales ;
* des logos précis.

Les zones nécessaires peuvent être réservées lors de la génération.

---

# 59. Logos

Les logos doivent être ajoutés en postproduction lorsque la fidélité n’est pas garantie.

Ils doivent rester :

* nets ;
* non déformés ;
* correctement positionnés ;
* lisibles ;
* conformes à la marque.

---

# 60. Écrans d’application

Lorsqu’une application est montrée sur un téléphone ou un ordinateur, il est recommandé de :

1. générer le personnage avec un écran neutre ;
2. stabiliser le mouvement ;
3. suivre l’écran ;
4. intégrer l’interface réelle en postproduction.

Cette méthode évite les interfaces inventées ou déformées.

---

# 61. Multi-plans

Une vidéo de plusieurs plans doit conserver :

* visage ;
* tenue ;
* coiffure ;
* voix ;
* éclairage ;
* période ;
* décor ;
* accessoires ;
* niveau de réalisme.

Chaque plan doit être validé séparément puis dans le montage global.

---

# 62. Transitions

Les transitions doivent être :

* cohérentes ;
* courtes ;
* adaptées au rythme ;
* non trompeuses ;
* compatibles avec l’identité visuelle.

Les transitions complexes ne doivent pas masquer un changement involontaire de personnage.

---

# 63. Boucles

Une vidéo en boucle doit rapprocher l’état final de l’état initial.

Il faut contrôler :

* position du corps ;
* expression ;
* mains ;
* décor ;
* caméra ;
* éclairage ;
* rythme.

La coupure ne doit pas être visible.

---

# 64. Plusieurs personnages

Une scène avec plusieurs Virtual Humans doit définir :

* identité de chacun ;
* position ;
* regard ;
* rôle ;
* interaction ;
* prise de parole ;
* ordre ;
* tenue ;
* espace personnel ;
* caméra.

Les personnages ne doivent pas fusionner ni échanger leurs traits.

---

# 65. Dialogue à plusieurs

Un dialogue doit préciser :

* qui parle ;
* quand ;
* à qui ;
* durée ;
* réaction des autres ;
* direction des regards ;
* gestuelle ;
* synchronisation ;
* continuité.

Il est souvent préférable de générer les plans séparément puis de les monter.

---

# 66. Vidéo produit

Une vidéo produit doit vérifier :

* fidélité du produit ;
* nom ;
* couleur ;
* dimensions ;
* fonctionnalités montrées ;
* interface ;
* logo ;
* prise en main ;
* promesses ;
* disponibilité.

Aucune fonction ne doit être inventée.

---

# 67. Vidéo commerciale

Une vidéo commerciale doit intégrer :

* objectif ;
* audience ;
* problème ;
* solution ;
* bénéfice ;
* preuve autorisée ;
* CTA ;
* offre ;
* mentions ;
* durée ;
* plateforme.

Elle nécessite une validation renforcée.

---

# 68. Vidéo sociale

Une vidéo sociale courte doit privilégier :

```text
Hook
→ idée principale
→ bénéfice
→ démonstration
→ CTA
```

Elle doit rester compréhensible sans le son lorsque des sous-titres sont présents.

---

# 69. Présentateur

Un présentateur virtuel doit conserver :

* regard caméra ;
* posture stable ;
* gestes mesurés ;
* voix claire ;
* expression cohérente ;
* rythme naturel ;
* énergie adaptée ;
* tenue validée.

La présentation ne doit pas sembler récitée mécaniquement.

---

# 70. Avatar intégré à une interface

Lorsqu’une vidéo est intégrée dans une application ou un site, elle doit être adaptée à :

* taille d’affichage ;
* fond ;
* boucle ;
* transparence ;
* poids ;
* chargement ;
* lecture automatique ;
* accessibilité ;
* contrôle audio ;
* responsive design.

---

# 71. Nommage

Format recommandé :

```text
<character-id>_<category>_<scene-id>_<version>.<extension>
```

Exemples :

```text
mei_talking-head_intro_v001.mp4
mei_green-screen_phone_v002.mov
mei_social_ridecloud_001_v003.mp4
mei_walk_front_v001.mp4
```

Les noms génériques sont interdits :

```text
video1.mp4
test-final.mp4
final2.mp4
export.mp4
nouveau.mov
```

---

# 72. Métadonnées

Chaque vidéo officielle doit pouvoir être reliée à :

```text
video_id
character_id
character_sdk_version
category
prompt_id
prompt_version
source_image
source_audio
provider
model
generation_mode
duration
resolution
aspect_ratio
frame_rate
codec
created_at
status
quality_score
validator
rights
destination
```

---

# 73. Statuts

Les statuts recommandés sont :

```text
draft
generated
review
approved
rejected
archived
deprecated
master
```

Une vidéo `generated` n’est pas prête à être publiée.

---

# 74. Contrôle image par image

Pour les productions sensibles, un contrôle image par image peut être nécessaire.

Il doit rechercher :

* dérive du visage ;
* erreur de mains ;
* membre supplémentaire ;
* déformation du produit ;
* changement de tenue ;
* artefact de décor ;
* texte erroné ;
* apparition d’un élément indésirable ;
* rupture de synchronisation.

---

# 75. Score de validation

Grille recommandée :

```text
Identité                /25
Continuité              /15
Mouvement               /15
Visage et expression    /10
Mains et anatomie       /10
Voix et lip-sync        /10
Caméra et composition   /5
Qualité technique       /5
Légal et marque         /5
Total                  /100
```

Seuils recommandés :

```text
95–100  → master
90–94   → approved
80–89   → review
60–79   → correction nécessaire
0–59    → rejected
```

Une erreur bloquante entraîne un rejet indépendamment du score.

---

# 76. Motifs de rejet automatique

Une vidéo doit être rejetée en cas de :

* dérive importante d’identité ;
* changement de visage ;
* membre supplémentaire ;
* main gravement déformée ;
* changement de tenue ;
* produit faux ;
* logo trompeur ;
* lip-sync très décalé ;
* voix incorrecte ;
* mouvement anatomiquement impossible ;
* décor qui se transforme fortement ;
* contenu juridiquement non autorisé ;
* donnée personnelle exposée ;
* fichier corrompu ;
* Character Lock non respecté.

---

# 77. Défauts majeurs

Les défauts majeurs incluent :

```text
identity-instability
hand-instability
body-deformation
lip-sync-error
voice-drift
object-instability
background-morphing
camera-jitter
lighting-flicker
outfit-change
```

Ils doivent être corrigés avant publication.

---

# 78. Défauts mineurs

Les défauts mineurs peuvent inclure :

```text
small-crop-adjustment
minor-color-correction
audio-level-adjustment
subtitle-spacing
compression
short-transition-fix
filename
metadata
```

Ils peuvent être corrigés en postproduction.

---

# 79. Correction

Le processus de correction recommandé est :

```text
1. Identifier le défaut
2. Localiser le moment
3. Classer la sévérité
4. Déterminer la cause
5. Choisir entre retouche, régénération ou montage
6. Créer une nouvelle version
7. Recontrôler
8. Comparer
9. Valider ou rejeter
```

---

# 80. Régénération partielle

Lorsque seule une portion est défaillante, il faut privilégier :

* remplacement du plan ;
* nouvelle génération courte ;
* coupe ;
* raccord ;
* retouche locale ;
* correction audio ;
* correction de sous-titre.

Il est inutile de régénérer toute une vidéo validée lorsque le défaut peut être isolé.

---

# 81. Test de répétabilité

Un workflow vidéo doit être testé plusieurs fois.

Il faut mesurer :

* stabilité du visage ;
* stabilité des mains ;
* stabilité du corps ;
* cohérence des mouvements ;
* fidélité au prompt ;
* réussite du lip-sync ;
* temps de correction ;
* taux de rejet ;
* coût.

---

# 82. Test de non-régression

Chaque changement de modèle ou de fournisseur doit être testé sur des cas de référence.

Cas recommandés :

```text
face caméra neutre
face caméra parlée
sourire
téléphone en main
plein pied
marche
fond vert
présentation produit
format 9:16
format 16:9
```

---

# 83. Fournisseurs

Le standard reste indépendant des fournisseurs.

Il peut être appliqué à :

* OpenAI ;
* Runway ;
* Veo ;
* Kling ;
* MiniMax ;
* HeyGen ;
* Synthesia ;
* Pika ;
* Luma ;
* ElevenLabs ;
* tout autre moteur.

Chaque fournisseur doit disposer d’un adaptateur documenté.

---

# 84. Limites fournisseur

Les limites spécifiques doivent être enregistrées.

Exemples :

```text
durée maximale
résolution maximale
nombre de références
gestion du son
gestion du lip-sync
gestion des mains
gestion des logos
gestion du fond transparent
gestion de la seed
droits d’utilisation
```

Une limitation fournisseur ne doit pas conduire à modifier le Character Lock.

---

# 85. Workflow recommandé

Workflow standard :

```text
brief
→ script
→ validation du texte
→ sélection du personnage
→ sélection du look
→ sélection de l’image source
→ génération audio
→ validation audio
→ génération vidéo
→ contrôle qualité
→ montage
→ sous-titres
→ habillage
→ validation finale
→ export
→ archivage
```

---

# 86. Vidéo avec fond vert

Workflow recommandé :

```text
image maître fond vert
→ contrôle des contours
→ animation
→ validation de l’identité
→ validation des mouvements
→ chroma key
→ intégration du décor
→ colorimétrie
→ contrôle final
```

---

# 87. Vidéo avec interface produit

Workflow recommandé :

```text
personnage avec écran neutre
→ validation du mouvement
→ tracking de l’écran
→ intégration de l’interface réelle
→ validation du produit
→ ajout des textes
→ export
```

---

# 88. Archivage

Structure possible :

```text
videos/
├── drafts/
├── generated/
├── review/
├── approved/
├── masters/
├── rejected/
├── sources/
├── audio/
├── subtitles/
├── project-files/
└── archive/
```

Les masters ne doivent pas être écrasés.

---

# 89. Fichiers sources

Les éléments suivants doivent être conservés lorsque possible :

* image source ;
* piste audio ;
* script ;
* prompt ;
* negative prompt ;
* paramètres ;
* projet de montage ;
* sous-titres ;
* logo ;
* musique ;
* export master ;
* version diffusée.

---

# 90. Sécurité

Les fichiers sources doivent être sauvegardés.

Les opérations suivantes doivent rester réversibles :

* montage ;
* recadrage ;
* détourage ;
* colorimétrie ;
* ajout de texte ;
* ajout de logo ;
* sous-titrage ;
* compression ;
* remplacement audio.

---

# 91. Compatibilité avec AI Command Center OS

AI Command Center OS doit pouvoir :

* sélectionner le personnage ;
* charger les standards ;
* charger le Character Lock ;
* sélectionner un type de vidéo ;
* sélectionner un look ;
* sélectionner une image source ;
* préparer le script ;
* générer la voix ;
* construire le prompt ;
* choisir un fournisseur ;
* lancer la génération ;
* enregistrer les paramètres ;
* contrôler le résultat ;
* produire un score ;
* proposer des corrections ;
* lancer le montage ;
* demander une validation humaine ;
* attribuer un statut ;
* préparer la publication ;
* archiver les fichiers.

Le système doit bloquer la publication si :

* la vidéo n’est pas approuvée ;
* l’identité dérive ;
* les droits ne sont pas validés ;
* le Character Lock est violé ;
* le produit est incorrect ;
* la destination n’est pas définie ;
* les métadonnées sont absentes.

---

# 92. Checklist vidéo

```text
[ ] Personnage correct
[ ] Version du SDK correcte
[ ] Character Lock respecté
[ ] Visage stable
[ ] Âge apparent stable
[ ] Cheveux stables
[ ] Corps stable
[ ] Mains correctes
[ ] Tenue correcte
[ ] Objet correct
[ ] Mouvement naturel
[ ] Regard cohérent
[ ] Expression cohérente
[ ] Voix conforme
[ ] Prononciation correcte
[ ] Lip-sync correct
[ ] Caméra correcte
[ ] Décor stable
[ ] Éclairage stable
[ ] Ombres cohérentes
[ ] Format correct
[ ] Résolution correcte
[ ] Durée correcte
[ ] Audio correct
[ ] Sous-titres corrects
[ ] Texte exact
[ ] Produit exact
[ ] Marque conforme
[ ] Droits validés
[ ] Métadonnées présentes
[ ] Validation humaine effectuée
```

---

# 93. Critères minimaux d’approbation

Une vidéo ne peut être classée `approved` que si :

```text
identité conforme
ET continuité suffisante
ET mouvement crédible
ET anatomie conforme
ET voix conforme si présente
ET synchronisation suffisante
ET qualité technique suffisante
ET contenu exact
ET droits vérifiés
ET destination définie
ET validation humaine effectuée
```

---

# 94. Interdictions

Il est interdit de :

* publier une vidéo non contrôlée ;
* utiliser une vidéo présentant une dérive d’identité ;
* utiliser un asset rejeté comme source ;
* inventer une fonctionnalité produit ;
* imiter une personne réelle non autorisée ;
* publier une voix usurpée ;
* masquer une erreur importante par un montage trompeur ;
* générer de faux témoignages ;
* écraser un master ;
* supprimer les métadonnées ;
* approuver une vidéo hors de sa destination ;
* ignorer une erreur de droits ;
* modifier le Character Lock pour accepter un mauvais résultat.

---

# 95. Règle finale

Une vidéo officielle doit donner l’impression qu’un même personnage cohérent existe pendant toute la séquence.

Elle doit être :

```text
stable
naturelle
lisible
fidèle
techniquement propre
juridiquement utilisable
traçable
validée
```

La complexité du mouvement ne doit jamais prendre le pas sur la stabilité du Virtual Human.

Lorsqu’un plan complexe dégrade l’identité, il doit être simplifié ou divisé.
