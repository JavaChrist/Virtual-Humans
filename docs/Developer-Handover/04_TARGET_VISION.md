# 04 — Vision cible

**Classe :** `FUTURE_DESIGN`

> Vision produit / UX / NFR — **pas** un snapshot d’état livré.
> État validé : cinq Directeurs texte PASS ; export/média réel `/director` non prouvés.
> Voir `00_README.md` et `BACKLOG_V2.md` pour le checkpoint ops.

## Expérience standard

1. L'utilisateur crée un projet et remplit un brief minimal.
2. Le Studio analyse le besoin et affiche les décisions dans un langage non technique.
3. L'utilisateur peut approuver ou corriger stratégie, concept, script et storyboard.
4. Le système estime coût et délai, puis demande l'approbation de production.
5. La production progresse scène par scène avec reprise possible.
6. L'utilisateur prévisualise, régénère une scène si nécessaire et exporte.

## Brief minimal

Produit/service, objectif, plateforme, personnage, durée, ton, langue et médias optionnels. Les champs avancés restent accessibles sans devenir obligatoires.

## Principes UX

- montrer les intentions et résultats, jamais la plomberie fournisseur ;
- sauvegarder à chaque étape ;
- expliquer les décisions du Router sans exposer les secrets internes ;
- rendre les coûts visibles avant engagement ;
- permettre une correction locale sans recommencer ;
- fournir un état honnête : attente, production, validation, erreur récupérable.

## Capacités V2

- formats 15, 20, 30 et 60 secondes ;
- Instagram, TikTok, LinkedIn, Facebook et YouTube Shorts ;
- dialogue, voice-over, sans voix, produit, carrousel, tutoriel et talking head ;
- personnages chargés via Runtime SDK ;
- références produit, marque, décor, voix et captures ;
- export reproductible avec manifeste de provenance.

## Qualités non fonctionnelles

- résilience par reprise et fallback borné ;
- extensibilité par registres de capacités et adaptateurs ;
- sécurité par défaut et séparation locataire ;
- traçabilité de toute décision et dépense ;
- accessibilité WCAG 2.2 AA sur le parcours principal ;
- observabilité corrélée projet/scène/étape.

## Évolutions compatibles

Nouveaux providers, modèles, composers, stratégies, formats, langues et personnages s'ajoutent derrière les contrats existants. L'apprentissage futur du Router propose des poids de scoring ; il ne modifie ni les responsabilités ni l'approbation budgétaire.

