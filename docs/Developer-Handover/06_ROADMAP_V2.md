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
| MT-001…012 | Domain → … → Observability → Full synthetic E2E | **IMPLEMENTED** (`60_`…`72_`) · Gates MT-1…MT-012 **PASS** |
| MT-013A | MV-001 governance & readiness audit | **DONE** (`73_`) · verdict `READY_FOR_HUMAN_GOVERNANCE_DECISIONS` · **0** provider calls |
| MT-013B | Restore drill + privacy due diligence | **DONE** (`74_`) · restore `BLOCKED_TARGET_REQUIRED` · privacy `READY_FOR_HUMAN_DECISION` |
| MT-013C | Isolated restore target | **STOP** (`75_`) · coût ≠ 0 · pas de restore backup via MCP |
| MT-013C-PAID | Paid isolated project restore | **STOP** (`76_`) · restore backup non dispo via MCP · clone Dashboard requis |
| MT-013C-QUOTE | Dashboard quote preflight | **QUOTE_CAPTURED** (`77_`) · $10.18/mois |
| MT-013C-PASS | Restore drill verification | **PASS** (`78_`) · P1 restore fermé |
| MT-013C-DEL | Delete isolated target | **VERIFIED** (`80_`) · `qmsh…` absent · Production healthy |
| MT-013D | Privacy Decision Pack MV-001 | **ACCEPTED_LIMITED** (`81_`) · exp 2026-09-10 · pas d’exécution |
| MT-005-APPLY | Remote apply human_review extend | **PASS** (`82_`) · Production 30/30 · Motion runtime UNAVAILABLE |
| MT-013E | MV-001 budget hard limit | **DONE** (`83_`) · hard 174 · available 62¢ · pas de réservation |
| MT-013F… | Benchmark Auth contrôlé (exécution) | **NOT STARTED** · **PAID NOT AUTHORIZED** |

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
