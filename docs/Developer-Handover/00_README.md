# Virtual Humans Studio — Developer Handover Pack V2

**Version :** 2.0  
**Architecture :** V2 Frozen  
**Date :** août 2026  
**Statut :** source de vérité technique

## Mission

Virtual Humans Studio est un Assistant Réalisateur IA. À partir d'un brief simple, il construit une stratégie, un concept, un script, une direction visuelle, un storyboard, des packages de scène, un plan de génération, puis pilote la production, le montage et l'export.

L'utilisateur ne choisit ni fournisseur, ni modèle, ni syntaxe de prompt. Les studios historiques restent disponibles comme outils avancés.

## Pipeline immuable

```text
Utilisateur → AI Video Director (/director)
→ Marketing Director → MarketingPlan
→ Creative Director → CreativeConcept
→ Script Writer → VideoScript
→ Art Director → VisualDirection
→ Storyboard Director → StoryboardProject
→ Prompt Director → ScenePackage[]
→ Model Router → GenerationPlan
→ Production Director → ProductionResult
→ Generation Engine → Providers
→ Merge → Export
```

`AI Video Director` est le nom de l'expérience et de l'orchestrateur de workflow, pas un Directeur métier et pas un fichier supplémentaire.

## Règles cardinales

1. Un module possède une responsabilité unique.
2. Les Directeurs ne s'appellent jamais entre eux ; le workflow transmet des objets métier immuables et versionnés.
3. Toute frontière valide les données avec Zod et conserve le type TypeScript correspondant.
4. Les Directeurs ignorent les API ; les providers ignorent le métier.
5. Le Model Router choisit une stratégie de production, pas seulement un modèle.
6. Le Production Director est le seul orchestrateur d'exécution.
7. Une scène est indépendante, reprenable et régénérable.
8. Tout appel payant est précédé d'une estimation et possède un mode dry-run.
9. L'application manipule `Character`, jamais des personnages codés en dur.
10. Les secrets restent côté serveur et ne sont jamais journalisés.

## Lecture recommandée

- Fondation : `01` à `06`.
- Contrats métier : `07` à `15`.
- Interface, données, qualité et opérations : `16` à `20`.
- Incident historique migrations Production : `21_VHS_125_REMOTE_MIGRATION_INCIDENT.md`.
- Pilotage : `BACKLOG_V2.md`, `CHECKLIST_RELEASE.md`, `CHANGELOG.md`.
- Vocabulaire normatif : `GLOSSARY.md`.

## Autorité documentaire

En cas de contradiction, l'ordre d'autorité est : ce README, `02_ARCHITECTURE.md`, le document du composant concerné, puis les exemples. Toute modification du pipeline exige une nouvelle version d'architecture ; une évolution compatible ajoute un adaptateur ou un champ optionnel versionné.

## Definition of Done globale

- contrats validés et persistables ;
- tests unitaires, intégration et E2E pertinents au vert ;
- aucun appel fournisseur depuis React ou un Directeur ;
- observabilité, coûts, erreurs et reprises vérifiés ;
- migration et rollback documentés ;
- documentation et changelog mis à jour.

