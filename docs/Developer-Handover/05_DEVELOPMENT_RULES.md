# 05 — Règles de développement

**Classe :** `CURRENT`

> Toujours applicables (flags, dry-run, migrations immuables, secrets serveur).
> Kill switches et checklist ops : `19_DEPLOYMENT.md`, `CHECKLIST_RELEASE.md`.

## Avant de coder

- lire ce pack et les instructions du dépôt ;
- inspecter l'existant et rechercher les éléments réutilisables ;
- écrire le contrat et les critères d'acceptation ;
- définir migration, compatibilité et rollback ;
- identifier les appels payants et données sensibles.

## Architecture

- une responsabilité par module ;
- dépendances orientées vers le domaine ;
- aucun appel direct entre Directeurs ;
- aucun provider dans le domaine ;
- aucune logique métier dans React ;
- un seul moteur storyboard ;
- `Production Director` seul responsable de l'orchestration d'exécution.

## Données et types

- TypeScript strict, aucun `any` non justifié ;
- schéma Zod à chaque frontière ;
- unités explicites (`durationMs`, `costCents`, devise ISO) ;
- dates UTC ISO 8601 ;
- objets immuables, versionnés et sérialisables ;
- migrations forward et rollback testés.

## IA et prompts

- prompts construits par blocs structurés et composers versionnés ;
- sorties LLM validées, réparées au plus une fois, sinon erreur typée ;
- aucun contenu non fiable traité comme instruction système ;
- pas de secret, PII inutile ou URL privée dans les prompts ;
- modèle et température configurables hors code métier.

## Production

- estimation avant exécution ;
- idempotency key par étape ;
- timeout, retry borné, fallback maximum deux alternatives ;
- annulation coopérative ;
- journal de coût réel ;
- dry-run sans appel payant.

## Git et revue

- changements petits et cohérents ;
- pas de refactor sans rapport dans une feature ;
- ne jamais modifier une migration déjà déployée ;
- mise à jour des tests, documentation, changelog **et** `CURRENT_STATE_AND_RESUME.md` dans le même changement si l’état du projet change ;
- une phase n’est pas clôturée si elle change l’état du projet sans mettre à jour le living handover ;
- décisions structurantes consignées dans un ADR du dépôt.

## Definition of Done

Build, typecheck, lint et tests passent ; les erreurs sont observables ; la sécurité et l'accessibilité sont vérifiées ; aucun secret n'est commité ; l'acceptation métier est démontrée ; le rollback est possible.

