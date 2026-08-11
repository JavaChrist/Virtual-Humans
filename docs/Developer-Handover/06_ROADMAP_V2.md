# 06 — Roadmap V2

**Classe :** `CURRENT` (carte théorique + phases réellement exécutées)

## Principe

Chaque phase produit un incrément déployable derrière un feature flag. Une phase ne commence que lorsque ses dépendances et critères de sortie sont satisfaits.

## Roadmap théorique (pack initial)

| Phase | Résultat | Dépend de | Critère de sortie |
|---:|---|---|---|
| 0 | audit et baseline | — | écarts et risques validés |
| 1 | sécurité/observabilité | 0 | RLS, secrets, corrélation, alertes |
| 2 | objets métier et schemas | 0 | contrats versionnés testés |
| 3 | workflow `/director` minimal | 2 | reprise et autosave |
| 4 | Marketing + Creative | 2 | sorties déterministes validées |
| 5 | Script + Art | 4 | durée et cohérence visuelle |
| 6 | Storyboard + Prompt | 5 | packages de scène complets |
| 7 | Capability Registry + Router | 6 | plans expliqués et budgétés |
| 8 | Generation Engine adapters | 1,7 | dry-run et contrats providers |
| 9 | Production Director | 8 | reprise, fallback, annulation |
| 10 | merge, validation, export | 9 | export traçable |
| 11 | persistance Supabase complète | 3–10 | RLS et migrations vérifiés |
| 12 | E2E, charge, accessibilité | 11 | gates de release au vert |
| 13 | pilote puis généralisation | 12 | SLO et budget observés |

> Cette grille reste utile comme **décomposition de capacités**.
> Le déroulé réel (ci-dessous) a regroupé et renuméroté les travaux.

## Phases réellement exécutées (ops)

| Phase réelle | Résultat | Preuve |
|---|---|---|
| 0–8 | Pipeline `/director` local fakes Brief→Export | `CURRENT_CODEBASE_AUDIT`, E2E Phase 8 |
| 9 | Audit final local fakes | `20_FINAL_AUDIT.md` (**snapshot**) |
| Porte 1 / VHS-127 | Storage durable local ; 17→ puis **29** mig. | plan Supabase + `21_` |
| 10A–10AD | Préflight distant, env safety, kill switches, DB locale | `23`–`26` |
| 10B | Marketing texte réel PASS | `27_` · `marketing-analyzer-v2` |
| 10C | Creative texte réel PASS | `29_` · `creative-analyzer-v5` |
| 10D | Script texte réel PASS | `31_`–`32_` · `script-analyzer-v1` |
| 10E | Art texte PASS (`art-analyzer-v3`) | `37_` |
| 10F-V4 | Storyboard texte PASS (`storyboard-analyzer-v4`) | `57_` |
| 11A | Prep smoke média image — **DECISION_REQUIRED** | `58_` |
| MT-Arch | Architecture Motion / Performance Transfer | `59_` · `ARCHITECTURE_READY_FOR_IMPLEMENTATION` |
| MT-001…010 | Domain → … → Motion QC → Human Review | **IMPLEMENTED** (`60_`…`70_`) · Gates MT-1…MT-8 **PASS** · next = **MT-011/012** |
| MT-011… | Observability → dry-run → benchmark | **NOT STARTED** · Production MT candidates = 0 · remote migration MT-005 **NOT APPLIED** · **0** provider calls · real QC measurement adapters = 0 |

**Pas encore :** media jobs Production réels ; runtime `video.motion_transfer` exécutable ; benchmark MV-001 payant ; restore backup prouvé ; delta migration distant sans Auth.

Pilotage courant : **`BACKLOG_V2.md`**.
Chantier majeur avant clôture app : **Motion Transfer** (`59_`) — distinct du smoke image 11A.

## Priorités

P0 : sécurité, contrats, budget, idempotence et récupération.
P1 : parcours complet, qualité du routage, observabilité et UX d'erreur ; **backup restore** ; **décision média**.
P2 : stratégies supplémentaires, analytics et optimisation ; rétention auto (VHS-206).
P3 : apprentissage et automatisations futures.

## Stratégie de livraison

Activer successivement : équipe interne, projets de test, petit groupe pilote, puis tous les utilisateurs. Conserver un kill switch pour la production payante et la possibilité de revenir aux studios avancés. Runtime AI Production : **OFF** hors smokes autorisés.
