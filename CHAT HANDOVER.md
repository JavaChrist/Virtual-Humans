# VIRTUAL HUMANS SDK
## CHAT HANDOVER
### Version 1.0
### Date : 20/07/2026

---

# OBJECTIF DE CE FICHIER

Ce document permet de reprendre le développement du Virtual Humans SDK dans un nouveau Chat sans perdre le contexte.

Il ne décrit pas le SDK en détail.

Il explique où le projet en est, quelles décisions sont figées et quel est le prochain travail.

---

# ÉTAT ACTUEL DU PROJET

Le projet a dépassé la phase de réflexion.

L'architecture générale est désormais considérée comme stable.

Nous ne souhaitons plus modifier la structure.

L'objectif est maintenant de produire une documentation complète permettant à Cursor, Claude ou ChatGPT de reprendre le projet sans perdre le contexte.

---

# CE QUI EST TERMINÉ

## Architecture générale

Virtual Humans SDK

Core

Schema

Characters

Assets

Memory

Prompts

Templates

Videos

Architecture validée.

Aucune nouvelle restructuration ne doit être proposée.

---

## Mei SDK

Le personnage Mei constitue le personnage de référence.

Toute l'architecture est développée autour de Mei.

Les futurs personnages (Tom, Emma, Lucas...) utiliseront la même architecture.

---

## Memory System

La mémoire est terminée.

Documents réalisés :

00_IDENTITY

01_CHARACTER_MEMORY

02_PRODUCT_MEMORY

03_BRAND_MEMORY

04_MARKETING_MEMORY

05_SOCIAL_MEMORY

06_VIDEO_MEMORY

07_LANGUAGE_MEMORY

08_RELATIONSHIP_MEMORY

09_PROJECT_MEMORY

10_RUNTIME_MEMORY

README

Le système mémoire est considéré comme terminé.

---

## Prompt System

Le Prompt System est conçu.

Architecture figée :

system/

behavior/

templates/

README

Les premiers System Prompts sont rédigés.

---

## Behavior System

Le concept est validé.

Le Behavior Engine chargera dynamiquement plusieurs comportements.

Exemple :

Professional

+

Marketing

+

Presentation

Les Behavior Modules n'ont pas encore été développés.

---

## Templates

Le dossier Templates est créé.

Les templates de production sont présents mais encore vides.

Ils serviront à générer :

vidéo

image

marketing

documentation

social

sales

etc.

---

## Assets

Les assets de Mei sont pratiquement terminés.

Portraits

Expressions

Poses

Outfits

Identity

Videos

Structure validée.

---

# DÉCISION IMPORTANTE

Pendant ce Chat plusieurs problèmes sont apparus.

ChatGPT ne peut pas voir le dépôt Git.

Il ne connaît pas automatiquement les fichiers déjà créés.

Il peut donc proposer de recréer des documents existants.

Cette méthode fait perdre du temps.

Nouvelle règle :

Le dépôt Git constitue toujours la source de vérité.

On ne modifie plus l'architecture sans validation explicite.

---

# NOUVEL OBJECTIF

Nous ne voulons plus construire le SDK.

Nous voulons construire sa documentation.

Le but est que Cursor puisse reprendre seul le développement simplement en lisant quelques documents.

---

# PROCHAINE ÉTAPE

Créer un véritable Developer Handover Pack.

Ce pack remplacera le contexte perdu entre les chats.

---

# HANDOVER PACK

Ordre de rédaction :

00_PROJECT_CONTEXT.md

01_ARCHITECTURE.md

02_DEVELOPMENT_RULES.md

03_PROJECT_HISTORY.md

04_CURRENT_STATUS.md

05_ROADMAP.md

06_NEXT_TASKS.md

07_ARCHITECTURE_DECISIONS.md

08_GLOSSARY.md

README.md

---

# PRIORITÉ ABSOLUE

Commencer par :

00_PROJECT_CONTEXT.md

Ce document deviendra la source officielle de vérité du projet.

Tous les nouveaux Chats devront commencer par sa lecture.

---

# OBJECTIF DE 00_PROJECT_CONTEXT.md

Ce document devra expliquer :

la vision

la philosophie

l'architecture

les Engines

Memory

Prompts

Behavior

Templates

Assets

Workflow

Roadmap

Décisions figées

État actuel

Travaux restants

Il devra être suffisamment complet pour permettre à Cursor ou à une autre IA de reprendre le projet sans connaître l'historique des conversations.

---

# CONSIGNE POUR LE PROCHAIN CHAT

Ne plus proposer de nouvelle architecture.

Considérer que l'architecture est figée.

Produire uniquement la documentation officielle du projet.

La première tâche consiste à rédiger intégralement :

00_PROJECT_CONTEXT.md

avant tout autre développement.

Ce document devra être écrit comme si une nouvelle équipe de développement devait reprendre le projet sans avoir accès aux anciennes conversations.

Fin du document.