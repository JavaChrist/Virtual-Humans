# Virtual Humans Studio

## Présentation en une phrase
Studio web protégé par mot de passe pour produire des images, des voix et des vidéos à partir de personnages virtuels photoréalistes déjà définis dans le projet.

## Public visé
Les personnes de l’équipe qui ont le mot de passe partagé du studio et qui doivent créer du contenu fidèle à un personnage officiel (Mei, Tom). Ce n’est pas un service ouvert au grand public, ni un produit avec comptes individuels.

## Problème résolu
Garder l’identité d’un humain virtuel cohérente (visage, tenues, ton, prompts) tout en générant du média, sans que l’utilisateur ait à choisir le fournisseur technique ou à réécrire les consignes du personnage à chaque fois.

## Fonctionnalités principales
- Consulter les personnages officiels et leurs éléments d’identité (fiches, looks, expressions).
- Composer un prompt à partir des modèles du personnage, puis lancer une génération d’image, de voix ou de vidéo lorsque les clés correspondantes sont configurées.
- Suivre une dépense estimée avant et après chaque génération, avec un plafond optionnel.
- Rédiger un brief « Réalisateur IA » (brouillon local) pour préparer une vidéo, sans choisir de fournisseur.
- Se connecter une fois pour accéder à tout le studio ; les pages déjà visitées restent lisibles hors ligne.

## Statut
En développement / en test.

Le studio historique (image, voix, vidéo, lip-sync, storyboard, budget) est implémenté dans le code. Le parcours « Réalisateur IA » affiche l’interface et le brief, mais la sauvegarde serveur et les étapes automatiques (stratégie, production, export réel) restent fermées par défaut. L’accès exige un mot de passe et un secret de session valides. Ce n’est pas un produit commercial prêt à l’emploi.

## Adresse du site
https://virtual-humans.vercel.app

(Adresse d’alias documentée dans le projet. En local : http://localhost:3000 après `npm run dev` dans `studio/`. Disponibilité actuelle du site en ligne : à confirmer.)
