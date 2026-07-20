# CHARACTER STANDARD

> Virtual Humans SDK
> Standard global de définition, de cohérence et de gouvernance des personnages virtuels
> Version : 1.0.0
> Statut : actif

---

## 1. Objectif

Ce document définit le standard global applicable à tous les personnages virtuels créés, intégrés ou exploités dans le **Virtual Humans SDK**.

Il garantit que chaque personnage possède :

* une identité stable ;
* une apparence cohérente ;
* une personnalité définie ;
* un comportement prévisible ;
* une mémoire structurée ;
* des limites explicites ;
* une traçabilité de ses évolutions ;
* une compatibilité avec les outils d’image, de vidéo, de voix et d’intelligence artificielle.

Ce standard s’applique à tous les personnages présents ou futurs, notamment :

* Mei ;
* Tom ;
* tout nouveau personnage ajouté au dossier `characters/`.

---

## 2. Principe fondamental

Un Virtual Human n’est pas une simple image, un avatar ou un prompt.

Il constitue un ensemble cohérent composé de :

```text
Identité
+ Apparence
+ Personnalité
+ Voix
+ Comportement
+ Mémoire
+ Capacités
+ Limites
+ Relations
+ Règles de génération
+ Assets de référence
```

La cohérence du personnage doit être maintenue dans tous les contextes :

* photographie ;
* vidéo ;
* animation ;
* voix ;
* dialogue ;
* réseau social ;
* marketing ;
* présentation produit ;
* interaction utilisateur ;
* intégration dans AI Command Center OS.

---

## 3. Structure obligatoire d’un personnage

Chaque personnage doit disposer de son propre dossier dans :

```text
characters/
```

Le nom recommandé est :

```text
characters/<Character Name> SDK v<version>/
```

Exemple :

```text
characters/Mei SDK v1.0.0/
```

Chaque SDK personnage doit être autonome et contenir :

```text
00_IDENTITY.md
01_APPEARANCE.md
02_PERSONALITY.md
03_WARDROBE.md
04_VOICE.md
05_CAMERA.md
06_BRAND.md
07_BEHAVIOR.md
08_PROMPTS.md
09_WORKFLOWS.md
11_CAPABILITIES.md
12_LIMITATIONS.md
13_RELATIONSHIPS.md
14_SOCIAL_MEDIA.md
15_MEMORY_STRUCTURE.md
16_EVOLUTION.md
20_CHARACTER_PACKAGE.md
21_CHARACTER_MEMORY.md
22_PRODUCT_MEMORY.md
23_BRAND_MEMORY.md
24_MARKETING_MEMORY.md
25_SOCIAL_MEMORY.md
26_VIDEO_MEMORY.md
99_CHARACTER_LOCK.md
```

Le SDK peut également contenir :

```text
assets/
prompts/
videos/
```

---

## 4. Source de vérité

La source de vérité d’un personnage est constituée par :

1. ses fichiers Markdown validés ;
2. ses fichiers JSON validés ;
3. ses assets de référence approuvés ;
4. son fichier `99_CHARACTER_LOCK.md`.

En cas de contradiction, l’ordre de priorité est :

```text
99_CHARACTER_LOCK.md
→ 00_IDENTITY.md
→ 01_APPEARANCE.md
→ 02_PERSONALITY.md
→ fichiers spécialisés
→ prompts
→ génération produite
```

Une image, une vidéo ou un texte généré ne peut jamais modifier automatiquement la définition officielle du personnage.

---

## 5. Identité obligatoire

Chaque personnage doit avoir une identité explicite et stable.

Le fichier `00_IDENTITY.md` doit définir au minimum :

* nom officiel ;
* identifiant technique ;
* rôle ;
* fonction ;
* âge apparent ;
* genre de présentation ;
* origine narrative si applicable ;
* langue principale ;
* langues secondaires ;
* contexte d’utilisation ;
* positionnement public ;
* statut réel ou fictif ;
* propriétaire du personnage ;
* version du SDK.

L’identité ne doit pas varier selon :

* la plateforme ;
* le moteur d’image ;
* le moteur vidéo ;
* le réseau social ;
* la campagne ;
* le produit présenté.

---

## 6. Identifiant technique

Chaque personnage doit posséder un identifiant technique stable.

Format recommandé :

```text
lowercase-kebab-case
```

Exemples :

```text
mei
tom
emma
lucas
```

Cet identifiant peut être utilisé dans :

* les fichiers JSON ;
* les bases de données ;
* les noms d’assets ;
* les APIs ;
* les systèmes de mémoire ;
* les outils de génération ;
* AI Command Center OS.

L’identifiant technique ne doit pas être modifié après mise en production sans migration formelle.

---

## 7. Apparence

Le fichier `01_APPEARANCE.md` doit définir les caractéristiques visuelles constantes du personnage.

Il doit notamment préciser :

* forme du visage ;
* morphologie ;
* taille apparente ;
* proportions ;
* couleur de peau ;
* yeux ;
* cheveux ;
* sourcils ;
* nez ;
* lèvres ;
* signes distinctifs ;
* maquillage habituel ;
* niveau de réalisme ;
* âge visuel ;
* éléments interdits.

Les caractéristiques identitaires permanentes ne doivent pas être altérées par un changement de tenue, de décor ou de plateforme.

---

## 8. Assets maîtres

Chaque personnage doit disposer d’assets de référence validés.

Les catégories recommandées sont :

```text
assets/identity/
assets/poses/
assets/expressions/
assets/outfits/
assets/videos/
```

Les assets maîtres servent de référence pour :

* la reconnaissance du visage ;
* la cohérence corporelle ;
* les proportions ;
* les expressions ;
* les poses ;
* les vêtements ;
* les futures générations.

Un asset maître ne doit pas être remplacé sans validation humaine.

---

## 9. Hiérarchie des assets

Les assets doivent être classés selon leur niveau de confiance.

### Niveau 1 — Master

Référence officielle et verrouillée.

Utilisation :

* entraînement ;
* génération ;
* comparaison ;
* contrôle qualité ;
* validation de cohérence.

### Niveau 2 — Approved

Asset validé pour un usage public ou opérationnel.

### Niveau 3 — Draft

Asset de travail non encore approuvé.

### Niveau 4 — Rejected

Asset refusé et interdit à la réutilisation comme référence.

Un asset rejeté ne doit jamais être utilisé pour générer une nouvelle version du personnage.

---

## 10. Personnalité

Le fichier `02_PERSONALITY.md` doit définir une personnalité stable.

Il doit préciser :

* traits principaux ;
* valeurs ;
* ton ;
* niveau d’énergie ;
* humour ;
* langage ;
* posture relationnelle ;
* réactions habituelles ;
* réactions interdites ;
* niveau d’émotion ;
* degré de spontanéité ;
* limites de rôle.

La personnalité doit rester cohérente entre :

* texte ;
* voix ;
* image ;
* vidéo ;
* réseaux sociaux ;
* conversations ;
* présentations.

---

## 11. Séparation identité / rôle

L’identité du personnage ne doit pas être confondue avec son rôle temporaire.

Exemple :

```text
Identité : Mei
Rôle permanent : présentatrice virtuelle
Mission temporaire : présenter RideCloud
```

La mission peut changer.

L’identité, la personnalité et les traits visuels fondamentaux ne changent pas.

---

## 12. Tenues

Les tenues doivent être définies dans :

```text
03_WARDROBE.md
assets/outfits/
```

Chaque tenue validée doit posséder au minimum :

```text
look.json
look.md
look.png
thumbnail.png
```

Chaque look doit avoir un identifiant unique.

Format recommandé :

```text
LOOK_001
LOOK_002
LOOK_003
```

Une tenue ne doit pas modifier :

* le visage ;
* la morphologie ;
* la taille ;
* l’âge apparent ;
* l’identité du personnage.

---

## 13. Voix

Chaque personnage doit disposer d’une définition vocale dans :

```text
04_VOICE.md
```

La voix doit être décrite indépendamment du fournisseur technique.

Le document doit définir :

* genre vocal ;
* âge vocal ;
* timbre ;
* hauteur ;
* rythme ;
* énergie ;
* accent ;
* articulation ;
* respirations ;
* émotions autorisées ;
* émotions interdites ;
* vitesse habituelle ;
* style narratif ;
* règles de prononciation.

Une voix de fournisseur ne constitue qu’une implémentation.

La définition vocale reste la source de vérité.

---

## 14. Caméra

Le fichier `05_CAMERA.md` doit définir la manière dont le personnage est filmé ou photographié.

Il doit notamment préciser :

* angles autorisés ;
* angles interdits ;
* hauteur de caméra ;
* focales recommandées ;
* cadrages ;
* distance ;
* regard caméra ;
* profondeur de champ ;
* mouvements caméra ;
* éclairage ;
* niveau de proximité ;
* plans adaptés à chaque usage.

Les règles caméra doivent préserver :

* la lisibilité du visage ;
* la reconnaissance immédiate ;
* la cohérence corporelle ;
* le naturel du personnage.

---

## 15. Comportement

Le fichier `07_BEHAVIOR.md` définit la manière dont le personnage agit.

Il doit couvrir :

* posture ;
* gestes ;
* regard ;
* déplacements ;
* gestion des mains ;
* interaction avec des objets ;
* réaction à une autre personne ;
* distance sociale ;
* expression émotionnelle ;
* comportement face caméra ;
* comportement hors caméra ;
* comportements interdits.

Le comportement doit être compatible avec la personnalité.

---

## 16. Cohérence multimodale

Le personnage doit rester reconnaissable et cohérent dans toutes les modalités.

```text
Texte
Voix
Image
Vidéo
Animation
Interaction
Mémoire
```

Une même situation doit provoquer des réactions compatibles dans toutes les modalités.

Exemple :

Si le personnage est défini comme calme et professionnel :

* son texte doit rester posé ;
* sa voix ne doit pas être agressive ;
* ses gestes ne doivent pas être excessifs ;
* son montage vidéo ne doit pas être chaotique ;
* son expression faciale doit rester cohérente.

---

## 17. Capacités

Les capacités officielles doivent être décrites dans :

```text
11_CAPABILITIES.md
```

Une capacité doit préciser :

* ce que le personnage sait faire ;
* dans quel contexte ;
* avec quels outils ;
* avec quel niveau de fiabilité ;
* avec quelles restrictions ;
* si une validation humaine est nécessaire.

Aucune capacité ne doit être supposée uniquement parce qu’un modèle technique la permet.

---

## 18. Limites

Les limites doivent être définies dans :

```text
12_LIMITATIONS.md
```

Elles doivent couvrir :

* limites narratives ;
* limites techniques ;
* limites comportementales ;
* limites légales ;
* limites commerciales ;
* limites de représentation ;
* sujets interdits ;
* actions nécessitant validation ;
* risques de confusion avec une personne réelle.

Les limites priment toujours sur les capacités.

---

## 19. Relations

Le fichier `13_RELATIONSHIPS.md` doit définir les relations officielles du personnage avec :

* le propriétaire du SDK ;
* l’entreprise ;
* les marques ;
* les produits ;
* les autres personnages ;
* les utilisateurs ;
* les partenaires ;
* les clients ;
* les communautés.

Une relation doit préciser :

* nature ;
* niveau de proximité ;
* ton ;
* autorisations ;
* limites ;
* comportement attendu.

---

## 20. Mémoire

La mémoire du personnage doit être structurée et contrôlée.

Elle peut inclure :

```text
Character Memory
Product Memory
Brand Memory
Marketing Memory
Social Memory
Video Memory
```

La mémoire ne doit pas modifier automatiquement l’identité du personnage.

Une information mémorisée doit être classée selon son type :

```text
permanente
long terme
temporaire
contextuelle
expirée
interdite
```

---

## 21. Séparation des mémoires

Les différents types de mémoire ne doivent pas être mélangés.

### Character Memory

Connaissances sur le personnage lui-même.

### Product Memory

Connaissances sur les produits présentés.

### Brand Memory

Règles et informations sur les marques.

### Marketing Memory

Stratégies, campagnes, audiences et objectifs.

### Social Memory

Comportements adaptés aux réseaux sociaux.

### Video Memory

Règles visuelles et comportementales applicables aux vidéos.

---

## 22. Évolution

Toute évolution doit être documentée dans :

```text
16_EVOLUTION.md
```

Une évolution peut concerner :

* apparence ;
* voix ;
* personnalité ;
* tenue ;
* capacités ;
* mémoire ;
* rôle ;
* outils compatibles ;
* comportement ;
* positionnement public.

Toute évolution significative doit comporter :

* date ;
* version ;
* raison ;
* impact ;
* fichiers modifiés ;
* assets concernés ;
* validation humaine ;
* possibilité de retour arrière.

---

## 23. Versioning

Chaque personnage doit suivre une version explicite.

Format recommandé :

```text
MAJOR.MINOR.PATCH
```

Exemple :

```text
1.0.0
```

### MAJOR

Modification incompatible ou importante :

* changement d’identité ;
* changement majeur d’apparence ;
* changement de rôle ;
* nouvelle orientation publique ;
* rupture de compatibilité.

### MINOR

Ajout compatible :

* nouvelle tenue ;
* nouvelle capacité ;
* nouvelle plateforme ;
* nouvelle voix secondaire ;
* nouveau workflow.

### PATCH

Correction sans changement fonctionnel majeur :

* chemin corrigé ;
* faute ;
* clarification ;
* métadonnée ;
* amélioration documentaire.

---

## 24. Character Lock

Chaque personnage doit disposer d’un fichier :

```text
99_CHARACTER_LOCK.md
```

Ce fichier définit les éléments non négociables.

Il doit notamment verrouiller :

* le visage ;
* l’identité ;
* l’âge apparent ;
* la morphologie ;
* les traits distinctifs ;
* la personnalité fondamentale ;
* les comportements interdits ;
* les usages interdits ;
* les règles de consentement ;
* les limites légales ;
* la procédure de modification.

Aucune génération ne peut être considérée conforme si elle viole le Character Lock.

---

## 25. Contrôle de cohérence

Avant validation, toute production doit être comparée aux références officielles.

Le contrôle doit porter sur :

### Identité

* visage reconnaissable ;
* âge cohérent ;
* traits stables ;
* absence de fusion avec une autre personne.

### Apparence

* morphologie cohérente ;
* cheveux conformes ;
* yeux conformes ;
* peau conforme ;
* proportions conformes.

### Personnalité

* ton cohérent ;
* langage cohérent ;
* émotion cohérente ;
* attitude cohérente.

### Comportement

* gestes naturels ;
* regard correct ;
* posture adaptée ;
* interaction crédible.

### Contexte

* tenue adaptée ;
* décor adapté ;
* objet correctement manipulé ;
* marque correctement représentée.

---

## 26. Règle de validation

Aucun asset ne doit être classé comme officiel sans validation humaine.

Les statuts recommandés sont :

```text
draft
review
approved
rejected
archived
```

Seuls les contenus avec le statut :

```text
approved
```

peuvent être utilisés publiquement ou servir de nouvelle référence maître.

---

## 27. Gestion des erreurs

Lorsqu’une génération présente une erreur :

1. ne pas modifier les standards pour accepter l’erreur ;
2. identifier la source de l’incohérence ;
3. vérifier les références utilisées ;
4. corriger le prompt ou le workflow ;
5. générer une nouvelle version ;
6. comparer avec les assets maîtres ;
7. documenter les erreurs récurrentes.

Les erreurs fréquentes doivent être ajoutées dans les règles de limitation ou les guides techniques.

---

## 28. Interdictions générales

Il est interdit de :

* changer silencieusement l’identité d’un personnage ;
* modifier son visage sans validation ;
* fusionner deux personnages ;
* utiliser un asset rejeté comme référence ;
* attribuer au personnage une capacité non validée ;
* inventer une relation officielle ;
* créer une déclaration publique non autorisée ;
* présenter le personnage comme humain réel lorsque ce n’est pas le cas ;
* contourner les règles légales ou éthiques ;
* écraser un document validé sans versioning ;
* publier un contenu non approuvé comme référence officielle.

---

## 29. Compatibilité avec les fournisseurs

Le SDK doit rester indépendant des fournisseurs.

Les standards ne doivent pas dépendre exclusivement de :

* Runway ;
* Veo ;
* Kling ;
* MiniMax ;
* OpenAI ;
* ElevenLabs ;
* tout autre fournisseur.

Les fichiers propres aux fournisseurs doivent traduire les standards du personnage vers les capacités du moteur utilisé.

Le fournisseur ne doit jamais devenir la source de vérité du personnage.

---

## 30. Intégration avec AI Command Center OS

AI Command Center OS doit pouvoir :

* identifier le personnage ;
* charger son package ;
* lire ses mémoires ;
* sélectionner ses assets ;
* construire ses prompts ;
* choisir un workflow ;
* sélectionner un fournisseur ;
* générer un contenu ;
* exécuter un contrôle qualité ;
* demander une validation humaine ;
* archiver le résultat ;
* enregistrer les décisions.

Le Virtual Human doit rester exploitable indépendamment d’AI Command Center OS.

L’intégration ne doit pas enfermer le SDK dans une seule application.

---

## 31. Création d’un nouveau personnage

La création d’un nouveau personnage doit suivre cet ordre :

```text
1. Définition de l’objectif
2. Création de l’identité
3. Définition de l’apparence
4. Création des assets maîtres
5. Définition de la personnalité
6. Création des expressions
7. Création des poses
8. Création de la garde-robe
9. Définition de la voix
10. Définition du comportement
11. Définition des capacités
12. Définition des limites
13. Création des mémoires
14. Création des prompts
15. Tests photo et vidéo
16. Contrôle qualité
17. Character Lock
18. Version 1.0.0
```

---

## 32. Critères minimaux de publication

Un personnage ne peut pas être publié ou exploité officiellement sans :

* identité complète ;
* apparence documentée ;
* personnalité documentée ;
* assets maîtres validés ;
* au moins une tenue officielle ;
* règles de voix ;
* règles caméra ;
* comportement défini ;
* capacités définies ;
* limites définies ;
* mémoire structurée ;
* Character Lock validé ;
* contrôle qualité ;
* validation humaine.

---

## 33. Critères de conformité

Un personnage est considéré conforme lorsque :

```text
Identité stable
ET apparence stable
ET personnalité stable
ET comportements cohérents
ET limites respectées
ET assets validés
ET mémoire contrôlée
ET génération traçable
ET validation humaine effectuée
```

Si l’un de ces éléments échoue, la production doit rester en statut :

```text
draft
```

ou :

```text
review
```

---

## 34. Gouvernance

Le propriétaire du Virtual Humans SDK reste responsable :

* des identités créées ;
* des droits d’utilisation ;
* des assets ;
* des validations ;
* des versions ;
* de la publication ;
* de la conformité ;
* des fournisseurs sélectionnés ;
* des contenus générés.

L’intelligence artificielle peut proposer, générer et contrôler.

Elle ne remplace pas la validation humaine pour les décisions structurantes.

---

## 35. Règle finale

Chaque Virtual Human doit être traité comme un produit logiciel versionné et non comme une simple création graphique.

Son identité doit être :

```text
définie
documentée
testée
validée
verrouillée
versionnée
traçable
```

La cohérence du personnage prime sur la vitesse de production.

Lorsqu’un doute existe entre créativité et identité, l’identité officielle doit toujours être préservée.
