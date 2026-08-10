# Backlog V2

Ce backlog est initial et doit être recalibré après `03_CURRENT_AUDIT.md`. Les identifiants sont stables ; chaque item exige critères d'acceptation, tests et documentation.

## P0 — fondations

- **VHS-001** ✅ Auditer dépôt, schéma et flux actuels. *(voir `CURRENT_CODEBASE_AUDIT.md`)*
- **VHS-002** ✅ Authentification fail-closed — Phase 7 + E2E Phase 8 ; checkpoint Phase 9 (unitaires 785).
- **VHS-003** ✅ Types/schemas communs et métadonnées d'artifact.
- **VHS-004** ✅ Révisions, états et optimistic locking (domaine + persistance V2).
- **VHS-005** 🟡 Corrélation, logs redacted, métriques et traces. *(Phase 9 : redaction data URL renforcée ; restent métriques/traces distribuées)*
- **VHS-006** 🟡 Ledger, estimation, réservation et plafond dur. *(ledger V2 + budget `/director` ; routes generate historiques + rapprochement coûts réels restent ouverts)*

## P1 — parcours métier

- **VHS-101…VHS-112** ✅ Pipeline `/director` local Brief → … → Export (fakes) — Phases 1–8 ; flags AI/paid off ; providers réels non validés.
- **VHS-111B** ✅ Helper fal compose historique — **sans** basculer `/director`.
- **VHS-111C** ✅ Pipeline AICCOS extractible — stub `/director` ; envoi réel off.
- **VHS-113** ✅ Persistance Supabase V2 additive locale — **sans** apply distant. *(voir `SUPABASE_V2_MIGRATION_PLAN.md`)*
- **VHS-114** ✅ Worker borné `run-once` — secret + flags off ; **sans** cron.
- **VHS-115** ✅ Validation locale migrations — Porte 1 : 17 mig. ; pgTAP 286 ; intégration 31 ; **2 cycles** verts.
- **VHS-116…VHS-126** ✅ Brief → Marketing → … → stale cascade — livrés localement ; flags off.
- **VHS-127** ✅ Stockage durable médias finaux — bucket privé `director-final-assets` + `AssetContentPort` Supabase Storage ; mémoire impossible en Production ; **apply distant non effectué**.
- **VHS-117C** ✅ Smoke Marketing OpenAI réel — Phase 10B PASS : 1 appel `gpt-5.6`, plan Zod valide, ledger 24¢ réservés / 4¢ consommés / 20¢ libérés, replay idempotent sans second appel ; runtime AI refermé OFF.
- **Phase 9** ✅ Audit final + gate fake-delivery + docs + 2 cycles complets locaux — **pas** production distante.
- **Phases 10A–10B** ✅ Préflight distant, isolation environnement, validation DB locale et premier smoke Marketing réel terminés ; migrations **29/29**, pgTAP **378**, intégration **33**, unitaires **1016** ; **0 média**.
- **P1 opérations distantes** ⚠️ `BACKUP_PRESENT_RESTORE_UNPROVEN` — ne bloquait pas le smoke texte borné ; reste bloquant avant opération distante invasive.
- **Phase 10C-PREP** ✅ Préparation Creative sans provider : MarketingPlan 10B réutilisable, dry-run estimate 12¢ / plafond 100¢.
- **VHS-118C / Phase 10C** ✅ Smoke Creative OpenAI réel : 1 appel `gpt-5.6`, concept Zod valide, ledger 12¢/5¢/7¢, replay idempotent, flags OFF.
- **Phase 10D-PREP** ✅ Préparation Script sans provider : Marketing+Creative réutilisés, dry-run estimate 7¢ / plafond 100¢ ; **aucune** exécution Script réelle.
- **Phase 10D** ✅ Smoke Script OpenAI réel (réauth) : 1 appel `gpt-5.6`, VideoScript Zod valide, ledger 12¢/3¢/9¢, replay idempotent, flags OFF (`31_PHASE_10D_FIRST_REAL_SCRIPT_SMOKE.md`).
- **Phase 10D-RECONCILE** ✅ Canon Script = Production : `gpt-5.6` / `medium` / `4096` / **12¢** ; PREP corrigé (`32_PHASE_10D_SCRIPT_CONFIG_RECONCILIATION.md`).
- **Phase 10E-PREP** ✅ Préparation Art texte sans provider/média : amont Marketing+Creative+Script réutilisés, dry-run estimate 13¢ / plafond 100¢ ; **aucune** exécution Art réelle (`33_PHASE_10E_ART_TEXT_SMOKE_PREP.md`).
- **Phase 10E** ⚠️ Smoke Art texte réel **BLOCKED** : 1 appel `gpt-5.6`, dry-run live OK (13¢), candidat `invalid_candidate` (continuité lieu) — **0** VisualDirection ; ledger 13/12/1¢ ; flags OFF (`34_PHASE_10E_FIRST_REAL_ART_TEXT_SMOKE.md`).
- **Phase 10E-DIAG** ✅ Cause = prompt v2 insuffisant + candidat Zod-valide incohérent métier ; prompt **`art-analyzer-v3`** ; `/art/retry` incompatible (`invalid_candidate` non allowlisté + mismatch v2→v3) (`35_PHASE_10E_ART_INVALID_CANDIDATE_DIAG.md`).
- **Phase 10E-RETRY-PREP** ✅ Nouvel execute v3 préparé (clé ≠ v2, attempt 1, estimate 13¢, guards) ; **0** provider (`36_PHASE_10E_ART_V3_NEW_EXECUTE_PREP.md`).
- **Phase 10E-V3** ✅ Smoke Art texte réel PASS : 1 appel `gpt-5.6` / `art-analyzer-v3`, VisualDirection rev.1, ledger 13/12/1¢, replay idempotent, run v2 immuable, flags OFF (`37_PHASE_10E_ART_V3_NEW_EXECUTE.md`).
- **Phase 10F-PREP** ✅ Préparation Storyboard texte sans provider/média : amont Marketing+Creative+Script+VisualDirection réutilisés, dry-run estimate 13¢ / plafond 100¢, prompt `storyboard-analyzer-v2` ; **aucune** exécution Storyboard réelle (`38_PHASE_10F_STORYBOARD_TEXT_SMOKE_PREP.md`).
- **Phase 10F** ⚠️ Smoke Storyboard texte **BLOCKED** : dry-run live OK (13¢) ; `budget_exceeded` (hard limit 100 / restant 7) — **0** appel provider ; **0** storyboard_project ; flags OFF (`39_PHASE_10F_FIRST_REAL_STORYBOARD_TEXT_SMOKE.md`).
- **P1 budget** : `WORKSPACE_HARD_LIMIT_EXHAUSTED` (100¢, restant 7¢) — bloquant avant réauth Storyboard ; run terminal `b446a0ed-…` empêche reuse idempotence à l’identique.
- **Prochaine porte** : relever hard limit + réauth Storyboard (procédure identité) après autorisation ; média ensuite ; aucun push sans décision séparée.

## P2 — durcissement

- **VHS-201** 🟡 Matrice E2E multi-formats/plateformes. *(Phase 8–9 : harnais Playwright `/director` fake livré et validé ×2 cycles ; multi-formats restent à étendre.)*
- **VHS-202** Chaos tests providers et workers.
- **VHS-203** Dashboard coût, fiabilité et fallbacks.
- **VHS-204** Outils de support : replay sûr et inspection de manifest.
- **VHS-205** Baseline performance, SLO et alertes.
- **VHS-206** Rétention, export utilisateur et purge automatisée.

## P3 — après V2

- **VHS-301** Poids du Router proposés par données historiques.
- **VHS-302** Collaboration et rôles d'équipe avancés.
- **VHS-303** Publication sociale assistée.
- **VHS-304** Bibliothèque de styles et tendances gouvernées.

## Definition of Ready

Dépendances identifiées, maquette/contrat disponible, risque et données classifiés, métrique de succès définie, stratégie de test et rollback compris.
