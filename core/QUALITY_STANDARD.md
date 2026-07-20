# QUALITY STANDARD

> Virtual Humans SDK
> Standard global de contrôle qualité, validation, scoring et traçabilité
> Version : 1.0.0
> Statut : actif

---

# 1. Objectif

Ce document définit les règles globales de contrôle qualité applicables à toutes les productions du **Virtual Humans SDK**.

Il garantit que chaque contenu généré est :

* fidèle au personnage ;
* techniquement exploitable ;
* cohérent avec son contexte ;
* conforme aux standards ;
* juridiquement utilisable ;
* traçable ;
* validé avant publication.

Ce standard s’applique à tous les personnages présents et futurs dans :

```text
characters/
```

Il concerne notamment :

* les images ;
* les vidéos ;
* les voix ;
* les textes ;
* les dialogues ;
* les animations ;
* les assets ;
* les prompts ;
* les workflows ;
* les contenus sociaux ;
* les supports marketing ;
* les présentations commerciales.

---

# 2. Principe fondamental

La qualité ne se limite pas à l’esthétique.

Une production de qualité doit respecter simultanément :

```text
Identité
+ Cohérence
+ Technique
+ Contexte
+ Conformité
+ Traçabilité
+ Validation
```

Un contenu visuellement réussi mais non fidèle au personnage doit être rejeté.

Un contenu fidèle mais techniquement inutilisable ne peut pas être approuvé.

---

# 3. Priorités de validation

L’ordre de priorité est :

```text
1. Sécurité et conformité légale
2. Character Lock
3. Identité
4. Cohérence du personnage
5. Exactitude du contenu
6. Qualité technique
7. Qualité esthétique
8. Performance marketing
```

Une qualité esthétique élevée ne compense jamais une violation située plus haut dans cette hiérarchie.

---

# 4. Sources de vérité

Le contrôle qualité doit s’appuyer sur :

```text
core/CHARACTER_STANDARD.md
core/LEGAL_STANDARD.md
core/PHOTO_STANDARD.md
core/PROMPT_STANDARD.md
core/SOCIAL_STANDARD.md
core/VIDEO_STANDARD.md
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

Les contenus générés ne constituent jamais leur propre référence de qualité.

---

# 5. Périmètre du contrôle

Le contrôle qualité doit couvrir au minimum :

```text
Identité
Apparence
Anatomie
Voix
Comportement
Action
Caméra
Décor
Objet
Marque
Produit
Texte
Technique
Légal
Format
Destination
Traçabilité
```

Chaque type de production peut ajouter des critères spécifiques.

---

# 6. Niveaux de contrôle

Le SDK utilise plusieurs niveaux de contrôle.

## Niveau 1 — Contrôle automatique

Vérifie les éléments mesurables :

* format ;
* résolution ;
* durée ;
* taille ;
* présence des fichiers ;
* métadonnées ;
* variables ;
* chemins ;
* statut ;
* conformité au schéma JSON ;
* présence d’un prompt ;
* présence d’un identifiant.

## Niveau 2 — Contrôle assisté par IA

Analyse notamment :

* cohérence du visage ;
* respect du look ;
* présence d’artefacts ;
* conformité du texte ;
* cohérence comportementale ;
* erreurs visibles ;
* contradictions.

## Niveau 3 — Contrôle humain

Valide :

* l’identité ;
* le réalisme ;
* la crédibilité ;
* l’image de marque ;
* la conformité juridique ;
* l’acceptabilité publique ;
* la qualité finale.

Une validation automatique ne remplace jamais la validation humaine pour un contenu officiel.

---

# 7. Statuts qualité

Les statuts standards sont :

```text
draft
generated
review
approved
rejected
archived
deprecated
```

## Draft

Contenu en préparation ou incomplet.

## Generated

Contenu produit mais non contrôlé.

## Review

Contenu en cours de vérification.

## Approved

Contenu validé pour son usage prévu.

## Rejected

Contenu refusé.

## Archived

Contenu conservé pour historique.

## Deprecated

Contenu ancien encore conservé mais interdit pour une nouvelle production.

---

# 8. Cycle de validation

Le cycle standard est :

```text
brief
→ prompt
→ génération
→ contrôle automatique
→ contrôle assisté
→ revue humaine
→ approved ou rejected
→ archivage
```

Un contenu ne doit pas passer directement de `generated` à `approved` sans contrôle.

---

# 9. Contrôle du brief

Avant génération, le brief doit être vérifié.

Il doit préciser :

* personnage ;
* objectif ;
* usage ;
* plateforme ;
* public ;
* format ;
* message ;
* produit ;
* marque ;
* tenue ;
* action ;
* durée si vidéo ;
* délai ;
* niveau de validation requis.

Un brief incomplet augmente le risque d’erreur.

---

# 10. Contrôle du prompt

Le prompt doit être vérifié avant exécution.

Il faut confirmer :

* l’identité correcte ;
* le bon personnage ;
* la bonne version ;
* le bon look ;
* les bonnes références ;
* la cohérence des instructions ;
* l’absence de contradiction ;
* les variables obligatoires ;
* les restrictions ;
* le format ;
* la destination.

Un prompt incohérent ne doit pas être exécuté en production.

---

# 11. Contrôle de l’identité

L’identité constitue le critère principal.

Il faut vérifier :

* forme du visage ;
* proportions du visage ;
* yeux ;
* nez ;
* bouche ;
* mâchoire ;
* menton ;
* sourcils ;
* implantation des cheveux ;
* âge apparent ;
* origine apparente ;
* morphologie ;
* signes distinctifs.

Une dérive d’identité importante entraîne un rejet automatique.

---

# 12. Contrôle de l’apparence

L’apparence doit rester cohérente avec :

```text
01_APPEARANCE.md
03_WARDROBE.md
assets/identity/
assets/outfits/
```

Les points à contrôler sont :

* coiffure ;
* maquillage ;
* peau ;
* tenue ;
* chaussures ;
* accessoires ;
* proportions ;
* style général ;
* niveau de réalisme.

---

# 13. Contrôle anatomique

Pour une image ou une vidéo, vérifier :

* nombre de membres ;
* longueur des bras ;
* longueur des jambes ;
* articulation ;
* posture ;
* équilibre ;
* position du bassin ;
* épaules ;
* mains ;
* doigts ;
* pieds ;
* cou ;
* relation tête-corps.

Une anomalie anatomique visible peut suffire à rejeter le contenu.

---

# 14. Contrôle des mains

Le contrôle des mains est obligatoire.

À vérifier :

* nombre de doigts ;
* doigts fusionnés ;
* doigts manquants ;
* doigts supplémentaires ;
* paume ;
* poignets ;
* ongles ;
* prise d’objet ;
* orientation ;
* cohérence entre les images d’une séquence.

Les mains doivent rester naturelles et lisibles.

---

# 15. Contrôle du regard

Le regard doit correspondre à l’intention de la scène.

À vérifier :

* direction des yeux ;
* symétrie ;
* point de fixation ;
* regard caméra ;
* regard vers un interlocuteur ;
* continuité du regard en vidéo ;
* absence de dérive ou de strabisme artificiel.

---

# 16. Contrôle des expressions

L’expression doit être :

* cohérente avec la personnalité ;
* adaptée au message ;
* compatible avec la voix ;
* compatible avec le comportement ;
* naturelle ;
* stable dans une séquence.

Une expression excessivement figée ou artificielle doit être corrigée.

---

# 17. Contrôle du comportement

Le comportement doit respecter :

```text
02_PERSONALITY.md
07_BEHAVIOR.md
```

Il faut contrôler :

* posture ;
* gestes ;
* niveau d’énergie ;
* distance sociale ;
* attitude ;
* regard ;
* rythme ;
* interaction avec les objets ;
* interaction avec les autres personnes ;
* cohérence émotionnelle.

---

# 18. Contrôle de la voix

Pour un contenu vocal, vérifier :

* identité vocale ;
* timbre ;
* rythme ;
* articulation ;
* accent ;
* énergie ;
* émotion ;
* prononciation ;
* respiration ;
* stabilité ;
* naturel ;
* synchronisation éventuelle.

La voix doit respecter `04_VOICE.md`.

---

# 19. Contrôle du texte parlé

Le texte parlé doit être vérifié séparément de la voix.

Il faut contrôler :

* exactitude ;
* grammaire ;
* prononciation attendue ;
* ton ;
* longueur ;
* conformité produit ;
* conformité marque ;
* conformité légale ;
* appel à l’action ;
* absence d’allégation trompeuse.

---

# 20. Contrôle de la synchronisation labiale

Pour une vidéo parlée, vérifier :

* ouverture des lèvres ;
* fermeture des lèvres ;
* synchronisation ;
* mouvement de la mâchoire ;
* cohérence avec les phonèmes ;
* stabilité du visage ;
* absence de tremblement ;
* continuité entre les plans.

Une mauvaise synchronisation visible empêche l’approbation.

---

# 21. Contrôle de la caméra

La caméra doit respecter `05_CAMERA.md`.

À vérifier :

* cadrage ;
* hauteur ;
* angle ;
* distance ;
* focale ;
* perspective ;
* stabilité ;
* profondeur de champ ;
* mouvement ;
* continuité ;
* espace autour du personnage.

---

# 22. Contrôle du décor

Le décor doit être :

* cohérent avec la scène ;
* crédible ;
* lisible ;
* compatible avec le personnage ;
* compatible avec le produit ;
* compatible avec la marque ;
* exempt d’éléments incohérents.

Il faut détecter :

* perspectives impossibles ;
* objets fusionnés ;
* personnes déformées ;
* textes illisibles ;
* doubles éléments ;
* architecture incohérente ;
* éléments dangereux ou non autorisés.

---

# 23. Contrôle des objets

Chaque objet important doit être vérifié.

Exemples :

```text
smartphone
ordinateur
véhicule
microphone
produit
document
accessoire
```

Points de contrôle :

* taille ;
* orientation ;
* perspective ;
* prise en main ;
* fidélité ;
* position ;
* fonctionnement apparent ;
* absence de fusion ;
* cohérence d’une image à l’autre.

---

# 24. Contrôle des produits

Lorsqu’un produit réel est présenté, vérifier :

* nom ;
* design ;
* couleur ;
* dimensions ;
* interface ;
* fonctions montrées ;
* marque ;
* logo ;
* message ;
* disponibilité ;
* prix si affiché ;
* conditions de l’offre.

Aucune caractéristique ne doit être inventée.

---

# 25. Contrôle des marques

Les éléments de marque doivent être conformes à :

```text
06_BRAND.md
23_BRAND_MEMORY.md
```

Vérifier :

* logo ;
* couleurs ;
* ton ;
* nom ;
* slogan ;
* positionnement ;
* règles d’usage ;
* partenaires ;
* mentions légales.

Un logo déformé ou approximatif doit être corrigé en postproduction.

---

# 26. Contrôle du texte visible

Tout texte visible doit être contrôlé.

Il faut vérifier :

* orthographe ;
* grammaire ;
* typographie ;
* chiffres ;
* prix ;
* dates ;
* noms ;
* URL ;
* marque ;
* lisibilité ;
* contraste ;
* alignement.

Le texte généré automatiquement dans une image ne doit pas être considéré comme fiable.

---

# 27. Contrôle technique des images

Une image doit être vérifiée pour :

* dimensions ;
* résolution ;
* ratio ;
* format ;
* profil colorimétrique ;
* transparence ;
* compression ;
* netteté ;
* bruit ;
* halo ;
* artefacts ;
* détourage ;
* poids du fichier ;
* nom du fichier.

---

# 28. Contrôle technique des vidéos

Une vidéo doit être vérifiée pour :

* résolution ;
* ratio ;
* durée ;
* codec ;
* fréquence d’images ;
* débit ;
* audio ;
* synchronisation ;
* fluidité ;
* stabilité ;
* compression ;
* artefacts ;
* début ;
* fin ;
* transitions ;
* boucle si nécessaire.

---

# 29. Contrôle technique de l’audio

Un fichier audio doit être vérifié pour :

* format ;
* fréquence d’échantillonnage ;
* volume ;
* saturation ;
* souffle ;
* coupures ;
* silences ;
* bruit de fond ;
* dynamique ;
* clarté ;
* durée ;
* synchronisation.

---

# 30. Contrôle des formats sociaux

Chaque plateforme impose ses propres contraintes.

Le contrôle doit confirmer :

* ratio ;
* durée ;
* taille ;
* safe zones ;
* lisibilité mobile ;
* sous-titres ;
* miniature ;
* audio ;
* texte ;
* appel à l’action ;
* absence de contenu coupé.

La version approuvée pour une plateforme ne l’est pas automatiquement pour une autre.

---

# 31. Contrôle des sous-titres

Les sous-titres doivent être :

* exacts ;
* synchronisés ;
* lisibles ;
* correctement découpés ;
* suffisamment contrastés ;
* placés dans une zone sûre ;
* cohérents avec la langue ;
* exempts de faute.

Ils ne doivent pas masquer :

* le visage ;
* le produit ;
* un élément essentiel ;
* un bouton d’interface.

---

# 32. Contrôle légal

Le contrôle légal doit vérifier :

* droits des assets ;
* licences ;
* marques ;
* voix ;
* musique ;
* données personnelles ;
* droit à l’image ;
* transparence IA ;
* allégations ;
* réglementation publicitaire ;
* mentions obligatoires ;
* restrictions de plateforme.

Une incertitude juridique importante empêche l’approbation.

---

# 33. Contrôle éthique

Le contrôle doit également détecter :

* confusion avec une personne réelle ;
* manipulation trompeuse ;
* représentation humiliante ;
* stéréotype ;
* discrimination ;
* contenu déplacé ;
* exploitation d’une vulnérabilité ;
* faux témoignage ;
* faux avis ;
* fausse preuve sociale.

---

# 34. Contrôle de la destination

Un contenu doit être validé pour un usage précis.

Exemples :

```text
internal
prototype
social
advertising
website
application
presentation
training
commercial
press
```

Une approbation interne ne vaut pas approbation publique.

---

# 35. Niveaux d’approbation

Les niveaux recommandés sont :

```text
internal-approved
production-approved
public-approved
commercial-approved
master-approved
```

## Internal Approved

Usage interne uniquement.

## Production Approved

Peut être intégré dans une production.

## Public Approved

Peut être publié.

## Commercial Approved

Peut être utilisé dans un contexte commercial.

## Master Approved

Peut devenir une référence officielle.

---

# 36. Score global

Une grille standard peut être utilisée.

```text
Identité                  /25
Apparence                 /10
Anatomie                  /10
Comportement              /10
Contexte                  /10
Exactitude                /10
Qualité technique         /10
Marque                    /5
Légal                     /5
Traçabilité               /5
Total                    /100
```

---

# 37. Seuils

Seuils recommandés :

```text
95–100  → master-approved
90–94   → approved
80–89   → review
60–79   → correction nécessaire
0–59    → rejected
```

Ces seuils ne remplacent pas les motifs de rejet automatique.

---

# 38. Rejet automatique

Un contenu doit être rejeté immédiatement en cas de :

* violation du Character Lock ;
* identité non reconnaissable ;
* ressemblance problématique avec une personne réelle ;
* asset non autorisé ;
* membre supplémentaire ;
* main gravement déformée ;
* faux produit ;
* fausse allégation ;
* logo trompeur ;
* contenu illégal ;
* donnée personnelle non autorisée ;
* voix usurpée ;
* texte dangereux ;
* contenu publié sans droits ;
* défaut technique majeur ;
* absence de traçabilité pour un contenu officiel.

---

# 39. Défauts bloquants

Les défauts bloquants empêchent toute publication.

Exemples :

```text
identity-drift
legal-risk
wrong-product
wrong-brand
severe-anatomy-error
invalid-voice
false-claim
missing-rights
privacy-violation
corrupted-file
```

---

# 40. Défauts majeurs

Les défauts majeurs nécessitent une correction avant validation.

Exemples :

```text
visible-hand-error
camera-inconsistency
poor-lip-sync
incorrect-outfit
incorrect-logo
bad-subtitles
scene-inconsistency
audio-distortion
motion-artifact
```

---

# 41. Défauts mineurs

Les défauts mineurs peuvent être corrigés sans nouvelle génération complète.

Exemples :

```text
small-crop-adjustment
minor-color-correction
subtitle-spacing
filename
metadata
compression
small-background-cleanup
```

---

# 42. Catégorisation des erreurs

Les erreurs doivent être enregistrées avec un code.

Format recommandé :

```text
QA-<CATEGORY>-<NUMBER>
```

Exemples :

```text
QA-ID-001
QA-ANATOMY-003
QA-VOICE-002
QA-LEGAL-001
QA-VIDEO-006
QA-BRAND-004
```

---

# 43. Fiche d’erreur

Une erreur documentée doit contenir :

```text
error_id
category
severity
description
file
character_id
sdk_version
provider
model
prompt_id
date
detected_by
status
corrective_action
resolution
```

---

# 44. Gestion des corrections

Une correction doit suivre ce processus :

```text
1. Identifier le défaut
2. Classer sa sévérité
3. Déterminer sa cause
4. Choisir la correction
5. Produire une nouvelle version
6. Contrôler la nouvelle version
7. Comparer
8. Valider ou rejeter
9. Documenter
```

---

# 45. Une correction à la fois

Lors de l’optimisation d’une génération, il est recommandé de modifier un nombre limité de paramètres.

Cela permet de déterminer :

* ce qui a amélioré le résultat ;
* ce qui a provoqué une régression ;
* ce qui doit être conservé ;
* ce qui doit être annulé.

---

# 46. Non-régression

Toute nouvelle version d’un prompt, d’un modèle ou d’un workflow doit être testée contre des cas de référence.

Le test doit vérifier que les éléments précédemment conformes le restent.

Cas de référence recommandés :

```text
portrait neutre
portrait sourire
plein pied
fond vert
marche
présentation produit
dialogue face caméra
format vertical social
```

---

# 47. Jeu de référence

Chaque personnage doit progressivement disposer d’un jeu de référence validé.

Il peut contenir :

* portraits ;
* profils ;
* plein pied ;
* expressions ;
* poses ;
* looks ;
* vidéos courtes ;
* voix ;
* dialogues ;
* scènes produit.

Ce jeu sert aux tests de non-régression.

---

# 48. Comparaison

Une nouvelle production doit pouvoir être comparée avec :

* les assets maîtres ;
* la dernière version approuvée ;
* le résultat attendu ;
* les standards ;
* les versions précédentes.

La comparaison doit identifier les différences significatives.

---

# 49. Répétabilité

Un résultat isolé ne suffit pas à valider un workflow.

Il faut évaluer :

* la stabilité du visage ;
* la stabilité du corps ;
* la stabilité des tenues ;
* la stabilité de la voix ;
* la stabilité des mouvements ;
* la fréquence des erreurs ;
* la facilité de correction.

---

# 50. Taux de réussite

Chaque workflow peut suivre un taux de réussite.

Exemple :

```text
nombre de générations approuvées
÷
nombre total de générations
× 100
```

Seuils indicatifs :

```text
90 % et plus  → excellent
75–89 %       → exploitable
50–74 %       → instable
moins de 50 % → workflow à revoir
```

---

# 51. Métriques recommandées

Les métriques peuvent inclure :

```text
approval_rate
rejection_rate
identity_failure_rate
anatomy_failure_rate
average_quality_score
average_generation_cost
average_correction_count
average_processing_time
provider_success_rate
prompt_success_rate
```

---

# 52. Coût qualité

La qualité doit être évaluée avec le coût réel.

Le coût comprend :

* génération ;
* régénération ;
* retouche ;
* contrôle ;
* validation ;
* stockage ;
* temps humain ;
* coût fournisseur ;
* échec de publication.

Un workflow moins cher mais très instable peut coûter plus cher au final.

---

# 53. Validation humaine

La validation humaine doit être attribuée à une personne identifiable.

Elle doit enregistrer :

* nom ou identifiant ;
* date ;
* niveau d’approbation ;
* commentaire ;
* réserves ;
* destination autorisée.

---

# 54. Principe des quatre yeux

Pour les contenus à fort enjeu, une double validation peut être requise.

Exemples :

* publicité payante ;
* partenariat ;
* usage presse ;
* message juridique ;
* lancement produit ;
* déclaration publique ;
* contenu sensible.

---

# 55. Validation par lot

Lorsqu’une série est produite, le contrôle doit porter sur :

* chaque fichier ;
* la cohérence globale ;
* la continuité ;
* les différences involontaires ;
* le nommage ;
* l’ordre ;
* la version ;
* la destination.

Un lot ne doit pas être approuvé sur la seule base d’un échantillon lorsque les variations sont importantes.

---

# 56. Métadonnées qualité

Chaque production officielle doit pouvoir enregistrer :

```text
asset_id
character_id
sdk_version
prompt_id
prompt_version
provider
model
generation_date
quality_score
status
validation_level
validator
validation_date
errors
corrective_actions
destination
license_status
```

---

# 57. Nommage des versions

Une correction ne doit pas écraser silencieusement la version précédente.

Format recommandé :

```text
<asset-name>_v001
<asset-name>_v002
<asset-name>_v003
```

Ou :

```text
<asset-name>_1.0.0
```

La méthode choisie doit rester cohérente.

---

# 58. Archivage des rejets

Les contenus rejetés peuvent être conservés pour analyse.

Ils doivent être clairement séparés des assets validés.

Un contenu rejeté ne doit jamais être utilisé comme référence.

Il peut servir à :

* documenter une erreur ;
* entraîner un contrôle ;
* comparer un fournisseur ;
* améliorer un prompt ;
* identifier une régression.

---

# 59. Gestion des masters

Un master est un contenu de référence officielle.

Il doit être :

* stable ;
* validé ;
* sauvegardé ;
* versionné ;
* documenté ;
* protégé contre l’écrasement ;
* relié au Character Lock.

Toute modification d’un master nécessite une validation explicite.

---

# 60. Fournisseurs

Chaque fournisseur doit être évalué séparément.

Critères possibles :

```text
identity_consistency
image_quality
video_quality
motion_quality
voice_quality
prompt_adherence
failure_rate
cost
speed
resolution
rights
reliability
```

Un fournisseur performant pour une tâche peut être mauvais pour une autre.

---

# 61. Qualification d’un modèle

Avant usage régulier, un modèle doit être testé sur :

* portrait ;
* plein pied ;
* mains ;
* tenue ;
* objet ;
* mouvement ;
* regard ;
* expression ;
* format vertical ;
* format horizontal ;
* stabilité entre générations.

---

# 62. Changement de modèle

Lorsqu’un fournisseur met à jour un modèle, il faut considérer qu’une régression est possible.

Le changement doit déclencher :

```text
test de non-régression
→ comparaison
→ documentation
→ validation
```

La même appellation commerciale ne garantit pas le même comportement.

---

# 63. Compatibilité avec AI Command Center OS

AI Command Center OS doit pouvoir :

* récupérer le brief ;
* vérifier les entrées ;
* charger les standards ;
* contrôler les variables ;
* lancer la génération ;
* exécuter les contrôles automatiques ;
* produire un score ;
* détecter les erreurs ;
* proposer une correction ;
* demander une validation humaine ;
* attribuer un statut ;
* archiver le résultat ;
* suivre les métriques.

Le système doit bloquer la publication si le statut n’est pas compatible avec la destination.

---

# 64. Automatisation

Les tâches suivantes peuvent être automatisées :

* vérification de dimensions ;
* vérification de durée ;
* contrôle du format ;
* validation du schéma ;
* vérification des métadonnées ;
* détection de fichiers manquants ;
* comparaison de noms ;
* détection de duplications ;
* contrôle de variables ;
* génération d’un rapport.

Les décisions liées à l’identité, à la marque ou au droit doivent rester sous contrôle humain.

---

# 65. Rapport qualité

Un rapport qualité doit pouvoir contenir :

```text
Résumé
Score
Statut
Identité
Apparence
Anatomie
Technique
Marque
Légal
Erreurs détectées
Corrections recommandées
Décision
Validateur
Date
```

---

# 66. Checklist image

```text
[ ] Identité fidèle
[ ] Visage reconnaissable
[ ] Âge apparent correct
[ ] Cheveux corrects
[ ] Morphologie correcte
[ ] Mains correctes
[ ] Pieds corrects
[ ] Tenue correcte
[ ] Expression correcte
[ ] Regard correct
[ ] Objet correct
[ ] Décor cohérent
[ ] Éclairage correct
[ ] Format correct
[ ] Résolution correcte
[ ] Pas de texte erroné
[ ] Droits vérifiés
[ ] Métadonnées présentes
[ ] Validation humaine
```

---

# 67. Checklist vidéo

```text
[ ] Identité stable
[ ] Visage stable
[ ] Corps stable
[ ] Mouvement naturel
[ ] Mains cohérentes
[ ] Regard cohérent
[ ] Expression cohérente
[ ] Synchronisation labiale
[ ] Voix conforme
[ ] Caméra conforme
[ ] Décor stable
[ ] Objets stables
[ ] Durée correcte
[ ] Format correct
[ ] Audio correct
[ ] Sous-titres corrects
[ ] Pas d’artefact majeur
[ ] Droits vérifiés
[ ] Métadonnées présentes
[ ] Validation humaine
```

---

# 68. Checklist texte et social

```text
[ ] Informations exactes
[ ] Ton du personnage respecté
[ ] Ton de marque respecté
[ ] Aucune promesse non autorisée
[ ] Aucun prix inventé
[ ] Aucun partenariat inventé
[ ] Orthographe correcte
[ ] Appel à l’action correct
[ ] Format plateforme respecté
[ ] Mentions légales présentes
[ ] Validation humaine
```

---

# 69. Critères minimaux d’approbation

Un contenu ne peut être classé `approved` que si :

```text
identité conforme
ET Character Lock respecté
ET aucune erreur bloquante
ET exactitude suffisante
ET qualité technique suffisante
ET droits validés
ET destination définie
ET métadonnées présentes
ET validation humaine effectuée
```

---

# 70. Interdictions

Il est interdit de :

* approuver un contenu non contrôlé ;
* approuver une identité incorrecte ;
* ignorer une erreur légale ;
* utiliser un asset rejeté comme référence ;
* modifier le score pour forcer une validation ;
* publier un contenu `draft` ;
* écraser un master ;
* supprimer la traçabilité ;
* cacher un défaut connu ;
* valider une allégation non vérifiée ;
* confondre qualité esthétique et conformité ;
* utiliser un contenu hors de sa destination approuvée.

---

# 71. Règle finale

La qualité du Virtual Humans SDK repose sur une validation disciplinée.

Un contenu officiel doit être :

```text
fidèle
cohérent
exact
techniquement propre
juridiquement utilisable
traçable
validé
```

Lorsqu’un doute subsiste, le contenu reste en statut :

```text
review
```

La publication n’est jamais prioritaire sur la cohérence et la sécurité du personnage.
