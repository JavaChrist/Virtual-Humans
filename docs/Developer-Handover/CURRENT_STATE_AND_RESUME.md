# Virtual Humans Studio V2 — Current State and Resume

<!-- CURRENT_STATE_MARKERS
verifiedAt=2026-08-14T11:50:00+02:00
documentedHead=8128d9e
headStatus=pending commit
lastPhaseReport=113_PHASE_11A_STRIP_OVERLAY_COPY_FROM_IMAGE_VARIANT.md
nextPhase=AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT
budgetHard=274
budgetCommitted=248
budgetReserved=0
budgetAvailable=26
runtimePaidMedia=OFF
unitTests=1572/1572
globalStatus=READY_FOR_NEW_TEXT_FREE_IMAGE_RETRY_PREFLIGHT
-->

**Projet :** Virtual Humans Studio V2  
**Statut global :** `READY_FOR_NEW_TEXT_FREE_IMAGE_RETRY_PREFLIGHT`  
**Dernière vérification :** 2026-08-14 11:50 Europe/Paris  
**Auteur de la mise à jour :** Cursor · `AUTH_CREATE_CANONICAL_CURRENT_STATE_AND_RESUME`  
**Branche :** `main`  
**HEAD local :** `8128d9e` (living handover) · applicatif `e4c3de3`  
**origin/main :** `e4c3de3` au moment de la vérif initiale · ce commit docs est le sync  
**Working tree à la vérification :** propre après premier commit docs · `headStatus=pending commit`  
**Environnement Production principal :** Vercel Production (alias non recopié ici) + Supabase `ejdb…nmvi` · région `eu-west-3`  
**Commit runtime Production :** **UNVERIFIED_THIS_PHASE** (Vercel lecture non authentifiée) — ne pas confondre avec HEAD Git  
**Index :** [`00_README.md`](./00_README.md)  
**Dernier rapport de phase :** [`113_PHASE_11A_STRIP_OVERLAY_COPY_FROM_IMAGE_VARIANT.md`](./113_PHASE_11A_STRIP_OVERLAY_COPY_FROM_IMAGE_VARIANT.md)  
**Prochaine phase exacte :** `AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT`

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
| OpenAI Image `/director` | **HUMAN_REVIEW_REQUIRED** / pipeline **PASS_REAL** | 1 appel · asset **HUMAN_REJECTED** · copy overlay retiré (`113_`) |
| Overlay typographique | **WIRED_DISABLED** | `111_` · fixtures PNG synthétiques |
| Motion Transfer | **PASS_REAL** benchmark only | MV-001 APPROVE · Registry **DISABLED** · runtime **UNAVAILABLE** |
| I2V / T2V / voice / lipsync / merge-export réels | **PREPARED** / **NOT_STARTED** | pas de smoke `/director` réel |
| Production runtime flags | **OFF** | Paid Media / VHS-124 / Motion / Director Paid AI |
| Prochaine étape | **PREPARED** | preflight live text-free — **pas lancé** |

**Risques principaux :** second appel OpenAI Image sans nouveau preflight ; confondre HEAD docs et fingerprint applicatif ; rouvrir Motion ou flags ; traiter le Privacy Pack MV-001 comme consentement global.

---

## 2. Divergences détectées

| Source | Affirme | Réalité vérifiée 2026-08-14 | Action |
|---|---|---|---|
| `17_SUPABASE_PROJECTS.md` | 29 migrations · budget 122/112/0/10 | **30/30** alignées · hard **274** / committed **248** / reserved **0** / available **26** | ce fichier prime ; `17_` stale |
| `19_DEPLOYMENT.md` checkpoint 11 août | 0 job média · MT-005 NOT APPLIED · budget 122 | jobs `1 completed + 1 failed` · MT-005 **appliquée** · budget 274 | ce fichier prime |
| `BACKLOG_V2.md` §P1 bas de liste | prochaine porte STRIP_OVERLAY | porte **consommée** (`113_`) · next = text-free preflight | corrigé dans cette phase |
| Vercel Production SHA | souvent égalé à HEAD | **non vérifié** cette phase | `UNVERIFIED_THIS_PHASE` |
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
| Prompt Director | PASS_SYNTHETIC + correctif 11A | `113_` | unitaires + dry-run | — | 0 | — | preflight text-free |
| Router | PASS_SYNTHETIC | 9 / 11A plan | fakes + plan single-step | — | 0 | text_motion Registry | rester borné 11A |
| Generation Engine | WIRED_DISABLED | `102_`–`113_` | 1 image réelle puis OFF | OpenAI Image | 1 | flags OFF | preflight puis Auth paid |
| Production queue/worker | PASS_REAL borné | `108_` | 1 job image completed | — | inclus 1 | worker OFF | ne pas cron |
| Ledger | PASS_REAL | `109_` | 1¢ provisional soldé | — | 248 committed | — | pas de 2e réserve image |
| Storage / assets | PASS_REAL | `108_`/`110_` | 1 PNG privé rejected | Supabase Storage | 0 extra | asset interdit réemploi | conserver |
| QC | PASS_REAL technique | `110_` | PNG/checksum ; visuel humanOnly | — | 0 | OCR absent | garder humanOnly |
| Human Review | PASS_REAL | `110_` image REJECT · `97_` Motion APPROVE | 1+1 décisions | — | 0 | REJECT non rouvrable | ne pas modifier |
| OpenAI Image | HUMAN_REVIEW_REQUIRED | `113_` | pipeline PASS · asset REJECT | `gpt-image-1` | 1 | preflight live requis | `AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT` |
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

**Dernier STOP (`113_`) :** `READY_FOR_NEW_TEXT_FREE_IMAGE_RETRY_PREFLIGHT`

| Fait | Valeur |
|---|---|
| Pipeline technique | **PASS_REAL** (`108_`–`110_`) |
| Premier appel OpenAI | **consommé** · `gpt-image-1` · `low` · `1024×1024` |
| Coût | **1¢ provisional** · ledger **soldé** (`109_`) |
| Asset | `5d68ef64-…` · privé · checksum `c508e3e54f2ccac7-…` · `rejected` · `active=false` |
| Human Review | **REJECT** ×1 · motif : faux texte illisible (bouton) · `human.illegible_invented_button_text` |
| Retry historique | **0** |
| Politique provider | `no_text` · prompt `phase-11a-image-prompt-v2` |
| Overlay déterministe | **WIRED_DISABLED** · FP `fdfae63fe1c7d003-…` |
| Blocage `112_` | copy `screenText` / CTA encore dans le variant image → `BLOCKED_TEXT_LEAK_TO_PROVIDER_PROMPT` |
| Correction `113_` | **livrée** · `IMAGE_VARIANT_OVERLAY_COPY=REMOVED` · 0 OpenAI · 0 write Production |
| Second appel | **interdit** tant que le nouveau preflight n’est pas autorisé **et** passé |
| Ancien asset | **ne pas** modifier / réactiver / réutiliser · future clé nouvelle · `retry_of=null` |

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
| 11A / autre | `scene_package_set` | `bcec6c03` | 1 | actif (Production) | 11A wire | ne pas muter ; nouveau set `113_` est **mémoire only** |
| 11A / autre | `generation_plan` | `437ae89d` actif · `06f351ac` stale | 1 | — | 11A | plan `113_` mémoire only |
| 11A image | `quality_report` | `67cfed04` | 1 | actif | `110_` | preuve REJECT |
| 11A image | `production_result` | `4497d87c` r1 stale · `42e0c0a9` r2 actif | 2 | delivery blocked | `110_` | ne pas promouvoir |
| Motion | `quality_report` | `1516c218` | 1 | actif | `97_` | benchmark only |
| Motion | `production_result` | `4adc49b3` r1 stale · `4054a206` r2 actif | 2 | APPROVE | `97_` | pas Registry Production |
| Second jeu texte | `marketing_plan` `61138106` · `creative_concept` `d7d2dd93` · `video_script` `d540fdc5` | 1 | actifs (autre projet) | 10x | ne pas mélanger avec 11A |

Asset média image : `5d68ef64` · **rejected** · usage final **interdit**.  
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
| Ops distantes récentes | ledger 1¢ (`109_`) · HR REJECT (`110_`) · **aucune** cette phase docs |

---

## 9. Budget et ledger

Montants en **centimes USD**. Hard limit ≠ dépense réelle.

| | ¢ USD | Source |
|---|---|---|
| Hard limit | **274** | live `workspace_budget_policies` 2026-08-14 |
| Committed | **248** | ledger : 247 `committed` + 1 `provisional` (smoke image) |
| Reserved actif | **0** | `budget_reservations` : 0 `active` |
| Available | **26** | 274 − 248 − 0 |
| Dernière vérif | 2026-08-14 11:50 | MCP lecture seule |

Coûts réels connus par chantier : texte Directors (voir §4) · Motion **135** · image 11A **1** provisional.  
Réservations actives : **0**. Reconciliations ouvertes : **0**.  
Règle : toute dépense provider exige une Auth **dans le chat courant**.  
Prochain shortfall image : estimate **1** / réserve max **2** — tient dans 26¢ **si** Auth paid ultérieure.

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
| OpenAI | `image.text_to_image` | allowlist 11A | `gpt-image-1` low 1024 | HUMAN_REJECTED | réel ×1 | `108_` | 1 | 1 | disabled |
| fal | `video.motion_transfer` | Kling MC | benchmark | PASS_REAL benchmark | réel ×1 | `95_` | 1 | 135 | disabled |
| fal | I2V/T2V/image autres | préparés | — | PREPARED | fake `/director` | — | 0 réel `/director` | 0 | disabled |
| ElevenLabs | voice | legacy + port | `eleven_multilingual_v2` | PREPARED | fake V2 | — | 0 `/director` | 0 | disabled |
| Legacy `/api/generate/image` | image | historique | — | DEPRECATED / ≠ PASS | — | — | — | — | ne pas utiliser |

Restrictions : pas de retry/fallback 11A ; pas de Motion depuis le chemin image ; pas de fal compose comme fallback image.

---

## 12. Tests

| Check | Valeur | Nature | Date / phase |
|---|---|---|---|
| Unitaires | **1572/1572** | **dernière complète** | 2026-08-14 `113_` |
| Typecheck / lint / build | PASS (lint 0 error) | dernière complète | `113_` |
| migrations-static | PASS | dernière complète | `113_` |
| Secret scan diff `113_` | PASS | dernière complète | `113_` |
| Tests ciblés strip overlay | PASS (28+ cas) | dernière phase code | `113_` |
| DB integration | N/A Docker absent | **indisponible** 14 août | `113_` |
| pgTAP | 378 | **historique** | 11 août / 10A |
| Intégration DB | 33/33 | **historique** | 11 août / 10A |
| E2E Playwright `/director` | 15/15 ×2 | **historique** | Phase 9 |
| Fraîcheur living handover | à exécuter cette phase | tooling | ce fichier |

Ne pas présenter 378/33/E2E comme relancés aujourd’hui.

---

## 13. Git et déploiements

| | |
|---|---|
| Branche | `main` |
| HEAD / origin/main | `e4c3de3` · ahead 0 · behind 0 (à la vérif pré-commit docs) |
| Dernier commit applicatif | `e4c3de3` feat strip overlay copy |
| Dernier commit documentaire avant cette phase | `2fb569e` (STOP `112_`) |
| Fingerprint composition 11A | `c532c400334f5b22` — **un commit docs ne le change pas** |
| Runtime Production | **UNVERIFIED_THIS_PHASE** |
| Auto-deploy | push `main` peut déclencher un deploy — **observation lecture seule seulement** |
| Dernier Ready connu (docs) | smokes texte / preflight `7a67c77` — **ne pas** égaler à `e4c3de3` sans preuve Vercel |

---

## 14. P0, P1, décisions humaines

### P0 ouverts

- **Pas de second appel OpenAI Image** sans `AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT` **puis** une Auth paid distincte si le preflight passe.
- **Ne pas** réactiver / remplacer / rouvrir HR de l’asset `5d68ef64-…`.

### P1 ouverts

- Exécuter le preflight live text-free (no-provider) quand Auth.
- `17_` / `19_` stale (budget, migrations, jobs) — alignement docs ultérieur.
- Runtime Production SHA non vérifié.
- VHS-005 métriques/traces ; RLS distante non re-auditée le 14 août.
- Voice / I2V / merge-export réels non prouvés.
- MV-002 DEFERRED.

### P0/P1 fermés (extraits)

- Ledger 1¢ (`109_`) · HR REJECT (`110_`) · HARDEN typo (`111_`) · fuite overlay (`113_`) · restore drill (`78_`) · MT-005 applied (`82_`).

### Décisions humaines en attente

| Sujet | Choix | Impact | Auth requise | Interdit tant que manquante |
|---|---|---|---|---|
| Nouveau preflight text-free | lancer / attendre | prouve variant no-text en live HTTP | `AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT` | preflight live, flags, OpenAI |
| (plus tard) 2e génération image | paid once / refuser | 1¢–2¢ · nouvel asset | Auth paid **nouvelle** | tout submit OpenAI |
| MV-002 | rester DEFERRED / designer plus tard | coût fal | Auth Motion dédiée | fal / Registry |
| Ouvrir flags Production | non par défaut | runtime payant | Auth flags | Vercel write |

---

## 15. Ce qui reste à faire

### Immédiat

**`AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT`** — preflight live **sans** provider. Ne pas le lancer dans ce chat.

### Court terme

1. Preflight text-free live (no-provider).
2. Si PASS : Auth paid distincte pour **un** nouvel appel OpenAI Image (nouvelle idempotence).
3. Composition overlay déterministe toujours WIRED_DISABLED jusqu’à Auth compose.
4. Human Review sur le nouvel asset.
5. Décider ensuite I2V / suite média — pas Motion.

### Avant beta

Média `/director` au-delà d’un still ; UI opérable ; monitoring minimal ; consentement (Privacy Pack ≠ global) ; quotas ; support opérateur ; E2E au-delà des fakes Phase 9.

### Avant Production

Validations providers restantes ; export réel ; sécurité/RLS/rétention ; coûts et observabilité ; runbooks ; audit release (`CHECKLIST_RELEASE.md`).

Pas de délai calendaire.

---

## 16. Prochaine mission exacte (handoff)

```text
Contexte : VHS V2 · HEAD e4c3de3 · runtime Paid Media OFF · budget 274/248/0/26 ¢
Dernier verdict : READY_FOR_NEW_TEXT_FREE_IMAGE_RETRY_PREFLIGHT (113_)
Correction livrée : screenText/CTA hors variant image · overlay-leak-v1 · prompt v2 no-text
Blocage : NEW_LIVE_PREFLIGHT_REQUIRED = YES · 0 second OpenAI
Mission : uniquement AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT quand fournie
Auth présentes ici : aucune porte provider
Auth consommées : STRIP_OVERLAY (113_) · CREATE_CANONICAL_CURRENT_STATE (cette phase)
Interdit : OpenAI, fal, flags, Vercel write, Storage write, HR, retry, Motion, Legacy
Attendu : preflight no-provider · executable · copy absente · STOP · pas de génération
```

---

## 17. RESTART PROMPT FOR NEW CHAT

```text
Lis intégralement docs/Developer-Handover/CURRENT_STATE_AND_RESUME.md.
Lis ensuite 113_PHASE_11A_STRIP_OVERLAY_COPY_FROM_IMAGE_VARIANT.md et
112_PHASE_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT.md (et 110_ si tu touches l’asset).
Vérifie Git (HEAD, ahead/behind, working tree) et l’état runtime/flags avant toute action.
Une autorisation provider d’un chat précédent n’est JAMAIS réutilisable.
N’appelle aucun provider sans Auth explicite dans CE chat.
Reprend uniquement la prochaine mission du living handover
(aujourd’hui : AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT — seulement si fournie).
Produis un STOP avant toute nouvelle porte. Zéro OpenAI / fal / flag / deploy manuel.
```

---

## 18. Historique court (10 transitions)

| Date | Phase | Verdict | Commit | Coût ¢ | Effet Production | Porte suivante |
|---|---|---|---|---|---|---|
| 2026-08-14 | Canon living | CANONICAL_CURRENT_STATE_AND_RESUME_READY | `8128d9e` | 0 | docs only | text-free preflight |
| 2026-08-14 | `113_` strip overlay | READY_FOR_NEW_TEXT_FREE… | `e4c3de3` | 0 | code only | text-free preflight |
| 2026-08-14 | `112_` retry preflight | BLOCKED_TEXT_LEAK | `2fb569e` / src `20e8783` | 0 | 0 write | strip overlay |
| 2026-08-14 | `111_` harden typo | READY_FOR_TEXT_FREE… | `20e8783` | 0 | 0 write | retry preflight |
| 2026-08-14 | `110_` HR REJECT | PASS_TECHNICAL_ASSET_HUMAN_REJECTED | `e63ac68` | 0 | décision rejected | harden |
| 2026-08-14 | `109_` ledger 1¢ | PASS_LEDGER_RECONCILED | `e6198a1` | 1 commit | reserve 0 | HR |
| 2026-08-14 | `108_` paid image | RECONCILIATION_REQUIRED | runtime `7a67c77` | 1 réserve | 1 asset privé | reconcile |
| 2026-08-14 | `107_` live preflight | READY_FOR_11A_PAID_AUTH | `7a67c77` | 0 | 0 | paid smoke |
| 2026-08-12 | `97_` / `95_` MV-001 | PASS_WITH_HUMAN_APPROVAL | MT-013O/M | 135 | output privé APPROVE | Registry stays OFF |
| 2026-08-11 | `57_` Storyboard v4 | PASS | 10F-V4 | 5 | storyboard rev.1 | 11A média |

Détails : rapports numérotés. Ne pas réécrire.

---

## 19. Contrôle de fraîcheur

Script : `studio/scripts/check-current-state-freshness.mjs`  
Marqueurs machine : bloc `CURRENT_STATE_MARKERS` en tête de ce fichier.  
Échec si fichier absent, prochaine phase vide, budget/runtime/tests manquants, rapport introuvable, `00_README` sans index, secret-like, ou HEAD incohérent hors `pending commit`.
