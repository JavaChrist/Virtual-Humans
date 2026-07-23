# FICHIER : `characters/Tom SDK v1.0.0/videos/README.md`

````md
# VIDEO SDK — TOM

Version : 1.0  
Statut : Officiel  
Personnage : Tom  
SDK : Virtual Human SDK

---

# 1. OBJECTIF

Ce dossier contient les règles d’exploitation vidéo propres à Tom.

Il transforme les éléments permanents du SDK en instructions utilisables par différents moteurs de génération vidéo.

Le Video SDK doit permettre de produire des vidéos cohérentes avec :

- l’identité officielle de Tom ;
- sa personnalité ;
- sa gestuelle ;
- son comportement devant la caméra ;
- sa voix ;
- les règles sociales et marketing du projet.

Le moteur de génération peut changer.

Tom ne change pas.

---

# 2. PÉRIMÈTRE

Ce dossier contient :

- les règles communes à tous les moteurs ;
- les recommandations propres à chaque fournisseur ;
- la structure des prompts vidéo ;
- les règles de contrôle qualité ;
- la procédure d’intégration d’un nouveau moteur.

Ce dossier ne remplace pas :

- l’Identity Library ;
- l’Expression Library ;
- la Pose Library ;
- l’Outfit Library ;
- la mémoire du personnage ;
- la mémoire sociale ;
- la mémoire vidéo.

---

# 3. SOURCES DE VÉRITÉ

Toute génération vidéo de Tom doit respecter les documents suivants :

1. `20_CHARACTER_PACKAGE.md`
2. `21_CHARACTER_MEMORY.md`
3. `22_PRODUCT_MEMORY.md`
4. `23_BRAND_MEMORY.md`
5. `24_MARKETING_MEMORY.md`
6. `25_SOCIAL_MEMORY.md`
7. `26_VIDEO_MEMORY.md`
8. `videos/shared.md`
9. le fichier spécifique au moteur utilisé

En cas de contradiction, l’ordre de priorité est :

1. identité officielle ;
2. mémoire du personnage ;
3. mémoire vidéo ;
4. mémoire sociale ;
5. règles du moteur ;
6. instructions ponctuelles de la scène.

Une instruction ponctuelle ne peut jamais modifier l’identité permanente de Tom.

---

# 4. ARCHITECTURE

```text
characters/Tom SDK v1.0.0/
├── assets/
│   ├── identity/
│   ├── expressions/
│   ├── poses/
│   └── outfits/
│
├── memory/
│   ├── 20_CHARACTER_PACKAGE.md
│   ├── 21_CHARACTER_MEMORY.md
│   ├── 22_PRODUCT_MEMORY.md
│   ├── 23_BRAND_MEMORY.md
│   ├── 24_MARKETING_MEMORY.md
│   ├── 25_SOCIAL_MEMORY.md
│   └── 26_VIDEO_MEMORY.md
│
├── voice/
│
└── videos/
    ├── README.md
    ├── shared.md
    ├── runway.md
    ├── veo.md
    ├── kling.md
    ├── minimax.md
    ├── openai.md
    └── future-models.md
````

---

# 5. PIPELINE OFFICIEL

```text
Besoin métier
      ↓
Plateforme de diffusion
      ↓
Format et durée
      ↓
Script validé
      ↓
Sélection du look
      ↓
Sélection de l’expression
      ↓
Sélection de la pose
      ↓
Création de l’image de référence
      ↓
Validation de l’identité
      ↓
Génération image-to-video
      ↓
Contrôle qualité
      ↓
Lip-sync ou voix
      ↓
Montage
      ↓
Sous-titres
      ↓
Export
      ↓
Validation finale
```

---

# 6. MODE DE GÉNÉRATION PAR DÉFAUT

Le mode officiel pour les vidéos avec Tom est :

```text
Image officielle de référence
        +
Description du mouvement
        +
Description de la caméra
        +
Description de l’action
        ↓
Image-to-video
```

Le text-to-video peut être utilisé pour :

* les décors ;
* les plans de coupe ;
* les objets ;
* les environnements ;
* les transitions ;
* les séquences sans visage identifiable.

Le text-to-video seul n’est pas le mode recommandé pour les plans principaux de Tom.

---

# 7. UNITÉ DE PRODUCTION

Une génération correspond à un plan simple.

Une génération ne doit pas tenter de produire simultanément :

* plusieurs changements de caméra ;
* plusieurs lieux ;
* plusieurs tenues ;
* plusieurs actions complexes ;
* un long discours ;
* une chorégraphie complète.

Une vidéo finale peut être composée de plusieurs plans générés séparément.

---

# 8. TYPES DE PLANS

## Plan principal

Tom parle directement à la caméra.

Utilisation :

* présentation ;
* conseil ;
* démonstration ;
* hook ;
* conclusion ;
* appel à l’action.

## Plan produit

Tom présente un téléphone, une application ou un objet.

Utilisation :

* démonstration ;
* tutoriel ;
* publicité ;
* présentation d’une fonctionnalité.

## Plan d’illustration

Tom réalise une action sans parler directement.

Utilisation :

* plan de coupe ;
* transition ;
* respiration visuelle ;
* illustration du discours.

## Plan environnemental

Le décor ou le contexte est prioritaire.

Utilisation :

* introduction ;
* voyage ;
* ambiance ;
* localisation ;
* transition.

---

# 9. IDENTIFIANT D’UNE PRODUCTION

Chaque production doit pouvoir recevoir un identifiant.

Format recommandé :

```text
TOM-VIDEO-YYYYMMDD-XXX
```

Exemple :

```text
TOM-VIDEO-20260720-001
```

---

# 10. FICHE DE PRODUCTION MINIMALE

Chaque vidéo doit définir au minimum :

```yaml
production_id: TOM-VIDEO-20260720-001
character: tom
platform: instagram
format: vertical_9_16
duration_target: 30s
purpose: product_presentation
product: ridecloud
language: fr-FR
outfit_id: look-001
expression_id: expression-friendly
pose_id: pose-presenter
generation_mode: image_to_video
provider: runway
voice_required: true
lip_sync_required: true
subtitles_required: true
```

---

# 11. PROMPT CANONIQUE

Le prompt canonique est structuré dans cet ordre :

```text
1. Type de plan
2. Action de Tom
3. Expression
4. Gestuelle
5. Regard
6. Mouvement du corps
7. Mouvement de caméra
8. Rythme
9. Évolution temporelle
10. Contraintes de stabilité
```

Exemple générique :

```text
Medium close-up at eye level.

Tom looks directly into the camera with a warm, confident and natural expression.
He speaks calmly and makes one small open-hand gesture to emphasize his point.
His posture remains relaxed and professional.
Natural blinking and subtle breathing.
The camera remains stable with a very slow push-in.
Soft, realistic movement throughout the shot.
Preserve his facial identity, hairstyle, body proportions, outfit and accessories.
No sudden motion, no face change, no camera shake.
```

---

# 12. LANGUE DES PROMPTS

La documentation interne reste en français.

Les prompts envoyés aux moteurs peuvent être rédigés :

* en anglais lorsque le moteur est plus fiable en anglais ;
* en français lorsque le moteur comprend parfaitement les consignes ;
* dans une forme bilingue lorsque cela améliore le résultat.

Le script vocal reste dans la langue destinée au public.

---

# 13. STRATÉGIE D’ITÉRATION

Ordre conseillé :

1. générer un plan simple ;
2. vérifier l’identité ;
3. vérifier le visage ;
4. vérifier les mains ;
5. vérifier le mouvement ;
6. ajuster une seule variable ;
7. relancer ;
8. conserver la meilleure génération ;
9. effectuer le lip-sync séparément si nécessaire ;
10. monter les plans validés.

Ne jamais modifier simultanément le cadrage, l’action, la gestuelle et la caméra lors d’une correction.

---

# 14. CONTRÔLE QUALITÉ

Chaque plan doit être contrôlé sur les points suivants :

## Identité

* visage fidèle ;
* coiffure fidèle ;
* couleur des cheveux fidèle ;
* proportions fidèles ;
* carnation stable ;
* maquillage stable ;
* bijoux et accessoires cohérents.

## Mouvement

* gestes naturels ;
* clignements normaux ;
* respiration subtile ;
* posture stable ;
* absence de saccades ;
* absence de mouvements robotiques.

## Anatomie

* mains correctes ;
* doigts cohérents ;
* bras correctement positionnés ;
* absence de fusion avec les objets ;
* absence de déformation corporelle.

## Caméra

* cadrage conforme ;
* horizon stable ;
* perspective naturelle ;
* mouvement fluide ;
* absence de zoom incontrôlé.

## Continuité

* tenue inchangée ;
* décor stable ;
* lumière stable ;
* objet stable ;
* accessoires stables.

## Audio

* voix claire ;
* niveau sonore régulier ;
* synchronisation acceptable ;
* absence de musique dominante ;
* prononciation conforme.

---

# 15. STATUTS D’UNE GÉNÉRATION

Statuts recommandés :

```text
draft
generated
identity_review
motion_review
audio_review
approved
rejected
archived
```

---

# 16. MOTIFS DE REJET

Une génération est rejetée immédiatement si il contient :

* une modification visible du visage ;
* un changement de coiffure ;
* une variation importante de carnation ;
* une main fortement déformée ;
* une tenue non conforme ;
* un mouvement robotique ;
* un regard instable ;
* un objet fusionné avec le corps ;
* un changement spontané de décor ;
* une caméra incontrôlée ;
* une expression incompatible avec le message.

---

# 17. EXPORTS

Formats recommandés :

## Réseaux verticaux

```text
Aspect ratio : 9:16
Orientation : verticale
Usage : TikTok, Reels, Shorts
```

## Réseaux polyvalents

```text
Aspect ratio : 4:5 ou 1:1
Usage : Instagram, Facebook, LinkedIn
```

## Vidéo longue

```text
Aspect ratio : 16:9
Orientation : horizontale
Usage : YouTube, formation, présentation
```

---

# 18. VERSIONNEMENT

Le dossier vidéo suit le versionnement du SDK de Tom.

Une modification nécessite une mise à jour de version lorsqu’il change :

* le comportement vidéo officiel ;
* la structure des prompts ;
* les règles de validation ;
* le pipeline ;
* la compatibilité avec un moteur.

Les observations temporaires propres à une plateforme ne modifient pas automatiquement la version du personnage.

---

# 19. RÈGLE FINALE

Le moteur vidéo est un outil d’exécution.

Il ne décide jamais :

* de l’identité de Tom ;
* de sa personnalité ;
* de son comportement ;
* de sa tenue ;
* de son message ;
* de son positionnement.

Toutes ces décisions proviennent du Virtual Human SDK.

````

---

# FICHIER : `characters/Tom SDK v1.0.0/videos/shared.md`

```md
# SHARED VIDEO RULES — TOM

Version : 1.0  
Statut : Officiel  
Portée : Tous les moteurs vidéo

---

# 1. OBJECTIF

Ce fichier contient les règles communes à toutes les générations vidéo de Tom.

Il doit être appliqué avant les recommandations propres à chaque moteur.

---

# 2. PRINCIPE CENTRAL

Tom doit être reconnaissable immédiatement dans chaque vidéo.

La cohérence du personnage est prioritaire sur :

- la créativité du moteur ;
- la complexité du mouvement ;
- les effets visuels ;
- la vitesse de production ;
- le réalisme spectaculaire.

Une vidéo simple et fidèle est préférable à une vidéo complexe et incohérente.

---

# 3. RÉFÉRENCE VISUELLE

Toute vidéo principale doit partir d’une image officielle ou validée de Tom.

L’image doit respecter :

- le visage officiel ;
- la coiffure officielle ;
- les proportions officielles ;
- le maquillage officiel ;
- les accessoires officiels ;
- un look provenant de l’Outfit Library ;
- une expression provenant de l’Expression Library ;
- une pose compatible avec la Pose Library.

Une image non validée ne doit pas devenir une nouvelle référence.

---

# 4. RÈGLES D’IDENTITÉ

Ne jamais demander au moteur de :

- réinterpréter le visage ;
- embellir le visage ;
- rajeunir ou vieillir Tom ;
- modifier son origine apparente ;
- modifier sa morphologie ;
- modifier sa coiffure ;
- modifier sa carnation ;
- ajouter un tatouage ;
- changer son maquillage ;
- remplacer ses accessoires.

Utiliser des instructions de conservation telles que :

```text
Preserve the exact facial identity.
Preserve the hairstyle and hair color.
Preserve body proportions.
Preserve skin tone.
Preserve outfit and accessories.
Maintain character consistency throughout the shot.
````

---

# 5. ACTION

Une génération doit contenir une action principale.

Exemples :

* parler face caméra ;
* sourire légèrement ;
* montrer un téléphone ;
* effectuer un geste d’ouverture ;
* marcher lentement ;
* se tourner légèrement vers un écran ;
* regarder un produit puis revenir vers la caméra.

Éviter d’empiler plusieurs actions complexes dans un même plan.

---

# 6. MOUVEMENT DU CORPS

Les mouvements de Tom doivent être :

* réalistes ;
* fluides ;
* limités ;
* utiles au discours ;
* cohérents avec sa personnalité ;
* compatibles avec le cadrage.

Par défaut :

* respiration subtile ;
* clignements naturels ;
* léger mouvement de tête ;
* déplacement limité des épaules ;
* un ou deux gestes de mains maximum ;
* posture stable.

---

# 7. GESTUELLE

Gestes autorisés :

* main ouverte ;
* léger geste de présentation ;
* geste doux vers le spectateur ;
* mouvement discret vers un produit ;
* mains détendues ;
* léger acquiescement.

Gestes à éviter :

* gestes brusques ;
* bras trop rapides ;
* mouvements répétés ;
* doigt pointé agressivement ;
* grands mouvements hors cadre ;
* gestes sans rapport avec le discours ;
* mains proches du visage sans nécessité.

---

# 8. REGARD

Par défaut, Tom regarde l’objectif.

Le regard peut quitter la caméra uniquement lorsque cela sert l’action.

Exemple avec un téléphone :

```text
Tom briefly looks at the phone screen, then naturally returns his gaze to the camera.
```

Le regard caméra doit rester majoritaire dans les vidéos de présentation.

Interdictions :

* yeux flottants ;
* regard vide ;
* changement incontrôlé de direction ;
* regard constamment hors caméra ;
* asymétrie anormale des yeux.

---

# 9. EXPRESSION

Expression par défaut :

```text
warm, confident, approachable and natural
```

L’expression doit correspondre au message.

## Information

* calme ;
* attentive ;
* confiante.

## Bonne nouvelle

* sourire visible mais naturel ;
* enthousiasme maîtrisé.

## Démonstration

* concentration légère ;
* regard précis ;
* sourire discret.

## Appel à l’action

* ton encourageant ;
* expression ouverte ;
* contact visuel direct.

Éviter :

* sourire figé ;
* surprise excessive ;
* rire artificiel ;
* expression dramatique ;
* changement émotionnel brutal.

---

# 10. CADRAGE

Cadrages préférés :

## Plan poitrine

Usage principal :

* présentation ;
* conseil ;
* hook ;
* appel à l’action.

## Plan taille

Usage :

* gestuelle plus visible ;
* démonstration ;
* présentation d’un produit.

## Plan américain

Usage :

* présentation dynamique ;
* déplacement léger ;
* interaction avec le décor.

## Plein pied

Usage :

* tenue ;
* marche ;
* mise en situation.

Le plan poitrine reste le cadrage par défaut pour une prise de parole.

---

# 11. POSITION DE CAMÉRA

Par défaut :

* caméra à hauteur des yeux ;
* axe frontal ;
* perspective naturelle ;
* distance crédible ;
* sujet centré ou légèrement décentré selon la composition.

Éviter :

* forte plongée ;
* forte contre-plongée ;
* ultra grand-angle ;
* fisheye ;
* caméra trop proche du visage ;
* perspective déformante.

---

# 12. MOUVEMENTS DE CAMÉRA

Mouvements recommandés :

* caméra fixe ;
* lent rapprochement ;
* léger travelling latéral ;
* léger panoramique ;
* suivi stable lors d’une marche lente.

Un seul mouvement principal de caméra par plan.

Exemples :

```text
The camera remains locked and stable.
```

```text
A very slow cinematic push-in.
```

```text
The camera gently tracks his movement at eye level.
```

Éviter :

* caméra à l’épaule nerveuse ;
* zoom rapide ;
* rotation brusque ;
* changement de focale incontrôlé ;
* plusieurs mouvements contradictoires.

---

# 13. ÉVOLUTION TEMPORELLE

Le prompt peut décrire le plan dans l’ordre.

Exemple :

```text
At the beginning, Tom looks directly into the camera.
He gives a small natural smile.
He raises one open hand to emphasize his point.
He then lowers his hand and maintains eye contact until the end.
```

L’évolution doit rester simple et continue.

---

# 14. ÉCLAIRAGE

Éclairage officiel :

* doux ;
* naturel ;
* flatteur sans être artificiel ;
* visage parfaitement lisible ;
* température cohérente avec le décor ;
* ombres modérées.

Éviter :

* lumière clignotante ;
* variation soudaine de luminosité ;
* ombres dures sur les yeux ;
* contre-jour non maîtrisé ;
* lumière colorée modifiant la carnation ;
* surexposition du visage.

---

# 15. DÉCOR

Le décor doit :

* soutenir le message ;
* rester crédible ;
* être propre ;
* être stable ;
* ne pas distraire ;
* laisser Tom clairement identifiable.

Le décor ne doit pas se transformer pendant le plan.

Les textes visibles dans le décor doivent être évités lorsqu’ils ne peuvent pas être contrôlés.

---

# 16. OBJETS

Lorsqu’un objet est utilisé :

* sa taille doit rester stable ;
* sa forme doit rester stable ;
* il ne doit pas fusionner avec les doigts ;
* son écran ne doit pas être considéré comme une interface finale fiable ;
* l’interaction doit rester simple.

Pour une démonstration précise d’application :

1. générer Tom tenant le téléphone ;
2. remplacer ou incruster l’écran au montage ;
3. ne pas dépendre du moteur vidéo pour produire une interface lisible.

---

# 17. DIALOGUE ET LIP-SYNC

Deux pipelines sont possibles.

## Pipeline A — dialogue natif

Le moteur produit directement :

* la vidéo ;
* le dialogue ;
* l’ambiance sonore.

Ce mode est accepté uniquement si :

* la voix correspond à la voix officielle ;
* la prononciation est correcte ;
* la synchronisation est fiable ;
* la personnalité vocale reste stable.

## Pipeline B — voix séparée

Pipeline recommandé pour une identité vocale stable :

1. générer le plan ;
2. produire la voix officielle ;
3. appliquer le lip-sync ;
4. contrôler les lèvres et les expressions ;
5. effectuer le montage final.

Ne pas accepter une voix différente simplement parce qu’il a été générée avec la vidéo.

---

# 18. PROMPT POSITIF

Les instructions positives doivent décrire directement le résultat souhaité.

Exemple :

```text
Tom maintains a stable facial identity and a relaxed professional posture.
His gestures are subtle and natural.
The camera remains steady.
```

Les longues listes de négations doivent être réservées aux moteurs qui les gèrent explicitement.

---

# 19. NEGATIVE PROMPT CANONIQUE

Lorsque le moteur accepte un negative prompt séparé :

```text
face distortion, identity change, hairstyle change, age change,
skin tone change, body deformation, deformed hands, extra fingers,
missing fingers, fused fingers, unstable eyes, crossed eyes,
robotic movement, sudden motion, jitter, camera shake,
flickering light, changing clothes, changing background,
warped object, frozen smile, exaggerated expression,
text artifacts, logo artifacts, low facial detail
```

Adapter cette liste au plan.

Ne pas inclure des interdictions sans rapport avec la scène.

---

# 20. PROMPT DE BASE — FACE CAMÉRA

```text
Medium close-up, eye-level camera.

Tom looks directly into the camera with a warm, confident and approachable expression.
He speaks naturally with subtle breathing and realistic blinking.
He makes one small open-hand gesture to emphasize his message.
His posture remains relaxed and professional.
The camera stays stable with a very slow push-in.
Soft natural lighting and consistent background.

Preserve his exact facial identity, hairstyle, hair color, skin tone,
body proportions, outfit and accessories throughout the entire shot.
Natural human motion. No sudden movement.
```

---

# 21. PROMPT DE BASE — TÉLÉPHONE

```text
Medium shot, eye-level camera.

Tom holds a smartphone naturally at chest height.
He looks briefly at the screen, then returns his gaze to the camera.
He gives a small confident smile and presents the phone with a subtle hand gesture.
His fingers remain naturally positioned around the device.
The camera remains stable.
Soft natural lighting.

Preserve his exact identity, hairstyle, body proportions, outfit and accessories.
Keep the smartphone shape stable.
Natural hands and fingers.
```

---

# 22. PROMPT DE BASE — MARCHE

```text
Full-body shot at eye level.

Tom walks slowly and naturally toward the camera with a relaxed,
confident posture and a subtle friendly smile.
His arms move gently with his steps.
The camera tracks backward smoothly at the same pace.
The background remains stable and coherent.
Soft realistic lighting.

Preserve his exact facial identity, hairstyle, body proportions,
outfit and accessories throughout the shot.
Natural walking motion. Stable face and hands.
```

---

# 23. PROMPT DE BASE — PLAN DE COUPE

```text
Medium shot.

Tom stands in a modern professional environment.
He calmly interacts with the object in front of his,
then briefly looks toward the camera with a natural smile.
Subtle realistic movement.
Stable camera and soft lighting.

Preserve his exact identity, outfit and physical appearance.
```

---

# 24. DURÉE D’UN PLAN

Privilégier les plans courts.

Durée de travail recommandée :

* hook : 3 à 6 secondes ;
* phrase ou action simple : 5 à 10 secondes ;
* plan de coupe : 3 à 8 secondes ;
* présentation continue : selon les capacités réelles du moteur ;
* séquence longue : assembler plusieurs plans.

Ne pas confondre :

* durée du plan généré ;
* durée de la vidéo finale.

---

# 25. SEED ET REPRODUCTIBILITÉ

Lorsqu’un moteur propose une seed ou un identifiant de génération :

* l’enregistrer ;
* conserver le prompt exact ;
* conserver le modèle utilisé ;
* conserver la date ;
* conserver les paramètres ;
* conserver l’image de référence.

Une seed ne garantit pas à il seule une reproduction parfaite lorsque le modèle ou la plateforme évolue.

---

# 26. MÉTADONNÉES À CONSERVER

```yaml
provider:
model:
generation_date:
prompt:
negative_prompt:
reference_images:
seed:
aspect_ratio:
resolution:
duration:
camera_instruction:
motion_instruction:
voice:
lip_sync:
status:
quality_notes:
```

---

# 27. RÈGLE FINALE

Chaque plan doit rester suffisamment simple pour que l’identité de Tom demeure stable.

La complexité doit être obtenue au montage, pas en surchargeant une seule génération.

````

---

# FICHIER : `characters/Tom SDK v1.0.0/videos/runway.md`

```md
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
````

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

````

---

# FICHIER : `characters/Tom SDK v1.0.0/videos/veo.md`

```md
# VEO VIDEO GUIDE — TOM

Version : 1.0  
Statut : Guide fournisseur  
Fournisseur : Google  
Moteur : Veo

---

# 1. OBJECTIF

Ce fichier adapte le Video SDK de Tom aux générations réalisées avec Veo.

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

Ordre de préférence pour Tom :

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
````

---

# 4. PROMPT — FACE CAMÉRA

```text
A realistic medium close-up of Tom at eye level.

Tom looks directly into the camera with a warm,
confident and approachable expression.
He speaks naturally and makes one small open-hand gesture.
His breathing, blinking and facial movements are subtle and realistic.
His posture remains relaxed and professional.

The camera is stable with a very slow cinematic push-in.
Soft natural lighting illuminates his face evenly.
The background remains clean, modern and unchanged.

Preserve Tom's facial identity, hairstyle, hair color,
skin tone, body proportions, outfit and accessories
throughout the entire shot.
```

---

# 5. PROMPT — AVEC DIALOGUE

Lorsque le modèle produit l’audio :

```text
Medium close-up at eye level.

Tom looks directly into the camera and says in French:
« [INSÉRER LE DIALOGUE VALIDÉ] »

He speaks with a warm, clear and professional voice.
His delivery is natural, confident and conversational.
He makes one subtle open-hand gesture while speaking.
His lip movement is synchronized with the dialogue.

The camera remains stable.
Soft natural lighting.
No background music.
No additional voices.
Preserve his exact identity throughout the shot.
```

Le dialogue doit être court.

Pour un texte long, préférer plusieurs plans.

---

# 6. PROMPT — TÉLÉPHONE

```text
Medium shot at eye level.

Tom holds a smartphone naturally at chest height.
He briefly looks at the phone screen,
then returns his gaze to the camera with a small confident smile.
He subtly turns the phone toward the viewer without moving it excessively.
His fingers remain naturally positioned around the device.

The camera stays stable.
Soft realistic lighting.
The phone, his hands, his outfit and the background remain consistent.
Preserve Tom's exact facial identity throughout the shot.
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

Tom moves naturally from the initial pose to the final pose.
His facial identity, hairstyle, body proportions,
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

Ne pas laisser l’ambiance sonore entièrement implicite lorsqu’il est importante.

---

# 9. PROMPT REWRITING

Lorsqu’une fonction d’amélioration automatique du prompt est active :

* comparer le prompt initial et le résultat ;
* vérifier qu’aucun détail d’identité n’a été ajouté ;
* vérifier qu’aucun nouveau vêtement n’a été inventé ;
* vérifier qu’aucune action supplémentaire n’a été introduite ;
* désactiver ou contourner la réécriture lorsqu’il nuit à la cohérence.

Le moteur ne doit pas enrichir librement l’identité de Tom.

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

Cette richesse doit servir le plan, pas réinventer Tom.

````

---

# FICHIER : `characters/Tom SDK v1.0.0/videos/kling.md`

```md
# KLING VIDEO GUIDE — TOM

Version : 1.0  
Statut : Guide fournisseur  
Fournisseur : Kling AI

---

# 1. OBJECTIF

Ce fichier définit la méthode de production de Tom avec Kling.

Les noms de modèles, modes et paramètres pouvant évoluer, leur disponibilité doit être vérifiée au moment de chaque production.

---

# 2. MODE RECOMMANDÉ

Pour Tom, privilégier :

- image-to-video ;
- référence de personnage lorsqu’il est disponible ;
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
````

---

# 4. PROMPT — FACE CAMÉRA

```text
Medium close-up at eye level.

Tom looks directly into the camera with a warm,
natural and confident expression.
He makes one subtle open-hand gesture while speaking.
Natural blinking, gentle breathing and slight head movement.
His posture remains relaxed and professional.

The camera is locked and stable.
Smooth realistic motion.
Preserve his exact facial identity, hairstyle,
body proportions, outfit and accessories.
```

---

# 5. PROMPT — GESTUELLE CONTRÔLÉE

```text
Tom maintains eye contact with the camera.
He slowly raises one open hand to chest height,
holds the gesture briefly, then gently lowers it.
His other arm remains relaxed.
Natural facial movement and stable posture.
The camera remains fixed.
```

---

# 6. PROMPT — PRÉSENTATION D’APPLICATION

```text
Medium shot at eye level.

Tom holds a smartphone naturally in one hand.
He looks briefly at the screen,
then looks back at the camera with a friendly smile.
He slightly turns the phone toward the viewer.
His hands and fingers remain stable and anatomically correct.
The camera remains fixed.
Preserve his exact appearance and outfit.
```

L’écran final de l’application doit être incrusté au montage.

---

# 7. PROMPT — MOUVEMENT CAMÉRA

Pour un mouvement léger :

```text
A slow, smooth camera push-in at eye level
while Tom remains relaxed and maintains direct eye contact.
```

Pour un suivi :

```text
The camera smoothly tracks Tom at a constant distance
while he walks slowly and naturally.
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

Une intensité élevée n’est pas une valeur par défaut pour Tom.

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

La stabilité de Tom doit être validée avant d’augmenter la complexité.

````

---

# FICHIER : `characters/Tom SDK v1.0.0/videos/minimax.md`

```md
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
````

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

````

---

# FICHIER : `characters/Tom SDK v1.0.0/videos/openai.md`

```md
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
````

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

````

---

# FICHIER : `characters/Tom SDK v1.0.0/videos/future-models.md`

```md
# FUTURE VIDEO MODELS

Version : 1.0  
Statut : Officiel  
Portée : Intégration de nouveaux moteurs vidéo

---

# 1. OBJECTIF

Ce document décrit la procédure d’intégration d’un nouveau moteur vidéo dans le SDK de Tom.

Exemples possibles :

- Luma ;
- Pika ;
- PixVerse ;
- Adobe Firefly ;
- nouveaux modèles Runway ;
- nouveaux modèles Veo ;
- nouveaux modèles Kling ;
- futurs modèles OpenAI ;
- fournisseurs non encore connus.

Un nouveau fournisseur ne doit pas nécessiter de modifier l’identité ou la mémoire permanente de Tom.

---

# 2. PRINCIPE

L’intégration d’un moteur est un adaptateur.

```text
Virtual Human SDK
        ↓
Règles permanentes de Tom
        ↓
Adaptateur du fournisseur
        ↓
Moteur vidéo
````

Le fichier fournisseur traduit les règles existantes.

Il ne crée pas de nouvelles règles de personnalité.

---

# 3. NOM DU FICHIER

Format :

```text
provider-name.md
```

Exemples :

```text
luma.md
pika.md
pixverse.md
firefly.md
```

Utiliser :

* des minuscules ;
* aucun espace ;
* un nom stable ;
* le nom du fournisseur plutôt qu’un numéro de version temporaire.

---

# 4. ANALYSE OBLIGATOIRE

Avant l’intégration, documenter :

## Identification

* fournisseur ;
* nom du produit ;
* modèles disponibles ;
* date de vérification ;
* lien vers la documentation officielle ;
* interface ;
* API éventuelle.

## Entrées

* text-to-video ;
* image-to-video ;
* première image ;
* dernière image ;
* références de sujet ;
* références de style ;
* vidéo de référence ;
* audio ;
* dialogue.

## Sorties

* durées ;
* résolutions ;
* ratios ;
* formats ;
* audio ;
* filigrane éventuel.

## Contrôles

* caméra ;
* seed ;
* intensité du mouvement ;
* negative prompt ;
* lip-sync ;
* prolongation vidéo ;
* édition ;
* variations.

## Contraintes

* taille des fichiers ;
* formats d’image ;
* limites de prompt ;
* disponibilité géographique ;
* contenu autorisé ;
* coûts ;
* délais ;
* droits d’utilisation.

---

# 5. TESTS MINIMAUX

Chaque moteur doit passer les tests suivants.

## Test 1 — Identité statique

Plan poitrine.

Mouvement minimal.

Objectif :

* vérifier le visage ;
* vérifier les yeux ;
* vérifier la coiffure.

## Test 2 — Geste simple

Un geste de main.

Objectif :

* vérifier les doigts ;
* vérifier la fluidité ;
* vérifier la posture.

## Test 3 — Téléphone

Tom tient un smartphone.

Objectif :

* vérifier l’interaction avec un objet ;
* vérifier les mains ;
* vérifier la stabilité de l’objet.

## Test 4 — Marche

Plein pied.

Objectif :

* vérifier le corps ;
* vérifier les jambes ;
* vérifier le suivi caméra.

## Test 5 — Dialogue

Phrase courte.

Objectif :

* vérifier la voix ;
* vérifier les lèvres ;
* vérifier la prononciation.

## Test 6 — Continuité

Deux plans avec le même look.

Objectif :

* vérifier la cohérence entre les générations.

---

# 6. SCORE D’ÉVALUATION

Notation sur 5 :

```yaml
identity_fidelity: 0
face_stability: 0
eye_quality: 0
hand_quality: 0
body_motion: 0
camera_control: 0
prompt_adherence: 0
object_stability: 0
lip_sync: 0
audio_quality: 0
generation_speed: 0
cost_efficiency: 0
```

Calcul possible :

```text
Score global = somme des notes / nombre de critères applicables
```

Une bonne note globale ne compense pas une mauvaise fidélité d’identité.

Critère bloquant :

```text
identity_fidelity < 4/5
```

Dans ce cas, le moteur ne doit pas devenir le moteur principal de Tom.

---

# 7. STATUT D’UN MOTEUR

Valeurs possibles :

```text
experimental
supported
recommended
limited
deprecated
unsupported
```

Définition :

## experimental

Tests en cours.

## supported

Utilisable avec des précautions documentées.

## recommended

Validé pour la production officielle.

## limited

Utilisable uniquement pour certains types de plans.

## deprecated

Ancienne intégration conservée temporairement.

## unsupported

Ne respecte pas les exigences minimales du SDK.

---

# 8. STRUCTURE DU FICHIER FOURNISSEUR

Chaque nouveau fichier doit contenir :

```md
# NOM DU FOURNISSEUR

## Objectif
## Date de validation
## Modèles testés
## Modes disponibles
## Mode recommandé pour Tom
## Structure de prompt
## Prompt face caméra
## Prompt téléphone
## Prompt marche
## Negative prompt
## Paramètres
## Workflow
## Limites
## Erreurs fréquentes
## Contrôle qualité
## Statut
## Règle finale
```

---

# 9. PARAMÈTRES TECHNIQUES

Ne jamais placer dans la mémoire permanente de Tom :

* un identifiant de modèle temporaire ;
* un tarif ;
* une durée maximale ;
* une syntaxe API susceptible de changer ;
* une limitation commerciale ;
* une option propre à une interface.

Ces informations appartiennent au fichier fournisseur.

---

# 10. MISE À JOUR

Lorsqu’un fournisseur change son modèle :

1. conserver l’ancien résultat de test ;
2. noter la date ;
3. tester le nouveau modèle ;
4. comparer les scores ;
5. mettre à jour le statut ;
6. conserver l’historique dans le changelog ;
7. ne pas remplacer silencieusement le modèle de production.

---

# 11. SÉCURITÉ DES RÉFÉRENCES

Les références officielles de Tom doivent être :

* stockées dans le SDK ;
* utilisées uniquement par les services autorisés ;
* envoyées conformément aux règles du projet ;
* traçables ;
* non remplacées par des images trouvées en ligne ;
* supprimées d’un fournisseur lorsque cela est nécessaire et possible.

---

# 12. CRITÈRES DE VALIDATION

Un nouveau moteur peut être déclaré `supported` lorsqu’il permet :

* une identité stable ;
* un visage cohérent ;
* des mouvements humains ;
* une qualité suffisante des mains ;
* un contrôle minimal de la caméra ;
* un export exploitable ;
* un usage compatible avec les objectifs du projet.

Il devient `recommended` uniquement après plusieurs productions réelles validées.

---

# 13. RÈGLE FINALE

Un nouveau moteur doit s’adapter au SDK de Tom.

Le SDK de Tom ne doit jamais être déformé pour s’adapter aux limites d’un moteur.

```
```
