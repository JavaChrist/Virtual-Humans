# FUTURE VIDEO MODELS

Version : 1.0  
Statut : Officiel  
Portée : Intégration de nouveaux moteurs vidéo

---

# 1. OBJECTIF

Ce document décrit la procédure d’intégration d’un nouveau moteur vidéo dans le SDK de Mei.

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

Un nouveau fournisseur ne doit pas nécessiter de modifier l’identité ou la mémoire permanente de Mei.

---

# 2. PRINCIPE

L’intégration d’un moteur est un adaptateur.

```text
Virtual Human SDK
        ↓
Règles permanentes de Mei
        ↓
Adaptateur du fournisseur
        ↓
Moteur vidéo
```

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

Mei tient un smartphone.

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

Dans ce cas, le moteur ne doit pas devenir le moteur principal de Mei.

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
## Mode recommandé pour Mei
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

Ne jamais placer dans la mémoire permanente de Mei :

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

Les références officielles de Mei doivent être :

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

Un nouveau moteur doit s’adapter au SDK de Mei.

Le SDK de Mei ne doit jamais être déformé pour s’adapter aux limites d’un moteur.
