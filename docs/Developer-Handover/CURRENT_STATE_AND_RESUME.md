# Virtual Humans Studio V2 — Current State and Resume

<!-- CURRENT_STATE_MARKERS
verifiedAt=2026-08-14T18:30:00+02:00
documentedHead=a0db8c7
headStatus=pending commit
lastPhaseReport=122_PHASE_11A_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION.md
nextPhase=AUTH_11A_CORRECTED_COMPOSED_ASSET_PRIVATE_PREVIEW
budgetHard=274
budgetCommitted=249
budgetReserved=0
budgetAvailable=25
runtimePaidMedia=OFF
unitTests=1604/1604
globalStatus=CORRECTED_COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING
-->

**Projet :** Virtual Humans Studio V2  
**Statut global :** `CORRECTED_COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING`  
**Dernière vérification :** 2026-08-14 18:30 Europe/Paris  
**Auteur de la mise à jour :** Cursor · `AUTH_11A_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION`  
**Branche :** `main`  
**HEAD local :** docs+script à venir · runtime **`245bea2`**  
**origin/main :** `a0db8c7` avant ce commit  
**Working tree à la vérification :** `headStatus=pending commit`  
**Environnement Production principal :** Vercel Production + Supabase `ejdb…nmvi` · `eu-west-3`  
**Commit runtime applicatif :** **`245bea2`** (composeur 1.1.0 · enfant corrigé écrit)  
**Index :** [`00_README.md`](./00_README.md)  
**Dernier rapport de phase :** [`122_PHASE_11A_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION.md`](./122_PHASE_11A_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION.md)  
**Prochaine phase exacte :** `AUTH_11A_CORRECTED_COMPOSED_ASSET_PRIVATE_PREVIEW`

> **Sécurité — interdit dans ce fichier :** URL signée, secret, credential, média, clé provider, chaîne de connexion, salt brut, prompt provider complet, base64, donnée biométrique.

---

## Autorité documentaire

1. Code et migrations actuellement versionnés.
2. État réel Supabase / Vercel **vérifié**.
3. **Ce fichier** (`CURRENT_STATE_AND_RESUME.md`).
4. `00_README.md`.
5. Rapports de phase numérotés (snapshots immuables).
6. Audits et documents historiques.

En cas de divergence : **code + état réel vérifié** priment. Toute divergence connue est listée ci-dessous.

### Règle permanente

Une phase qui change HEAD, architecture, contrats, migrations, tests, artifacts, budget, ledger, provider, runtime, flags, déploiement, Storage, Human Review, verdict, P0/P1 ou prochaine porte **n’est pas clôturée** tant que ce fichier n’est pas mis à jour **avant le commit final**.  
Une phase docs-only met aussi à jour ce fichier si le statut ou la prochaine action change.  
`headStatus=pending commit` est autorisé pendant le commit de clôture ; après commit, la phase suivante (ou un sync docs) passe `headStatus=synced` et aligne `documentedHead`.

---

## 1. Résumé exécutif

Virtual Humans Studio est un Assistant Réalisateur IA. Le parcours `/director` enchaîne Marketing → Creative → Script → Art → Storyboard → Prompt → Router → Production → providers → merge/export. L’utilisateur ne choisit ni provider ni syntaxe de prompt.

| Zone | Statut | Preuve |
|---|---|---|
| Directors texte (Marketing→Storyboard) | **PASS_REAL** | smokes 10B–10F · runtime refermé OFF |
| Prompt / Router / queue | **PASS_SYNTHETIC** + câblage 11A | fakes Phase 9 ; plan image single-step WIRED |
| OpenAI Image `/director` | **PASS technique** · 1.0.0 **HUMAN_REJECTED** · 1.1.0 **HR pending** | 2 appels · parent `7832765d…` conservé · `6a2beca9…` REJECT · `4429654f…` pending |
| Overlay typographique | **WIRED_DISABLED** · 1.1.0 écrit privé | checksum `b284e877…` · enfant `4429654f…` · HR seedée · 0 OpenAI |
| Motion Transfer | **PASS_REAL** benchmark only | MV-001 APPROVE · Registry **DISABLED** · runtime **UNAVAILABLE** |
| I2V / T2V / voice / lipsync / merge-export réels | **PREPARED** / **NOT_STARTED** | pas de smoke `/director` réel |
| Production runtime flags | **OFF** | Paid Media / VHS-124 / Motion / Director Paid AI |
| Prochaine étape | **PREPARED** | preview privée temporaire du nouvel enfant — **0** OpenAI · Auth preview distincte |

**Risques principaux :** 3ᵉ appel OpenAI sans Auth ; réactiver les 4 assets ; décider HR sans Auth ; promouvoir un commit docs comme runtime.

---

## 2. Divergences détectées

| Source | Affirme | Réalité vérifiée 2026-08-14 | Action |
|---|---|---|---|
| `17_SUPABASE_PROJECTS.md` | 29 migrations · budget 122/112/0/10 | **30/30** alignées · hard **274** / committed **248** / reserved **0** / available **26** | ce fichier prime ; `17_` stale |
| `19_DEPLOYMENT.md` checkpoint 11 août | 0 job média · MT-005 NOT APPLIED · budget 122 | jobs `1 completed + 1 failed` · MT-005 **appliquée** · budget 274 | ce fichier prime |
| `BACKLOG_V2.md` §P1 bas de liste | prochaine porte execution recomposition | portes `113_`–`122_` consommées · next = preview privée | corrigé dans cette phase |
| Vercel Production SHA | souvent égalé à HEAD | runtime **60cc335** OFF `fs4ephi9l-…` · HEAD Git peut devenir docs | ne pas promouvoir le commit docs |
| pgTAP 378 / intégration 33 | présentés comme courants dans `17_` | **historiques** post-10A (11 août) · non relancés le 14 août | datés ci-dessous |

---

## 3. Grandes phases

| Domaine | Statut | Dernière phase | Preuve | Provider | Coût réel connu (¢) | Blocage | Prochaine action |
|---|---|---|---|---|---|---|---|
| Fondations V2 | PASS_SYNTHETIC | 9 | unitaires + E2E fake | — | 0 | — | maintenir |
| Supabase / migrations | PASS_REAL | MT-005 `82_` | 30/30 live | — | 0 | apply distant interdit sans Auth | ne pas rejouer |
| Sécurité environnement | PASS_REAL | 7–10A | fail-closed | — | 0 | RLS distante non re-auditée 14 août | audit RLS distant |
| Marketing Director | PASS_REAL | 10B | 1 appel | OpenAI texte | 4 | flags OFF | ne pas relancer |
| Creative Director | PASS_REAL | 10C | 1 appel | OpenAI texte | 5 | flags OFF | ne pas relancer |
| Script Director | PASS_REAL | 10D | 1 appel | OpenAI texte | 3 | flags OFF | ne pas relancer |
| Art Director | PASS_REAL | 10E-V3 | 1 appel v3 (v2 FAILED_HISTORICAL) | OpenAI texte | 12 (v3) | flags OFF | ne pas relancer |
| Storyboard Director | PASS_REAL | 10F-V4 | 1 appel v4 | OpenAI texte | 5 | flags OFF | ne pas relancer |
| Prompt Director | PASS_SYNTHETIC + correctif 11A | `113_`/`115_` | set no-text `2e8e9e6f` persisté | — | 0 | — | ne pas rejouer |
| Router | PASS_SYNTHETIC | 9 / 11A plan | fakes + plan single-step | — | 0 | text_motion Registry | rester borné 11A |
| Generation Engine | WIRED_DISABLED | `102_`–`122_` | 2 images + 1 composed REJECT + 1 composed 1.1.0 pending | OpenAI Image | 2 | provider PASS · 1.1.0 écrit | preview privée |
| Production queue/worker | PASS_REAL borné | `108_` + `115_` | 2 jobs image completed | — | inclus 2 | worker OFF | ne pas cron |
| Ledger | PASS_REAL | `109_` + `115_` | 2×1¢ provisional soldés | — | 249 committed | — | pas de 3ᵉ réserve image |
| Storage / assets | PASS_REAL | `108_`/`110_`/`115_`/`118_`/`122_` | 4 PNG privés inactifs | Supabase Storage | 0 extra | ni réemploi ni activation | conserver |
| QC | PASS_REAL technique | `110_` | PNG/checksum ; visuel humanOnly | — | 0 | OCR absent | garder humanOnly |
| Human Review | PASS_REAL | `110_` smoke REJECT · `119_` composed REJECT · `122_` seed 1.1.0 · `97_` Motion APPROVE | 2 image + 1 Motion + 1 seed | — | 0 | parent + enfant 1.1.0 sans décision | preview puis HR |
| OpenAI Image | PASS technique / 1.0.0 REJECT / 1.1.0 pending | `115_`/`119_`/`122_` | parent relu 1× · enfant `4429654f…` écrit | `gpt-image-1` | 2 | 0 3ᵉ appel | preview Auth |
| Vidéo I2V/T2V | PREPARED | 9 / VHS-124 | fakes | fal (préparé) | 0 `/director` | VHS-124 | hors 11A |
| Voice | PREPARED | legacy route | adapter ElevenLabs | ElevenLabs | 0 `/director` | pas de smoke V2 | DEFERRED |
| Lipsync | NOT_STARTED | — | — | — | 0 | — | avant beta |
| Merge / export | PASS_SYNTHETIC | 9 | fake-merge gated | — | 0 | pas de média réel | avant Production |
| Motion Transfer | PASS_REAL benchmark | `97_`–`100_` | 1 appel fal · HR APPROVE | fal Kling MC | 135 | Registry DISABLED | MV-002 DEFERRED |
| UI finale | PREPARED | `/director` | parcours texte réel | — | 0 | pas produit final | avant beta |
| Monitoring / ops | PREPARED | VHS-005 | redaction logs | — | 0 | traces distribuées | avant Production |
| Documentation / release | PASS_REAL living | cette phase | ce fichier | — | 0 | fraîcheur à tenir | script freshness |

---

## 4. Directors texte

Tous les smokes texte : **1 appel réel chacun sur le passage PASS** · replay idempotent **sans** second appel · flags **OFF** ensuite. Identifiants **préfixes seulement**.

| Director | Statut | Prompt | Artifact actif | Appels PASS | Ledger (réserve/commit/release) | Rapport |
|---|---|---|---|---|---|---|
| Marketing | PASS_REAL | `marketing-analyzer-v2` | `marketing_plan` `199284d6-…` rev.1 | 1 | 24 / 4 / 20 | 10B |
| Creative | PASS_REAL | `creative-analyzer-v5` | `creative_concept` `11f8f8e0-…` rev.1 | 1 | 12 / 5 / 7 | 10C |
| Script | PASS_REAL | `script-analyzer-v1` | `video_script` `349e2792-…` rev.1 | 1 | 12 / 3 / 9 | 10D |
| Art | PASS_REAL | `art-analyzer-v3` | `visual_direction` `49481462-…` rev.1 | 1 (v3) | 13 / 12 / 1 | 10E-V3 `37_` |
| Storyboard | PASS_REAL | `storyboard-analyzer-v4` | `storyboard_project` `7cf183c1-…` rev.1 | 1 (v4) | 13 / 5 / 8 | 10F-V4 `57_` |

Art v2 et Storyboard v2/v3 : **FAILED_HISTORICAL** (candidat invalide / continuité) — artifacts de ces tentatives non réutilisés comme canon.  
Prompt Director ne rejoue **aucun** Director texte pour 11A.

---

## 5. Motion Transfer

- Architecture MT-001…MT-014 livrée ; MT-015A MV-002 **DESIGN_READY** puis **DEFERRED** (`100_`).
- Provider : **fal** · Kling Motion Control · adapter validé **benchmark-only** (`99_`).
- Worker, durability, output transport, QC consumer : WIRED puis exécutés pour MV-001.
- MV-001 : projet `390c25db-…` · coût réel **135¢** · Human Review **APPROVE** (`97_`) · `PASS_WITH_HUMAN_APPROVAL`.
- MT-013P : recovery opérationnel · stub **REMOVED** (`98_`).
- Registry Motion Production : **disabled** · `paidExecution=false` · status capability **UNVERIFIED** hors benchmark.
- Runtime Motion : **UNAVAILABLE**.
- Privacy Pack MV-001 : **ACCEPTED_LIMITED** — **≠ consentement global**.
- Gaps beta/Production : Registry, consentement élargi, MV-002, observabilité Motion, pas d’activation Vercel.

---

## 6. Phase 11A OpenAI Image

**Dernier STOP (`121_`) :** `READY_FOR_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION`  
Auth provider `115_` **consommée** · Auth decoder `116_` **consommée** · Auth preflight `117_` **consommée** · Auth execution `118_` **consommée** · Auth preview **consommée** · Auth HR composed `119_` **consommée** · Auth glyphes `120_` **consommée** · Auth preflight 1.1.0 `121_` **consommée**.

| Fait | Valeur |
|---|---|
| Pipeline technique | **PASS_REAL** provider · 1.0.0 FAIL visuel · **1.1.0 preflight mémoire PASS** |
| Appels OpenAI | **2** · `gpt-image-1` · `low` · `1024×1024` · replay 0 · **cette phase 0** |
| Coût | **2¢ provisional** · preflight **0¢** |
| Asset rejeté smoke | `5d68ef64-…` · `rejected` · **intact** · **non lu** |
| Asset provider | `7832765d-…` · `pending_review` · `active=false` · relu 1× · réutilisable |
| Asset composé | `6a2beca9-…` · `rejected` · `active=false` · `human.corrupted_overlay_glyphs` · **non muté** |
| Human Review | REJECT smoke `93f02155` · REJECT composed `f1fcb832` · **inchangés** |
| Politique provider | `no_text` · prompt `phase-11a-image-prompt-v2` · hash live `d4f69858358805b0…` |
| Overlay déterministe | **WIRED_DISABLED** · FP `fdfae63fe1c7d003-…` · atlas `shapes-v1` · composeur **1.1.0** |
| Checksum corrigé (mémoire) | `b284e877e5a80e7af19a84fdce9db79f0ab1e31298b6f9b43fcb9e18a7921fe5` |
| Future asset (non créé) | préfixe `4429654f…` · FP `4429654f9bf92525…` |
| Package no-text | `2e8e9e6f…` rev.2 · plan `a55bd426…` rev.2 |
| 3ᵉ appel | **interdit** sans Auth provider distincte |

Copy overlay (compositor-only, ne pas muter) : locale `fr` · titre `De l’idée à la structure` (U+2019) · CTA `Découvrir Virtual Humans Studio`.

---

## 7. Artifacts (préfixes, Production live 2026-08-14)

Aucun contenu, aucune URL. Usage futur : **réutiliser les artifacts texte actifs** ; **interdire** l’asset image rejeté comme résultat final.

| Projet (redacted) | Type | Id | Rev | État | Phase | Usage futur |
|---|---|---|---|---|---|---|
| Director texte | `video_project_brief` | `d8aaca88` / `95c24837` / `63b3b93c` | 1 | actifs (plusieurs projets) | 10x | amont seulement |
| Director texte | `marketing_plan` | `199284d6` | 1 | actif | 10B | réutilisable |
| Director texte | `creative_concept` | `11f8f8e0` | 1 | actif | 10C | réutilisable |
| Director texte | `video_script` | `349e2792` | 1 | actif | 10D | réutilisable |
| Director texte | `visual_direction` | `49481462` | 1 | actif | 10E-V3 | réutilisable |
| Director texte | `storyboard_project` | `7cf183c1` | 1 | actif | 10F-V4 | réutilisable |
| 11A / autre | `scene_package_set` | `2e8e9e6f` actif rev.2 · `bcec6c03` stale leaky | 2 | actif no-text | `115_` | ne pas revenir à `bcec6c03` |
| 11A / autre | `generation_plan` | `a55bd426` actif rev.2 · `437ae89d` stale | 2 | — | `115_` | plan text-free |
| 11A image | `quality_report` | `67cfed04` r1 smoke · `05b64a29` r2 composé | 2 | pointeur actif = r2 | `119_` | QR composé réutilisé |
| 11A image | `production_result` | … r3 `6dc0ec6f` · r4 `98336d53` | 4 | pointeur actif = r4 | `119_` | `delivery=blocked` |
| Motion | `quality_report` | `1516c218` | 1 | actif | `97_` | benchmark only |
| Motion | `production_result` | `4adc49b3` r1 stale · `4054a206` r2 actif | 2 | APPROVE | `97_` | pas Registry Production |
| Second jeu texte | `marketing_plan` `61138106` · `creative_concept` `d7d2dd93` · `video_script` `d540fdc5` | 1 | actifs (autre projet) | 10x | ne pas mélanger avec 11A |

Assets média image : `5d68ef64` **rejected** · `7832765d` **pending_review** (parent réutilisable) · `6a2beca9` **composed rejected** · tous `active=false`.  
Output Motion : `2d7ffcad-…` · privé · non actif comme livrable produit.

---

## 8. Production DB et migrations

Vérifié live Supabase **2026-08-14** (lecture seule).

| Champ | Valeur |
|---|---|
| Projet | `ejdb…nmvi` · **Virtual Humans Studio** · `eu-west-3` · `ACTIVE_HEALTHY` |
| Migrations Production | **30** |
| Migrations locales | **30** fichiers `studio/supabase/migrations/` |
| Alignement | **aligné 30/30** (plus de drift fichier ↔ remote) |
| Dernière migration | `20260811211757_vhs_mt005_human_review_decision_extend` |
| RLS | activée V2 · pas de policy anon/authenticated (modèle `service_role` serveur) |
| Grants sensibles | service_role only — **ne pas élargir** |
| Restore drill | PASS (`78_`) · cible `qmsh…qlnq` **supprimée** (`80_`) |
| Backup | drill prouvé ; rétention ops à reconfirmer avant Production élargie |
| pgTAP | **378** historique 11 août — **non relancé** le 14 août |
| DB integration | **33/33** historique 11 août — **N/A** le 14 août (Docker absent, `113_`) |
| Dernier reset local | baseline post-10A (historique) |
| LOCAL_ONLY | aucune migration locale non appliquée distante à cette vérif |
| Ops distantes récentes | execution `122_` · 1 lecture parent · 1 write composed 1.1.0 · 0 OpenAI · flags OFF |

---

## 9. Budget et ledger

Montants en **centimes USD**. Hard limit ≠ dépense réelle.

| | ¢ USD | Source |
|---|---|---|
| Hard limit | **274** | live `workspace_budget_policies` 2026-08-14 |
| Committed | **249** | ledger : 247 `committed` + 2 `provisional` image |
| Reserved actif | **0** | `budget_reservations` : 0 `active` |
| Available | **25** | 274 − 249 − 0 |
| Dernière vérif | 2026-08-14 13:55 | MCP + script paid |

Coûts réels connus par chantier : texte Directors (voir §4) · Motion **135** · image 11A **2** provisional.  
Réservations actives : **0**. Reconciliations ouvertes : **0**.  
Règle : toute dépense provider exige une Auth **dans le chat courant**.  
Prochain shortfall compose-only : **0¢** provider (local).

---

## 10. Runtime et flags

Valeurs **attendues maintenant** : OFF sauf persistence/UI de reprise. **Aucune valeur secrète.**  
Dernière preuve fermeture : smokes + `113_` (0 flag ouvert). Runtime observable Vercel : **UNVERIFIED_THIS_PHASE**.

| Flag / kill | Env | Attendu | Protège | Fermeture |
|---|---|---|---|---|
| `DIRECTOR_V2_PAID_AI_ENABLED` | Vercel/local | OFF | Directors texte payants | `0`/`false` |
| `DIRECTOR_V2_*_AI_ENABLED` (M/C/S/A/SB) | idem | OFF | chaque Director | idem |
| `DIRECTOR_V2_PAID_GENERATION_ENABLED` | idem | OFF | média `/director` | idem |
| `DIRECTOR_V2_WORKER_ENABLED` | idem | OFF | worker | idem + pas de cron |
| `VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION` | idem | OFF | allowlist image 11A | OFF · n’est pas `providerMode=real` |
| `MOTION_TRANSFER_ENABLED` | idem | OFF | capability Motion | OFF |
| `MOTION_TRANSFER_PAID_ENABLED` | idem | OFF | paid fal | OFF |
| `MOTION_TRANSFER_FAL_ENABLED` | idem | OFF | adapter fal | OFF |
| `MOTION_TRANSFER_WORKER_ENABLED` | idem | OFF | worker Motion | OFF |
| Retry / fallback / downstream / merge-export | code 11A | 0 / 0 / 0 | plan single-step | ne pas ajouter |

`DIRECTOR_V2_ENABLED` + persistence peuvent rester nécessaires à la **reprise lecture** de projets — ce n’est **pas** une autorisation provider.

---

## 11. Providers

| Provider | Capability | Adapter | Modèle / endpoint | Statut | Réel/fake | Dernier appel | # appels PASS | Coût ¢ | Runtime |
|---|---|---|---|---|---|---|---|---|---|
| OpenAI | texte Directors | adapters Director | `gpt-5.6` | PASS_REAL puis OFF | réel | 10F-V4 | 1/passage PASS | voir §4 | disabled |
| OpenAI | `image.text_to_image` | allowlist 11A | `gpt-image-1` low 1024 | HUMAN_REVIEW_REQUIRED | réel ×2 | `115_` | 2 | 2 | disabled |
| fal | `video.motion_transfer` | Kling MC | benchmark | PASS_REAL benchmark | réel ×1 | `95_` | 1 | 135 | disabled |
| fal | I2V/T2V/image autres | préparés | — | PREPARED | fake `/director` | — | 0 réel `/director` | 0 | disabled |
| ElevenLabs | voice | legacy + port | `eleven_multilingual_v2` | PREPARED | fake V2 | — | 0 `/director` | 0 | disabled |
| Legacy `/api/generate/image` | image | historique | — | DEPRECATED / ≠ PASS | — | — | — | — | ne pas utiliser |

Restrictions : pas de retry/fallback 11A ; pas de Motion depuis le chemin image ; pas de fal compose comme fallback image.

---

## 12. Tests

| Check | Valeur | Nature | Date / phase |
|---|---|---|---|
| Unitaires | **1604/1604** | **dernière complète** | 2026-08-14 `122_` |
| Typecheck / lint / build | PASS (lint 0 error) | dernière complète | `122_` |
| migrations-static | PASS (14) | dernière complète | `120_` (non touchées) |
| Secret scan diff `122_` | PASS | cette phase | `122_` |
| Tests ciblés glyphes / overlay / QC / HR | PASS | cette phase | `122_` |
| DB integration | N/A (stack locale non relancée) | **indisponible** 14 août | `122_` |
| pgTAP | 378 | **historique** | 11 août / 10A |
| Intégration DB | 33/33 | **historique** | 11 août / 10A |
| E2E Playwright `/director` | 15/15 ×2 | **historique** | Phase 9 |
| Fraîcheur living handover | PASS | tooling | `122_` |

Ne pas présenter 378/33/E2E comme relancés aujourd’hui.

---

## 13. Git et déploiements

| | |
|---|---|
| Branche | `main` |
| HEAD / origin/main | `a0db8c7` avant ce commit |
| Dernier commit applicatif runtime | **`245bea2`** composeur 1.1.0 + atlas shapes-v1 |
| Dernier commit documentaire | `a0db8c7` (`121_`) puis ce commit docs `122_` — **≠** nouvelle preuve applicative |
| Fingerprint composition 11A | `c532c400334f5b22` — **un commit docs ne le change pas** |
| Runtime applicatif compose | **245bea2** (1.1.0) · enfant `4429654f…` écrit · flags OFF |
| Auto-deploy | push docs peut redéployer — **ne pas** promouvoir comme preuve 1.1.0 |
| Dernier Ready connu | OFF `virtual-humans-8un7uflj1-…` · SHA `245bea2` |

---

## 14. P0, P1, décisions humaines

### P0 ouverts

- **Pas de 3ᵉ appel OpenAI Image** sans Auth provider distincte.
- **Ne pas** réactiver `5d68ef64-…` · `7832765d-…` · `6a2beca9-…` · `4429654f-…` · ne pas rouvrir les REJECT.
- **Ne pas** décider Human Review sans Auth distincte.
- **Ne pas** promouvoir un commit docs comme runtime `245bea2`.

### P1 ouverts

- Preview privée temporaire du nouvel enfant `4429654f…`.
- Run `39329a01` `completed` · `waitingReason=needs_review` pour le nouvel enfant.
- `17_` / `19_` stale (budget, migrations, jobs) — alignement docs ultérieur.
- VHS-005 métriques/traces ; RLS distante non re-auditée le 14 août.
- Voice / I2V / merge-export réels non prouvés.
- MV-002 DEFERRED.

### P0/P1 fermés (extraits)

- Execution recomposition 1.1.0 (`122_`) · preflight 1.1.0 (`121_`) · diagnostic glyphes (`120_`) · HR composed REJECT (`119_`) · compose execution (`118_`) · preflight compose (`117_`) · decode PNG 0–4 (`116_`) · paid text-free (`115_`) · HR smoke REJECT (`110_`) · restore (`78_`) · MT-005 (`82_`).

### Décisions humaines en attente

| Sujet | Choix | Impact | Auth requise | Interdit tant que manquante |
|---|---|---|---|---|
| Diagnostic glyphes bitmap | **fait** (`120_`) | 0¢ · 0 média Production | consommée | — |
| Preflight recomposition 1.1.0 | **fait** (`121_`) | 0¢ · 1 lecture · 0 write | consommée | — |
| Execution recomposition | **fait** (`122_`) | 0¢ · 1 enfant `4429654f…` + HR seed | consommée | — |
| Preview privée composé 1.1.0 | preview temporaire puis HR | 0¢ provider | `AUTH_11A_CORRECTED_COMPOSED_ASSET_PRIVATE_PREVIEW` | activer assets · décider HR |
| MV-002 | rester DEFERRED / designer plus tard | coût fal | Auth Motion dédiée | fal / Registry |
| Ouvrir flags Production | non par défaut | runtime payant | Auth flags | Vercel write |

---

## 15. Ce qui reste à faire

### Immédiat

**`AUTH_11A_CORRECTED_COMPOSED_ASSET_PRIVATE_PREVIEW`** — preview privée temporaire du nouvel enfant `4429654f…`, puis décision Human Review distincte. **0** OpenAI.

### Court terme

1. Preview privée du composé 1.1.0.
2. Human Review du nouvel enfant.
3. Décider ensuite I2V / suite média — pas Motion.

### Avant beta

Média `/director` au-delà d’un still ; UI opérable ; monitoring minimal ; consentement (Privacy Pack ≠ global) ; quotas ; support opérateur ; E2E au-delà des fakes Phase 9.

### Avant Production

Validations providers restantes ; export réel ; sécurité/RLS/rétention ; coûts et observabilité ; runbooks ; audit release (`CHECKLIST_RELEASE.md`).

Pas de délai calendaire.

---

## 16. Prochaine mission exacte (handoff)

```text
Contexte : VHS V2 · runtime 245bea2 · composeur 1.1.0 · budget 274/249/0/25 ¢
Dernier verdict : CORRECTED_COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING (122_)
Preuve : enfant 4429654f… · checksum b284e877… · HR seedée · 0 OpenAI
Blocage : 0 3e OpenAI · 0 activation · 0 décision HR sans Auth
Mission : uniquement AUTH_11A_CORRECTED_COMPOSED_ASSET_PRIVATE_PREVIEW
Auth consommées : CORRECTED_RECOMPOSITION_EXECUTION (122_) · PREFLIGHT (121_)
Interdit : OpenAI sans Auth · fal · Motion · activer les 4 assets
Attendu : preview privée temporaire du nouvel enfant
```

---

## 17. RESTART PROMPT FOR NEW CHAT

```text
Lis intégralement docs/Developer-Handover/CURRENT_STATE_AND_RESUME.md.
Lis ensuite 122_PHASE_11A_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION.md puis 121_ et 119_.
Vérifie Git. Le runtime Production image est 245bea2 (composeur 1.1.0). Un commit docs n’est pas une nouvelle preuve applicative.
Une autorisation provider d’un chat précédent n’est JAMAIS réutilisable.
N’appelle aucun provider sans Auth explicite dans CE chat.
Ne lis ni n’écris de média Production sans Auth.
Ne pas promouvoir un commit docs comme runtime applicatif.
```

---

## 18. Historique court (10 transitions)

| Date | Phase | Verdict | Commit | Coût ¢ | Effet Production | Porte suivante |
|---|---|---|---|---|---|---|
| 2026-08-14 | `122_` recomposition execution | CORRECTED_COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING | à venir | 0 | 1 write composed 1.1.0 · HR seed · 0 OpenAI | preview privée |
| 2026-08-14 | `121_` recomposition preflight | READY_FOR_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION | `a0db8c7` | 0 | 1 read · 0 write · 1.1.0 | execution recomposition |
| 2026-08-14 | `120_` glyph diagnose | BITMAP_GLYPH_RENDERING_FIXED_READY_FOR_RECOMPOSITION_PREFLIGHT | `245bea2` | 0 | 0 Production · fix local 1.1.0 | recomposition preflight |
| 2026-08-14 | `119_` composed HR REJECT | PASS_PROVIDER_ASSET_COMPOSED_ASSET_HUMAN_REJECTED | `2a586a9` | 0 | 1 REJECT composed · 0 Storage · 0 OpenAI | glyph diagnose |
| 2026-08-14 | `118_` compose execution | COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING | `87f53c7` | 0 | 1 composed write · HR seed · 0 OpenAI | private preview |
| 2026-08-14 | `117_` compose preflight | READY_FOR_EXISTING_PROVIDER_ASSET_COMPOSITION_EXECUTION | `d5cb4c9` | 0 | 1 read · 0 write · filtres 1–4 | compose execution |
| 2026-08-14 | `116_` PNG filter decoder | READY_FOR_EXISTING_PROVIDER_ASSET_COMPOSITION_PREFLIGHT | `60cc335` | 0 | 0 write · decode 0–4 | compose preflight |
| 2026-08-14 | `115_` text-free paid | COMPOSITOR_FAILED_NO_RETRY | runtime `e4c3de3` | 1 | 1 submit · 1 asset · 0 composed | harden PNG filters |
| 2026-08-14 | `114_` text-free live preflight | READY_FOR_TEXT_FREE_IMAGE_RETRY_PAID_AUTH | runtime `e4c3de3` | 0 | flags ON/OFF · 0 write | paid Auth |
| 2026-08-14 | Canon living | CANONICAL_CURRENT_STATE_AND_RESUME_READY | `8128d9e` | 0 | docs only | text-free preflight |
| 2026-08-14 | `113_` strip overlay | READY_FOR_NEW_TEXT_FREE… | `e4c3de3` | 0 | code only | text-free preflight |
| 2026-08-14 | `112_` retry preflight | BLOCKED_TEXT_LEAK | `2fb569e` / src `20e8783` | 0 | 0 write | strip overlay |
| 2026-08-14 | `111_` harden typo | READY_FOR_TEXT_FREE… | `20e8783` | 0 | 0 write | retry preflight |
| 2026-08-14 | `110_` HR REJECT | PASS_TECHNICAL_ASSET_HUMAN_REJECTED | `e63ac68` | 0 | décision rejected | harden |
| 2026-08-14 | `109_` ledger 1¢ | PASS_LEDGER_RECONCILED | `e6198a1` | 1 commit | reserve 0 | HR |
| 2026-08-14 | `108_` paid image | RECONCILIATION_REQUIRED | runtime `7a67c77` | 1 réserve | 1 asset privé | reconcile |
| 2026-08-14 | `107_` live preflight | READY_FOR_11A_PAID_AUTH | `7a67c77` | 0 | 0 | paid smoke |
| 2026-08-12 | `97_` / `95_` MV-001 | PASS_WITH_HUMAN_APPROVAL | MT-013O/M | 135 | output privé APPROVE | Registry stays OFF |

Détails : rapports numérotés. Ne pas réécrire.

---

## 19. Contrôle de fraîcheur

Script : `studio/scripts/check-current-state-freshness.mjs`  
Marqueurs machine : bloc `CURRENT_STATE_MARKERS` en tête de ce fichier.  
Échec si fichier absent, prochaine phase vide, budget/runtime/tests manquants, rapport introuvable, `00_README` sans index, secret-like, ou HEAD incohérent hors `pending commit`.
