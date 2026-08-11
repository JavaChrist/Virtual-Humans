# 77 — MT-013C-DASHBOARD-QUOTE — Préflight devis uniquement

**Date :** 11 août 2026  
**Auth reçue :** `AUTH_RESTORE_DASHBOARD_QUOTE_ONLY`  
**Exécutant :** **humain** (Dashboard) — l’agent **ne clique pas** et **ne confirme pas**

```text
RESTORE_DRILL                 = BLOCKED_TARGET_REQUIRED  (inchangé)
MT013C_DASHBOARD_QUOTE        = QUOTE_CAPTURED
CLONE_CONFIRMED               = false
PROJECT_CREATED               = false
BACKUP_RESTORED               = false
PRODUCTION_MUTATIONS          = 0
NEW_CREDENTIALS               = NOT_EXTRACTED
COST_SPENT_USD                = 0
QUOTE_TOTAL_MONTHLY_USD       = 10.18
WITHIN_PRIOR_10_USD_CAP       = no
READY_FOR_CLONE_AUTH          = yes  (Auth distincte requise — plafond ≥ 10.18)
```

---

## 1. Périmètre Auth (strict)

| Autorisé | Interdit |
|---|---|
| Ouvrir Dashboard Production | Cliquer **Continue** (confirmation clone) |
| Naviguer jusqu’à l’écran de **devis / confirmation** | Créer le clone / lancer la restauration |
| Relever coût, région, backup, frais additionnels | Muter Production (PITR in-place, apply migrations, etc.) |
| Capturer / noter (redacted) puis **Cancel** | Saisir ou extraire nouveaux credentials |
| Remplir §5 de ce document | Lier Vercel / runtime / webhooks / workers / providers |

**STOP obligatoire** devant la modale *Confirm restore to a new project* — cliquer **Cancel**, pas **Continue**.

---

## 2. Identités

| Rôle | Nom | Ref (redacted) | Région |
|---|---|---|---|
| **Source** | Virtual Humans Studio | `ejdb…nmvi` | `eu-west-3` |
| **Org affichée** | JavaChrist | `narku…flqb` | — |
| **Cible clone** | *non créée* | — | `eu-west-3` (affichée) |

---

## 3. Preuve listes backups (capture humaine)

Onglet **Restore to new project (BETA)** — backups **COMPLETED** visibles :

| Backup (UTC) | Statut |
|---|---|
| 09 Aug 2026 05:24:51 (+0000) | COMPLETED |
| 08 Aug 2026 05:26:09 (+0000) | COMPLETED |
| 07 Aug 2026 05:28:27 (+0000) | COMPLETED |
| 06 Aug 2026 05:27:14 (+0000) | COMPLETED |
| 05 Aug 2026 05:24:30 (+0000) | COMPLETED |
| 04 Aug 2026 05:26:45 (+0000) | COMPLETED |

La modale de coût **n’imprime pas** l’horodatage du backup choisi. À préciser à la prochaine Auth (recommandé : **09 Aug 2026 05:24:51 UTC** = plus récent).

---

## 4. Capture devis (figée depuis captures Dashboard)

**Statut capture :** `QUOTE_CAPTURED`  
**Relevé :** 11 août 2026 (soir, local)  
**Action requise si modale encore ouverte :** **Cancel** — ne pas cliquer **Continue**.

| Champ | Valeur relevée | Notes |
|---|---|---|
| Modale | *Confirm restore to a new project* | « create a new project and restore your database » |
| Org | JavaChrist | inchangée |
| Région cible | `eu-west-3` | = Production |
| Transféré | schéma, data+indexes, roles/permissions/users | doc plateforme |
| Non transféré (manuel) | Storage, Edge Functions, Auth settings & API keys, extensions/settings, read replicas | |
| Compute | même taille que source | montant $9.68 / mois |
| Disk | **1.5×** plus grand que source | montant $0.5 / mois |
| Frais one-shot | **aucun affiché** | — |
| Add-ons PITR / IPv4 | **aucun listé** dans la modale | — |
| **Total mensuel** | **$10.18** | compute 9.68 + disk 0.5 |
| Bouton final | **Continue** (vert) | **NE PAS CLIQUER** — **Cancel** |
| Captures | fournies en chat (privées) | non commitées dans le repo |

### Verdict

```text
QUOTE_TOTAL_MONTHLY_USD   = 10.18
QUOTE_TOTAL_ONESHOT_USD   = 0 (non affiché)
WITHIN_PRIOR_10_USD_CAP   = no   (10.18 > 10.00 de AUTH …_MAX_10_USD)
READY_FOR_CLONE_AUTH      = yes  (après Auth plafond ≥ 10.18 + backup explicite)
```

Le plafond précédent **10.00 USD** est **insuffisant** pour ce devis. Une Auth clone doit accepter **au moins 10.18 USD / mois** (ou un plafond supérieur explicite).

---

## 5. Auth suivante proposée (ne pas exécuter sans ce texte)

```text
AUTH_RESTORE_DRILL_DASHBOARD_CLONE_MAX_10_18_USD
source           = Virtual Humans Studio (ejdb…nmvi) · eu-west-3 · org JavaChrist
backup           = 09 Aug 2026 05:24:51 (+0000)   # ou autre COMPLETED listé, explicite
action           = Dashboard → Restore to new project → Restore sur ce backup
                   → modale Confirm → Continue  (une seule fois)
coût accepté     = Additional Monthly Compute $9.68
                   + Additional Monthly Disk $0.5
                   = Total $10.18 / mois
                   (disque 1.5× source ; même compute)
interdit         = mutation Production hors ce flux clone ;
                   apply MT-005 Production ; deploy ; provider ; médias ;
                   lier Vercel/runtime/webhooks/workers à la cible ;
                   seconde cible ; dépassement au-delà de $10.18/mois affiché
post-clone       = communiquer project_ref cible (≠ ejdb…nmvi)
agent autorisé   = lectures + contrôles redacted UNIQUEMENT sur la cible
                   (schéma, migrations, RLS, fonctions, tables critiques, counts non sensibles)
delete cible     = Auth destructive séparée uniquement (pas d’auto-delete)
```

---

## 6. Autorisations respectées (agent)

| Action | Statut |
|---|---|
| `confirm_cost` / `create_project` / `restore_project` | **Non appelés** |
| Mutation Production | **0** |
| Extraction credentials | **Non** |
| Clone confirmé (Continue) | **Non** (Auth quote only) |
| Rapport / capture | **Ce document** |

---

## 7. Suite

1. Si la modale est encore ouverte → **Cancel**.  
2. Attendre Auth clone au plafond **$10.18/mois** (texte §5).  
3. Ne pas démarrer MT-005 / deploy / provider / benchmark.
