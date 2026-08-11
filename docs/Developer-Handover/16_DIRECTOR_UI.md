# 16 — Interface AI Video Director

**Classe :** `CURRENT`

### État opérationnel (11 août 2026)

| | |
|---|---|
| Live sous flags | Brief → Storyboard (texte réel validé) ; suite Production/Export = fakes locaux |
| E2E | Playwright fake mode Phase 8–9 |
| Aspirational | revue production média réelle, export réel multi-provider |

## Rôle

`/director` est le parcours visible qui pilote le workflow applicatif. Il présente et fait approuver les objets métier ; il ne contient aucune logique des Directeurs et n'expose pas les providers dans le parcours standard.

## Étapes

1. **Brief** — saisie progressive, médias, personnage et validation.
2. **Strategy** — cible, bénéfice, hook, CTA et hypothèses.
3. **Concept & Script** — concept, texte, timing, corrections locales.
4. **Visual & Storyboard** — cartes de scène, ordre, durée, références.
5. **Production review** — qualité/coût/délai estimés, approbation explicite.
6. **Production** — progression projet/scènes/étapes, pause et annulation.
7. **Review & Export** — prévisualisation, régénération locale, export.
8. **Motion Review** (MT-010) — panneau `MotionReviewSection` sous livraison : QC Motion layers/issues/checkpoints/evidence + décisions append-only (`/api/director/projects/…/motion/review`) ; retry = intention seule ; `useConfirm` uniquement.

## Architecture UI

Server Components pour lecture initiale et autorisation ; Client Components pour interaction ; commandes serveur/API pour mutations ; cache de requête pour projections ; état local uniquement pour brouillons éphémères. Les composants reçoivent des view models, jamais les réponses brutes d'un provider.

## URLs recommandées

`/director`, `/director/new`, `/director/[projectId]`, puis `?step=brief|strategy|script|storyboard|production|review`. Une URL copiée restaure la bonne étape si l'utilisateur y est autorisé.

## États obligatoires

Loading avec contenu stable, empty state utile, validation champ par champ, erreur récupérable, conflit de révision, offline/reconnexion, job en attente, plafond budgétaire et projet partiel.

## Autosave et concurrence

Sauvegarde debounce des brouillons avec `revision`; mise à jour optimiste seulement pour actions réversibles. Un conflit affiche les deux révisions et ne remplace jamais silencieusement le travail utilisateur.

## Accessibilité

Navigation clavier complète, focus visible, titres structurés, labels explicites, annonces live non envahissantes, contraste AA, sous-titres/transcriptions, absence de dépendance à la couleur et respect de `prefers-reduced-motion`.

## Analytics

Événements sans contenu sensible : étape ouverte/validée, correction demandée, approbation, production lancée/annulée, scène régénérée, export. Aucun prompt, script ou URL signée dans les propriétés.

## Tests E2E

Happy path, retour à une étape, autosave, refresh, conflit, validation, refus du budget, annulation, échec partiel, régénération d'une scène, navigation clavier et session non autorisée.

