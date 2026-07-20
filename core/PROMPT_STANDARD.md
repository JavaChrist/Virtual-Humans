# PROMPT STANDARD

> Virtual Humans SDK
> Standard global de conception, de structuration, de validation et de versioning des prompts
> Version : 1.0.0
> Statut : actif

---

# 1. Objectif

Ce document définit les règles applicables à tous les prompts utilisés dans le **Virtual Humans SDK**.

Il garantit :

* la cohérence des personnages ;
* la répétabilité des générations ;
* la compatibilité avec plusieurs fournisseurs ;
* la traçabilité des résultats ;
* la séparation entre les règles permanentes et les instructions temporaires ;
* la réduction des erreurs ;
* la réutilisation des prompts ;
* la maintenance à long terme.

Ce standard s’applique aux prompts destinés à :

* la génération d’images ;
* la génération de vidéos ;
* l’animation d’images ;
* la synthèse vocale ;
* la génération de textes ;
* les dialogues ;
* les réseaux sociaux ;
* les présentations commerciales ;
* les workflows automatisés ;
* AI Command Center OS.

---

# 2. Principe fondamental

Un prompt ne doit jamais redéfinir librement un personnage.

Il doit traduire les règles officielles du SDK vers une demande de génération précise.

L’ordre de priorité est :

```text
Character Lock
→ identité
→ apparence
→ personnalité
→ standards globaux
→ mémoire spécialisée
→ prompt de scène
→ adaptation fournisseur
```

Un prompt temporaire ne peut pas contredire les fichiers officiels du personnage.

---

# 3. Source de vérité

Les prompts doivent être construits à partir des fichiers suivants :

```text
core/CHARACTER_STANDARD.md
core/PHOTO_STANDARD.md
core/VIDEO_STANDARD.md
core/QUALITY_STANDARD.md
core/LEGAL_STANDARD.md
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

Les bibliothèques de prompts sont des outils d’exécution.

Elles ne deviennent jamais la source de vérité du personnage.

---

# 4. Types de prompts

Chaque prompt doit appartenir à une catégorie explicite.

Catégories principales :

```text
character
image
video
animation
voice
dialogue
social
marketing
product
camera
quality-control
transformation
workflow
provider-specific
```

Un prompt peut combiner plusieurs catégories, mais une fonction principale doit toujours être identifiable.

---

# 5. Structure générale

Un prompt doit être construit selon une structure stable.

Structure recommandée :

```text
1. Objectif
2. Personnage
3. Identité visuelle
4. Tenue
5. Action
6. Expression
7. Comportement
8. Cadrage
9. Caméra
10. Éclairage
11. Décor
12. Style
13. Format
14. Contraintes
15. Éléments interdits
16. Sortie attendue
```

Toutes les sections ne sont pas obligatoires pour chaque génération.

Les éléments importants ne doivent cependant pas être implicites.

---

# 6. Prompt modulaire

Les prompts doivent être composés de blocs réutilisables.

Architecture recommandée :

```text
CHARACTER BLOCK
+ APPEARANCE BLOCK
+ OUTFIT BLOCK
+ ACTION BLOCK
+ EXPRESSION BLOCK
+ CAMERA BLOCK
+ ENVIRONMENT BLOCK
+ LIGHTING BLOCK
+ STYLE BLOCK
+ OUTPUT BLOCK
+ CONSTRAINT BLOCK
+ NEGATIVE BLOCK
```

Cette méthode permet :

* d’éviter les répétitions ;
* de modifier une scène sans redéfinir le personnage ;
* de changer de fournisseur ;
* de comparer plusieurs générations ;
* d’automatiser la construction des prompts.

---

# 7. Character Block

Le bloc personnage doit identifier clairement le Virtual Human utilisé.

Il peut contenir :

* nom ;
* identifiant technique ;
* genre de présentation ;
* âge apparent ;
* rôle ;
* niveau de réalisme ;
* références visuelles utilisées ;
* version du SDK.

Exemple conceptuel :

```text
Character: Mei
Character ID: mei
SDK version: 1.0.0
Role: professional virtual presenter
Visual identity must strictly match the approved Mei identity references.
```

Ce bloc ne doit pas contenir une description contradictoire avec `00_IDENTITY.md`.

---

# 8. Appearance Block

Le bloc apparence contient uniquement les caractéristiques nécessaires à la génération.

Il peut préciser :

* forme du visage ;
* cheveux ;
* yeux ;
* peau ;
* morphologie ;
* âge apparent ;
* signes distinctifs.

Il ne doit pas introduire de détails non validés.

Il ne doit pas être réécrit différemment à chaque génération lorsque les mêmes références sont utilisées.

---

# 9. Outfit Block

Le bloc tenue doit identifier un look officiel.

Format recommandé :

```text
Outfit ID: LOOK_001
```

Il peut préciser :

* vêtements ;
* couleurs ;
* matières ;
* chaussures ;
* accessoires ;
* niveau de formalité.

Lorsqu’un look officiel existe, le prompt doit utiliser son identifiant et ses fichiers de référence.

Il est déconseillé de reconstruire librement la tenue à partir d’une simple description.

---

# 10. Action Block

Le bloc action décrit ce que fait le personnage.

Une action doit être :

* précise ;
* observable ;
* réaliste ;
* limitée ;
* compatible avec la durée ;
* compatible avec la posture ;
* compatible avec les objets présents.

Exemples :

```text
standing naturally
holding a smartphone in the right hand
walking slowly toward the camera
speaking directly to the viewer
turning the head slightly to the left
```

Les formulations vagues comme celles-ci doivent être évitées :

```text
doing something dynamic
acting naturally
moving nicely
being engaging
```

---

# 11. Expression Block

Le bloc expression doit utiliser une expression officielle ou clairement définie.

Exemples :

```text
neutral
soft smile
confident
attentive
friendly
slightly surprised
```

L’expression doit rester compatible avec :

* la personnalité ;
* le message ;
* le contexte ;
* la voix ;
* le langage corporel.

Une émotion excessive ne doit pas être utilisée sans raison explicite.

---

# 12. Behavior Block

Le comportement doit être défini séparément de l’action.

Il peut préciser :

* posture ;
* regard ;
* gestuelle ;
* rythme ;
* distance sociale ;
* niveau d’énergie ;
* interaction avec la caméra ;
* interaction avec un objet ;
* interaction avec une autre personne.

Exemple :

```text
Relaxed upright posture, subtle hand gestures, direct but friendly eye contact, calm professional energy.
```

---

# 13. Camera Block

Le bloc caméra doit préciser les éléments nécessaires à la composition.

Il peut contenir :

* type de plan ;
* hauteur de caméra ;
* angle ;
* distance ;
* focale ;
* profondeur de champ ;
* regard caméra ;
* mouvement ;
* stabilité.

Exemple :

```text
Eye-level camera, medium shot, natural perspective, 50 mm lens equivalent, shallow depth of field.
```

Les termes incompatibles doivent être évités.

Exemple incorrect :

```text
close-up full-body portrait
```

---

# 14. Environment Block

Le bloc environnement décrit uniquement les éléments nécessaires à la scène.

Il doit préciser :

* lieu ;
* moment de la journée ;
* profondeur ;
* éléments principaux ;
* niveau d’activité ;
* présence ou absence de personnes ;
* relation entre le décor et le personnage.

Il est préférable de limiter le nombre d’éléments.

Un décor trop détaillé augmente le risque :

* d’artefacts ;
* de confusion ;
* de mauvaise composition ;
* d’incohérence visuelle.

---

# 15. Lighting Block

Le bloc éclairage doit décrire une lumière cohérente.

Il peut préciser :

* lumière naturelle ou artificielle ;
* direction ;
* douceur ;
* température ;
* contraste ;
* lumière principale ;
* lumière d’appoint ;
* lumière de fond.

Exemple :

```text
Soft commercial studio lighting, balanced skin tones, gentle shadows, no harsh highlights.
```

---

# 16. Style Block

Le style doit être explicite et stable.

Exemples :

```text
photorealistic
commercial photography
editorial portrait
cinematic realism
natural documentary style
professional studio photography
```

Les styles contradictoires doivent être évités.

Exemple incorrect :

```text
photorealistic flat cartoon anime documentary photo
```

Lorsqu’une transformation stylistique est souhaitée, elle doit être clairement séparée de l’identité officielle.

---

# 17. Output Block

Le bloc sortie doit préciser le résultat attendu.

Il peut contenir :

* format ;
* ratio ;
* orientation ;
* résolution ;
* durée ;
* nombre de variantes ;
* fond ;
* transparence ;
* codec ;
* fréquence d’images ;
* présence ou absence de son ;
* présence ou absence de texte.

Exemple :

```text
Vertical 9:16, 1080 × 1920, full-body composition, no text, no logo, uniform green background.
```

---

# 18. Constraint Block

Les contraintes positives doivent indiquer ce qui doit impérativement être respecté.

Exemples :

```text
The face must match the approved identity reference.
The outfit must match LOOK_003.
The smartphone must remain in the right hand.
The entire body must remain visible.
The background must be uniformly green.
```

Les contraintes importantes doivent être formulées explicitement.

Elles ne doivent pas être noyées dans un paragraphe trop long.

---

# 19. Negative Block

Le bloc négatif décrit les éléments interdits ou à éviter.

Il peut contenir :

* défauts anatomiques ;
* erreurs d’identité ;
* objets indésirables ;
* éléments de décor ;
* styles incompatibles ;
* artefacts ;
* comportements interdits.

Exemple :

```text
No extra fingers, no deformed hands, no facial identity drift, no duplicated limbs, no text, no watermark, no green clothing.
```

Les negative prompts doivent rester ciblés.

Une liste excessivement longue peut créer des résultats imprévisibles.

---

# 20. Instructions positives prioritaires

Il est préférable de décrire clairement le résultat souhaité plutôt que de dépendre uniquement d’interdictions.

Exemple recommandé :

```text
Both hands remain visible and anatomically correct.
```

plutôt que seulement :

```text
No bad hands.
```

Les instructions positives définissent la cible.

Les instructions négatives réduisent les risques.

Les deux approches doivent être complémentaires.

---

# 21. Niveau de précision

Le niveau de détail doit correspondre au moteur et à la tâche.

Un prompt trop court peut manquer de contrôle.

Un prompt trop long peut :

* diluer les priorités ;
* créer des contradictions ;
* réduire la stabilité ;
* produire des interprétations aléatoires.

Le prompt doit contenir uniquement les informations utiles à la génération concernée.

---

# 22. Une instruction par idée

Chaque instruction importante doit porter sur une seule idée.

Exemple recommandé :

```text
The camera is positioned at eye level.
The character looks directly at the camera.
The framing is a medium shot.
```

Exemple à éviter :

```text
Eye-level direct camera medium shot while naturally looking forward with a cinematic close distance.
```

La séparation améliore :

* la lisibilité ;
* la maintenance ;
* l’analyse des erreurs ;
* l’adaptation aux fournisseurs.

---

# 23. Ordre des instructions

Les informations les plus importantes doivent apparaître en premier.

Ordre recommandé pour une image :

```text
personnage
→ identité
→ action
→ tenue
→ cadrage
→ expression
→ décor
→ éclairage
→ style
→ format
→ contraintes
```

Ordre recommandé pour une vidéo :

```text
personnage
→ état initial
→ action principale
→ comportement
→ mouvement du corps
→ mouvement caméra
→ durée
→ continuité
→ décor
→ contraintes
```

---

# 24. Langue des prompts

La documentation du SDK peut être rédigée en français.

Les prompts peuvent être rédigés en français ou en anglais selon les performances du fournisseur.

La langue utilisée doit être indiquée dans les métadonnées.

Lorsqu’un prompt est traduit :

* le sens doit être conservé ;
* les contraintes ne doivent pas être affaiblies ;
* les termes techniques doivent rester cohérents ;
* la version traduite doit être reliée à la version source.

---

# 25. Variables

Les prompts réutilisables doivent employer des variables explicites.

Format recommandé :

```text
{{character_id}}
{{sdk_version}}
{{outfit_id}}
{{expression_id}}
{{pose_id}}
{{scene}}
{{action}}
{{camera_shot}}
{{aspect_ratio}}
{{duration}}
{{provider}}
```

Les variables doivent :

* être nommées clairement ;
* avoir un type ;
* avoir une valeur attendue ;
* être documentées ;
* disposer d’une valeur par défaut lorsque cela est pertinent.

---

# 26. Variables obligatoires et optionnelles

Chaque template doit différencier :

```text
required
optional
defaulted
derived
```

Exemple :

```text
character_id    required
outfit_id       required
expression_id   optional
aspect_ratio    defaulted
sdk_version     derived
```

Un workflow ne doit pas lancer une génération lorsqu’une variable obligatoire manque.

---

# 27. Valeurs contrôlées

Les variables importantes doivent utiliser des valeurs contrôlées.

Exemple :

```text
expression_id:
- neutral
- soft-smile
- confident
- attentive
```

Il faut éviter des valeurs libres différentes à chaque génération.

Les valeurs contrôlées réduisent :

* les incohérences ;
* les fautes ;
* les variantes inutiles ;
* les erreurs d’automatisation.

---

# 28. Références d’assets

Un prompt doit pouvoir indiquer les assets utilisés.

Exemples :

```text
identity_reference
pose_reference
expression_reference
outfit_reference
product_reference
environment_reference
```

Les références doivent pointer vers des fichiers validés.

Un asset en statut `rejected` ne doit jamais être utilisé.

---

# 29. Prompt maître

Chaque personnage peut disposer d’un prompt maître.

Le prompt maître contient uniquement les règles permanentes nécessaires à la génération.

Il peut inclure :

* identité ;
* apparence ;
* réalisme ;
* éléments verrouillés ;
* règles de cohérence ;
* interdictions principales.

Il ne doit pas contenir :

* une scène temporaire ;
* un produit spécifique ;
* une campagne ;
* une date ;
* une plateforme ;
* une tenue unique sauf tenue par défaut.

---

# 30. Prompt de scène

Le prompt de scène contient les éléments variables.

Il peut définir :

* lieu ;
* action ;
* tenue ;
* objet ;
* expression ;
* cadrage ;
* format ;
* ambiance ;
* destination.

Le prompt de scène ne doit pas recopier inutilement l’intégralité de la définition du personnage.

---

# 31. Prompt fournisseur

Une adaptation fournisseur peut modifier :

* la syntaxe ;
* l’ordre ;
* la longueur ;
* les pondérations ;
* les paramètres ;
* la manière de référencer une image ;
* le format du negative prompt.

Elle ne doit pas modifier :

* l’identité ;
* les contraintes permanentes ;
* le rôle ;
* les limites ;
* le Character Lock.

---

# 32. Indépendance des fournisseurs

Les templates génériques doivent rester indépendants de :

* OpenAI ;
* Runway ;
* Veo ;
* Kling ;
* MiniMax ;
* Midjourney ;
* Flux ;
* Stable Diffusion ;
* ElevenLabs ;
* tout autre fournisseur.

La structure recommandée est :

```text
prompt générique
→ adaptateur fournisseur
→ paramètres fournisseur
→ génération
```

Le prompt fournisseur est une traduction technique du prompt générique.

---

# 33. Paramètres techniques

Les paramètres ne doivent pas être mélangés au texte du prompt lorsqu’une API permet de les transmettre séparément.

Exemples :

```text
model
seed
steps
guidance
temperature
duration
aspect_ratio
resolution
frame_rate
audio
reference_strength
motion_strength
```

Ils doivent être enregistrés dans les métadonnées de la génération.

---

# 34. Seed et reproductibilité

Lorsqu’un fournisseur expose une seed, elle doit être conservée.

La reproductibilité doit également enregistrer :

* modèle ;
* version du modèle ;
* prompt ;
* negative prompt ;
* paramètres ;
* assets ;
* date ;
* fournisseur ;
* version du personnage.

Une seed seule ne garantit pas la reproductibilité si le modèle a changé.

---

# 35. Prompt image

Un prompt image doit préciser au minimum :

```text
personnage
identité
action ou pose
tenue
expression
cadrage
éclairage
décor
style
format
contraintes
```

Pour une image de référence vidéo, il doit également préciser :

* posture stable ;
* mains visibles ;
* contours propres ;
* absence d’éléments ambigus ;
* espace suffisant autour du personnage.

---

# 36. Prompt vidéo

Un prompt vidéo doit distinguer :

```text
état initial
action
mouvement corporel
expression
regard
mouvement caméra
durée
état final
continuité
```

Il faut éviter de demander trop d’actions dans une courte durée.

Exemple à éviter pour cinq secondes :

```text
walk, turn around, sit down, pick up a phone, speak, smile and leave the room
```

Une vidéo courte doit privilégier une action principale.

---

# 37. Prompt de voix

Un prompt vocal doit être basé sur `04_VOICE.md`.

Il doit préciser :

* langue ;
* accent ;
* rythme ;
* énergie ;
* émotion ;
* intention ;
* pauses ;
* prononciation ;
* durée cible ;
* texte exact.

Il ne doit pas demander d’imiter une personne réelle non autorisée.

---

# 38. Prompt de dialogue

Un prompt de dialogue doit préciser :

* rôle du personnage ;
* interlocuteur ;
* objectif ;
* ton ;
* niveau de langage ;
* informations autorisées ;
* informations interdites ;
* longueur attendue ;
* format de sortie ;
* besoin de validation.

La personnalité doit rester cohérente avec `02_PERSONALITY.md`.

---

# 39. Prompt marketing

Un prompt marketing doit s’appuyer sur :

```text
22_PRODUCT_MEMORY.md
23_BRAND_MEMORY.md
24_MARKETING_MEMORY.md
```

Il doit différencier :

* faits vérifiés ;
* bénéfices ;
* arguments ;
* hypothèses ;
* appels à l’action ;
* éléments nécessitant validation.

Il est interdit d’inventer :

* un prix ;
* une fonctionnalité ;
* une offre ;
* une garantie ;
* un partenariat ;
* une preuve sociale.

---

# 40. Prompt social

Un prompt social doit intégrer :

* plateforme ;
* audience ;
* format ;
* durée ;
* ton ;
* objectif ;
* appel à l’action ;
* contraintes de marque ;
* règles légales ;
* règles propres au personnage.

Il doit s’appuyer sur :

```text
14_SOCIAL_MEDIA.md
25_SOCIAL_MEMORY.md
core/SOCIAL_STANDARD.md
```

---

# 41. Prompt de transformation

Une transformation modifie un asset existant.

Exemples :

* changement de fond ;
* suppression du fond ;
* changement de tenue ;
* adaptation du cadrage ;
* changement de format ;
* amélioration de résolution ;
* variation d’expression.

Le prompt doit préciser les éléments à conserver strictement.

Exemple :

```text
Preserve the exact face, hairstyle, body proportions, pose and outfit. Replace only the background.
```

Les transformations globales doivent être évitées lorsque seule une modification locale est nécessaire.

---

# 42. Conservation de l’identité

Tout prompt impliquant un personnage doit contenir une instruction de conservation de l’identité lorsque le moteur peut provoquer une dérive.

Exemple :

```text
Preserve the exact approved facial identity and apparent age of the character.
```

Cette instruction ne remplace pas les références visuelles.

Elle complète leur utilisation.

---

# 43. Conservation des éléments verrouillés

Lors d’une modification, le prompt doit distinguer :

```text
éléments modifiables
éléments verrouillés
```

Exemple :

```text
Editable:
- background
- lighting
- framing

Locked:
- face
- body proportions
- hairstyle
- outfit
- expression
```

Cette séparation réduit les modifications involontaires.

---

# 44. Gestion des contradictions

Avant exécution, un prompt doit être vérifié pour détecter les contradictions.

Exemples :

```text
full-body close-up
static walking pose
direct eye contact while looking away
uniform green background with a detailed city behind
no shadows with dramatic hard lighting
```

En cas de contradiction :

1. identifier l’objectif principal ;
2. supprimer l’instruction secondaire incompatible ;
3. conserver les règles du Character Lock ;
4. simplifier le prompt ;
5. relancer la validation.

---

# 45. Gestion de la complexité

Une génération complexe doit être divisée en étapes.

Exemple :

```text
1. Générer le personnage conforme
2. Valider le visage
3. Valider la tenue
4. Créer le décor
5. Composer la scène
6. Ajouter le texte en postproduction
7. Animer
```

Il est préférable d’utiliser plusieurs étapes fiables qu’un prompt unique incontrôlable.

---

# 46. Bibliothèque de prompts

Chaque personnage peut disposer de :

```text
prompts/
```

Les fichiers doivent correspondre à des usages récurrents.

Exemples :

```text
portrait.md
green_screen.md
walking.md
selfie.md
instagram.md
youtube.md
interview.md
micro_trottoir.md
```

Chaque fichier doit contenir :

* objectif ;
* cas d’usage ;
* variables ;
* prompt générique ;
* negative prompt ;
* formats ;
* variantes ;
* contrôles qualité ;
* erreurs fréquentes ;
* adaptations fournisseurs.

---

# 47. Nommage des prompts

Format recommandé :

```text
<character-id>_<use-case>_<version>
```

Exemples :

```text
mei_portrait_v1
mei_green_screen_phone_v2
mei_instagram_product_v1
```

Les noms suivants doivent être évités :

```text
prompt1
test
final
nouveau_prompt
essai_2
```

---

# 48. Versioning

Les prompts doivent être versionnés.

Format recommandé :

```text
MAJOR.MINOR.PATCH
```

### MAJOR

Modification importante du comportement ou du résultat.

### MINOR

Ajout d’une capacité, d’une variable ou d’une variante compatible.

### PATCH

Correction de formulation ou de contrainte sans changement de fonction.

---

# 49. Métadonnées obligatoires

Chaque prompt validé doit pouvoir être relié à :

```text
prompt_id
prompt_version
character_id
character_sdk_version
prompt_type
language
provider
model
created_at
updated_at
author
status
required_assets
required_variables
output_format
validation_rules
```

Ces données peuvent être enregistrées dans un fichier JSON conforme à `prompt.schema.json`.

---

# 50. Statuts

Les statuts recommandés sont :

```text
draft
testing
review
approved
deprecated
archived
rejected
```

Seuls les prompts `approved` peuvent être utilisés automatiquement en production.

Un prompt `deprecated` ne doit plus être sélectionné pour de nouvelles générations.

---

# 51. Tests

Un prompt doit être testé sur plusieurs générations.

Le test doit vérifier :

* identité ;
* anatomie ;
* tenue ;
* action ;
* expression ;
* cadrage ;
* décor ;
* style ;
* conformité légale ;
* stabilité entre variantes.

Un résultat réussi ne suffit pas à valider un prompt.

La validation doit porter sur sa répétabilité.

---

# 52. Jeu de tests minimal

Avant validation, un prompt réutilisable devrait être testé avec :

```text
au moins 3 générations
au moins 2 seeds si disponibles
au moins 2 formats lorsque nécessaire
au moins 1 scénario de contrainte
au moins 1 contrôle d’erreur
```

Un prompt destiné à la production régulière peut nécessiter davantage de tests.

---

# 53. Score de prompt

Une grille de validation peut être utilisée :

```text
Fidélité personnage        /25
Respect de la demande      /20
Stabilité                  /15
Qualité visuelle           /15
Anatomie                   /10
Compatibilité fournisseur  /5
Maintenabilité             /5
Traçabilité                /5
Total                     /100
```

Seuils recommandés :

```text
90–100  → approved
80–89   → review
60–79   → correction nécessaire
0–59    → rejected
```

Une violation du Character Lock entraîne un rejet automatique.

---

# 54. Analyse des erreurs

Chaque échec doit être associé à une cause probable.

Catégories recommandées :

```text
identity-drift
anatomy-error
outfit-error
camera-error
composition-error
background-error
object-error
text-error
motion-error
provider-limitation
prompt-contradiction
missing-reference
```

Les erreurs récurrentes doivent conduire à :

* une correction du template ;
* une nouvelle contrainte ;
* une adaptation fournisseur ;
* une modification du workflow ;
* une limitation documentée.

---

# 55. Optimisation

L’optimisation d’un prompt doit se faire progressivement.

Méthode recommandée :

```text
1. Conserver une version de référence
2. Modifier une seule variable
3. Générer
4. Comparer
5. Documenter le résultat
6. Accepter ou annuler la modification
7. Incrémenter la version
```

Plusieurs changements simultanés rendent l’analyse difficile.

---

# 56. Interdictions

Il est interdit de :

* redéfinir l’identité dans un prompt temporaire ;
* ignorer le Character Lock ;
* utiliser un asset rejeté ;
* inventer des caractéristiques produit ;
* imiter une personne réelle non autorisée ;
* utiliser des instructions contradictoires ;
* publier un prompt non testé comme standard ;
* écraser un prompt approuvé sans versioning ;
* dépendre d’un seul fournisseur sans abstraction ;
* stocker des secrets d’API dans les prompts ;
* mélanger données personnelles et instructions de génération ;
* laisser une variable obligatoire non définie ;
* utiliser un prompt de test directement en production.

---

# 57. Sécurité des données

Les prompts ne doivent pas contenir :

* clés API ;
* mots de passe ;
* tokens ;
* données personnelles non nécessaires ;
* informations confidentielles ;
* secrets commerciaux non autorisés ;
* chemins système sensibles ;
* identifiants privés exposés.

Les secrets doivent être gérés par le système d’exécution.

---

# 58. Traçabilité

Chaque génération doit enregistrer :

```text
prompt utilisé
version
variables
assets
fournisseur
modèle
paramètres
date
résultat
statut
score qualité
validateur
```

Le résultat doit pouvoir être reproduit ou expliqué avec un niveau raisonnable de précision.

---

# 59. Compatibilité avec AI Command Center OS

AI Command Center OS doit pouvoir :

* charger un template ;
* résoudre ses variables ;
* récupérer les mémoires ;
* sélectionner les assets ;
* vérifier les contraintes ;
* adapter le prompt au fournisseur ;
* lancer la génération ;
* enregistrer les paramètres ;
* contrôler le résultat ;
* comparer avec les références ;
* demander une validation humaine ;
* archiver la génération.

Le système doit refuser l’exécution lorsque :

* une variable obligatoire manque ;
* un asset est rejeté ;
* le prompt contredit le Character Lock ;
* une règle légale est violée ;
* le fournisseur demandé est incompatible.

---

# 60. Exemple de template générique

```text
PROMPT ID:
{{prompt_id}}

CHARACTER:
{{character_id}}
SDK version: {{sdk_version}}
Preserve the exact approved identity.

OUTFIT:
{{outfit_id}}

ACTION:
{{action}}

EXPRESSION:
{{expression}}

BEHAVIOR:
{{behavior}}

CAMERA:
{{camera}}

ENVIRONMENT:
{{environment}}

LIGHTING:
{{lighting}}

STYLE:
{{style}}

OUTPUT:
{{aspect_ratio}}
{{resolution}}
{{background}}

CONSTRAINTS:
{{constraints}}

NEGATIVE:
{{negative_prompt}}
```

---

# 61. Critères minimaux de validation

Un prompt ne peut être classé `approved` que si :

```text
objectif clair
ET structure compréhensible
ET variables documentées
ET identité préservée
ET contraintes cohérentes
ET assets autorisés
ET tests réalisés
ET résultats suffisamment stables
ET métadonnées enregistrées
ET validation humaine effectuée
```

---

# 62. Règle finale

Un bon prompt n’est pas celui qui produit une seule belle génération.

Un bon prompt doit être :

```text
cohérent
réutilisable
testable
versionné
traçable
adaptable
maintenable
compatible avec le personnage
```

La précision du prompt doit servir la cohérence du Virtual Human.

Elle ne doit jamais remplacer les standards, les assets officiels ou la validation humaine.
