# Virtual Humans Studio — Developer Handover Pack V2

**Version :** 2.0
**Architecture :** V2 Frozen
**Date :** août 2026
**Rafraîchi :** 11 août 2026

## Qui fait autorité ?

| Besoin | Document |
|---|---|
| État opérationnel courant (portes, budget, flags, prochaine phase) | **`BACKLOG_V2.md`** + derniers rapports numérotés |
| Contrats d’architecture immuables | `02_ARCHITECTURE.md` + ce README |
| Schéma Supabase réel | **`17_SUPABASE_PROJECTS.md`** (pas les snapshots Phase 9) |
| Contrats métier Directors | `07`–`15` (section Ops = état prouvé) |
| Snapshot Phase 9 local fakes | `20_FINAL_AUDIT.md` (**historique**) |
| Historique d’incidents / smokes | rapports `21`–`58` (**ne pas réécrire**) |

En cas de contradiction factuelle d’état : **BACKLOG + rapport le plus récent** > snapshot historique.
En cas de contradiction d’architecture : ce README → `02_ARCHITECTURE` → document du composant.

---

## État courant (checkpoint)

```text
Dernier checkpoint texte : Phase 10F-V4-EXECUTE PASS (rapport 57)
Préparation média image  : Phase 11A DECISION_REQUIRED (rapport 58)
Motion / Performance     : ARCHITECTURE_READY · MT-001 IMPLEMENTED · Gate MT-1 PASS (60_)
                           MT-002+ NOT STARTED · RUNTIME_NOT_IMPLEMENTED_YET
                           PROVIDER_NOT_SELECTED_YET · NO PAID BENCHMARK_YET
Runtime AI               : OFF
Budget                   : hard 122 / committed 112 / reserved 0 / available 10
production_jobs média    : 0
P0                       : aucun
P1 ouverts               : BACKUP_PRESENT_RESTORE_UNPROVEN ; décision média image VHS-124
Prochaine porte majeure  : MT-002 Capability Registry
```

### Portes Directors texte

| Directeur | Smoke réel | Prompt canon |
|---|---|---|
| Marketing | PASS (10B) | `marketing-analyzer-v2` |
| Creative | PASS (10C) | `creative-analyzer-v5` |
| Script | PASS (10D) | `script-analyzer-v1` |
| Art | PASS (10E-V3) | `art-analyzer-v3` |
| Storyboard | PASS (10F-V4) | `storyboard-analyzer-v4` |

Post-Storyboard (Prompt → Router → Production média) : **implémenté en fakes** ; **non prouvé** provider réel sur `/director`.

---

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
→ Prompt Director → ScenePackage[] / scene_package_set
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

---

## Classification documentaire

| Classe | Signification |
|---|---|
| `CURRENT` | Décrit l’architecture ou l’état encore valides |
| `NEEDS_UPDATE` | (temporaire pendant refresh) — corriger puis reclasse |
| `HISTORICAL_SNAPSHOT` | Figé à une date ; bandeau obligatoire ; ne pas réécrire l’histoire |
| `FUTURE_DESIGN` | Vision / cible ; ≠ livré |

---

## Index complet 00–58

### Canon fondation (00–20)

| Doc | Titre | Classe |
|---|---|---|
| [`00_README.md`](./00_README.md) | Index et règles | `CURRENT` |
| [`01_PROJECT_CONTEXT.md`](./01_PROJECT_CONTEXT.md) | Contexte produit | `CURRENT` |
| [`02_ARCHITECTURE.md`](./02_ARCHITECTURE.md) | Architecture figée | `CURRENT` |
| [`03_CURRENT_AUDIT.md`](./03_CURRENT_AUDIT.md) | Protocole d’audit initial | `HISTORICAL_SNAPSHOT` |
| [`04_TARGET_VISION.md`](./04_TARGET_VISION.md) | Vision UX / NFR | `FUTURE_DESIGN` |
| [`05_DEVELOPMENT_RULES.md`](./05_DEVELOPMENT_RULES.md) | Règles d’ingénierie | `CURRENT` |
| [`06_ROADMAP_V2.md`](./06_ROADMAP_V2.md) | Roadmap théorique + carte exécutée | `CURRENT` |
| [`07_MARKETING_DIRECTOR.md`](./07_MARKETING_DIRECTOR.md) | Contrat Marketing | `CURRENT` |
| [`08_CREATIVE_DIRECTOR.md`](./08_CREATIVE_DIRECTOR.md) | Contrat Creative | `CURRENT` |
| [`09_SCRIPT_WRITER.md`](./09_SCRIPT_WRITER.md) | Contrat Script | `CURRENT` |
| [`10_ART_DIRECTOR.md`](./10_ART_DIRECTOR.md) | Contrat Art | `CURRENT` |
| [`11_STORYBOARD_DIRECTOR.md`](./11_STORYBOARD_DIRECTOR.md) | Contrat Storyboard | `CURRENT` |
| [`12_PROMPT_DIRECTOR.md`](./12_PROMPT_DIRECTOR.md) | Contrat Prompt | `CURRENT` |
| [`13_MODEL_ROUTER.md`](./13_MODEL_ROUTER.md) | Contrat Router | `CURRENT` |
| [`14_PRODUCTION_DIRECTOR.md`](./14_PRODUCTION_DIRECTOR.md) | Contrat Production | `CURRENT` |
| [`15_GENERATION_ENGINE.md`](./15_GENERATION_ENGINE.md) | Contrat Generation Engine | `CURRENT` |
| [`16_DIRECTOR_UI.md`](./16_DIRECTOR_UI.md) | UI Director | `CURRENT` |
| [`17_SUPABASE_PROJECTS.md`](./17_SUPABASE_PROJECTS.md) | **Schéma Supabase réel** | `CURRENT` |
| [`18_TESTING.md`](./18_TESTING.md) | Stratégie tests + baselines | `CURRENT` |
| [`19_DEPLOYMENT.md`](./19_DEPLOYMENT.md) | Déploiement / flags / ops | `CURRENT` |
| [`20_FINAL_AUDIT.md`](./20_FINAL_AUDIT.md) | Audit final Phase 9 (fakes) | `HISTORICAL_SNAPSHOT` |

### Rapports historiques / ops (21–58) — ne pas réécrire

| Doc | Sujet |
|---|---|
| [`21_VHS_125_REMOTE_MIGRATION_INCIDENT.md`](./21_VHS_125_REMOTE_MIGRATION_INCIDENT.md) | Incident migrations Production |
| [`22_DIRECTOR_HUMAN_RETRY.md`](./22_DIRECTOR_HUMAN_RETRY.md) | Retry humain Director |
| [`23_PHASE_10A_REMOTE_PREFLIGHT.md`](./23_PHASE_10A_REMOTE_PREFLIGHT.md) | Préflight distant |
| [`24_PHASE_10AB_ENVIRONMENT_SAFETY.md`](./24_PHASE_10AB_ENVIRONMENT_SAFETY.md) | Isolation environnement / backup P1 |
| [`25_PHASE_10AC_VERCEL_KILL_SWITCH_RESET.md`](./25_PHASE_10AC_VERCEL_KILL_SWITCH_RESET.md) | Kill switches Vercel |
| [`26_PHASE_10AD_LOCAL_DB_SAFE_REDEPLOY.md`](./26_PHASE_10AD_LOCAL_DB_SAFE_REDEPLOY.md) | Redeploy DB local sûr |
| [`27_PHASE_10B_FIRST_REAL_TEXT_SMOKE.md`](./27_PHASE_10B_FIRST_REAL_TEXT_SMOKE.md) | Marketing PASS |
| [`28_PHASE_10C_CREATIVE_SMOKE_PREP.md`](./28_PHASE_10C_CREATIVE_SMOKE_PREP.md) | Creative PREP |
| [`29_PHASE_10C_FIRST_REAL_CREATIVE_SMOKE.md`](./29_PHASE_10C_FIRST_REAL_CREATIVE_SMOKE.md) | Creative PASS |
| [`30_PHASE_10D_SCRIPT_SMOKE_PREP.md`](./30_PHASE_10D_SCRIPT_SMOKE_PREP.md) | Script PREP |
| [`31_PHASE_10D_FIRST_REAL_SCRIPT_SMOKE.md`](./31_PHASE_10D_FIRST_REAL_SCRIPT_SMOKE.md) | Script PASS |
| [`32_PHASE_10D_SCRIPT_CONFIG_RECONCILIATION.md`](./32_PHASE_10D_SCRIPT_CONFIG_RECONCILIATION.md) | Canon Script |
| [`33_PHASE_10E_ART_TEXT_SMOKE_PREP.md`](./33_PHASE_10E_ART_TEXT_SMOKE_PREP.md) | Art PREP |
| [`34_PHASE_10E_FIRST_REAL_ART_TEXT_SMOKE.md`](./34_PHASE_10E_FIRST_REAL_ART_TEXT_SMOKE.md) | Art BLOCKED v2 |
| [`35_PHASE_10E_ART_INVALID_CANDIDATE_DIAG.md`](./35_PHASE_10E_ART_INVALID_CANDIDATE_DIAG.md) | Diag Art |
| [`36_PHASE_10E_ART_V3_NEW_EXECUTE_PREP.md`](./36_PHASE_10E_ART_V3_NEW_EXECUTE_PREP.md) | Art v3 PREP |
| [`37_PHASE_10E_ART_V3_NEW_EXECUTE.md`](./37_PHASE_10E_ART_V3_NEW_EXECUTE.md) | Art PASS v3 |
| [`38_PHASE_10F_STORYBOARD_TEXT_SMOKE_PREP.md`](./38_PHASE_10F_STORYBOARD_TEXT_SMOKE_PREP.md) | Storyboard PREP |
| [`39_PHASE_10F_FIRST_REAL_STORYBOARD_TEXT_SMOKE.md`](./39_PHASE_10F_FIRST_REAL_STORYBOARD_TEXT_SMOKE.md) | Storyboard budget BLOCKED |
| [`40_PHASE_10F_WORKSPACE_BUDGET_AUDIT.md`](./40_PHASE_10F_WORKSPACE_BUDGET_AUDIT.md) | Audit budget |
| [`41_PHASE_10F_BUDGET_AUTH_A.md`](./41_PHASE_10F_BUDGET_AUTH_A.md) | Budget Auth A |
| [`42_PHASE_10F_STORYBOARD_AUTH_B.md`](./42_PHASE_10F_STORYBOARD_AUTH_B.md) | Auth B |
| [`43_PHASE_10F_STORYBOARD_AUTH_B_RESUME.md`](./43_PHASE_10F_STORYBOARD_AUTH_B_RESUME.md) | Auth B resume |
| [`44_PHASE_10F_STORYBOARD_PROVIDER_DIAG.md`](./44_PHASE_10F_STORYBOARD_PROVIDER_DIAG.md) | Diag provider schéma |
| [`45_PHASE_10F_STORYBOARD_RETRY2_PREP.md`](./45_PHASE_10F_STORYBOARD_RETRY2_PREP.md) | Retry2 PREP |
| [`46_PHASE_10F_RETRY2_DEPLOY_PREFLIGHT.md`](./46_PHASE_10F_RETRY2_DEPLOY_PREFLIGHT.md) | Retry2 deploy |
| [`47_PHASE_10F_STORYBOARD_RETRY2_EXECUTE.md`](./47_PHASE_10F_STORYBOARD_RETRY2_EXECUTE.md) | Retry2 BLOCKED |
| [`48_PHASE_10F_STORYBOARD_CONTINUITY_DIAG.md`](./48_PHASE_10F_STORYBOARD_CONTINUITY_DIAG.md) | Diag continuité → v3 |
| [`49_PHASE_10F_STORYBOARD_V3_RETRY_PREP.md`](./49_PHASE_10F_STORYBOARD_V3_RETRY_PREP.md) | V3 PREP |
| [`50_PHASE_10F_V3_BUDGET_AND_PUSH.md`](./50_PHASE_10F_V3_BUDGET_AND_PUSH.md) | V3 budget+push |
| [`51_PHASE_10F_V3_DEPLOY_PREFLIGHT.md`](./51_PHASE_10F_V3_DEPLOY_PREFLIGHT.md) | V3 deploy |
| [`52_PHASE_10F_STORYBOARD_V3_EXECUTE.md`](./52_PHASE_10F_STORYBOARD_V3_EXECUTE.md) | V3 BLOCKED |
| [`53_PHASE_10F_STORYBOARD_ALL_CONTINUITY_DIAG.md`](./53_PHASE_10F_STORYBOARD_ALL_CONTINUITY_DIAG.md) | Diag → v4 |
| [`54_PHASE_10F_STORYBOARD_V4_RETRY_PREP.md`](./54_PHASE_10F_STORYBOARD_V4_RETRY_PREP.md) | V4 PREP |
| [`55_PHASE_10F_V4_BUDGET_AND_PUSH.md`](./55_PHASE_10F_V4_BUDGET_AND_PUSH.md) | V4 budget+push |
| [`56_PHASE_10F_V4_DEPLOY_PREFLIGHT.md`](./56_PHASE_10F_V4_DEPLOY_PREFLIGHT.md) | V4 deploy |
| [`57_PHASE_10F_STORYBOARD_V4_EXECUTE.md`](./57_PHASE_10F_STORYBOARD_V4_EXECUTE.md) | **Storyboard PASS** |
| [`58_PHASE_11A_FIRST_REAL_MEDIA_SMOKE_PREP.md`](./58_PHASE_11A_FIRST_REAL_MEDIA_SMOKE_PREP.md) | **Media PREP / DECISION_REQUIRED** |
| [`59_MOTION_PERFORMANCE_TRANSFER_ARCHITECTURE.md`](./59_MOTION_PERFORMANCE_TRANSFER_ARCHITECTURE.md) | **Motion Transfer — ARCHITECTURE_READY_FOR_IMPLEMENTATION** |
| [`60_MT001_MOTION_TRANSFER_DOMAIN_CONTRACTS.md`](./60_MT001_MOTION_TRANSFER_DOMAIN_CONTRACTS.md) | **MT-001 domain contracts — Gate MT-1 PASS** |

### Pilotage (hors numérotation)

| Doc | Rôle |
|---|---|
| [`BACKLOG_V2.md`](./BACKLOG_V2.md) | **État ops + items** |
| [`CHANGELOG.md`](./CHANGELOG.md) | Historique documentaire / livraisons |
| [`CHECKLIST_RELEASE.md`](./CHECKLIST_RELEASE.md) | Checklist release |
| [`CURRENT_CODEBASE_AUDIT.md`](./CURRENT_CODEBASE_AUDIT.md) | Audit Phase 0→Porte 1 (**snapshot** + bandeau courant) |
| [`SUPABASE_V2_MIGRATION_PLAN.md`](./SUPABASE_V2_MIGRATION_PLAN.md) | Plan apply + baseline locale |
| [`GLOSSARY.md`](./GLOSSARY.md) | Vocabulaire normatif |

---

## Ordre de lecture recommandé

1. Ce README (état + index).
2. `BACKLOG_V2.md` + `CHANGELOG.md` (où on en est).
3. `02_ARCHITECTURE.md` + `05_DEVELOPMENT_RULES.md`.
4. Contrats `07`–`15` selon le module.
5. `17_SUPABASE_PROJECTS.md` pour toute question données.
6. `18_TESTING.md` / `19_DEPLOYMENT.md` pour qualité et ops.
7. Rapports `27`–`58` pour preuves smokes ; `20` / `03` seulement comme historique.
8. Avant média image borné : `58_` puis décision humaine — **ne pas** relancer sans Auth.
9. Chantier majeur Motion Transfer : `59_` (architecture) puis tickets MT-001… — **pas** d’implémentation spéculative ni benchmark payant sans gates.

---

## Definition of Done globale

- contrats validés et persistables ;
- tests unitaires, intégration et E2E pertinents au vert ;
- aucun appel fournisseur depuis React ou un Directeur ;
- observabilité, coûts, erreurs et reprises vérifiés ;
- migration et rollback documentés ;
- documentation et changelog mis à jour.
