# 75 — MT-013C Isolated Restore Target — STOP

**Date :** 11 août 2026  
**Auth reçue :** `AUTH_RESTORE_DRILL_ISOLATED_TARGET`  
**Opération :** **NON DÉMARRÉE** (STOP préflight)

```text
RESTORE_DRILL                 = BLOCKED_TARGET_REQUIRED  (inchangé — non levé)
MT013C_ATTEMPT                = STOPPED_SEPARATE_AUTH_REQUIRED
PRODUCTION_MUTATIONS          = 0
BRANCH_CREATED                = false
BACKUP_RESTORED               = false
MT005_REMOTE_APPLY            = NOT_ATTEMPTED
PROVIDER_CALLS                = 0
```

---

## 1. Identités vérifiées (préflight)

| Environnement | Preuve | Statut |
|---|---|---|
| **Production** | Nom `Virtual Humans Studio` · ref `ejdb…nmvi` · région `eu-west-3` · `ACTIVE_HEALTHY` · Postgres 17 | Confirmé MCP `get_project` |
| **Branches existantes** | `branches: []` | Confirmé MCP `list_branches` |
| **Migrations Production** | **29** (sans MT-005) | Confirmé MCP `list_migrations` (lecture) |
| **Cible isolée candidate** | **aucune** sélectionnable sans création | — |

Production ≠ toute future cible : prouvable **après** création d’un `project_ref` distinct. Aucune cible isolée n’existe encore.

---

## 2. STOP — motifs (clause Auth)

L’autorisation exigeait un STOP avant opération si :

1. coût non nul ;  
2. changement de plan ;  
3. nouveaux credentials non configurés ;  
4. identité de cible non prouvable sans ambiguïté.

### 2.1 Coût non nul (bloquant)

| Option | Coût MCP `get_cost` | Recurrence |
|---|---|---|
| Supabase **branch** | **$0.01344** | hourly |
| Nouveau **project** | **$10** | monthly |

→ **Coût ≠ 0** pour toute création de cible distante via les outils disponibles.  
→ STOP obligatoire — **autorisation séparée de dépense** requise avant `confirm_cost` / `create_branch` / `create_project`.

`confirm_cost` **n’a pas** été appelé. Aucune ressource créée.

### 2.2 Mécanisme « restore backup » non satisfait par `create_branch`

Description officielle MCP / docs Supabase Branching :

- la branche applique les **migrations** sur une base **fraîche** ;  
- **« production data will not carry over »** / branches **data-less** par design.

Donc `create_branch` **ne restaure pas** un backup Production existant (données).  
Même avec Auth coût, cela **ne prouverait pas** « backup réellement restauré » au sens MT-013B PASS.

### 2.3 Restore plateforme (PITR / backup file)

| Besoin | État |
|---|---|
| API MCP « list/restore backup » | **Absente** des outils configurés |
| Restore Dashboard PITR → nouveau projet | Nécessite UI + projet ($10/mois) + credentials projet |
| Dump Production → restore local Docker | ≠ « backup plateforme existant » ; credentials DB Production non utilisés ici ; hors Auth actuelle |

→ Mécanisme de restore du **backup existant** vers une cible isolée **non disponible** sans Auth/outils supplémentaires.

### 2.4 Lien runtime Production

Aucun lien Vercel/worker/provider créé (opération non démarrée). Local Docker existant **n’est pas** un restore du backup Production.

---

## 3. Autorisations respectées

| Autorisé | Fait |
|---|---|
| Créer/sélectionner cible isolée | **Non** — STOP coût |
| Restaurer backup sur cible | **Non** |
| Écritures restore sur isolé | **Non** |
| Contrôles intégrité | Préflight lecture Production uniquement |
| Rapport redacted | **Ce document** |

| Interdit | Respecté |
|---|---|
| Mutation Production | **Oui** (0 write) |
| Apply MT-005 distant | **Oui** |
| Deploy / Vercel | **Oui** |
| Provider / upload / budget / benchmark | **Oui** |
| Suppression cible | N/A |

---

## 4. Autorisation séparée exacte requise

Pour lever le STOP, une Auth humaine **distincte** doit couvrir explicitement au moins un chemin :

### Option A — Branche Supabase (coût horaire)

```text
AUTH_RESTORE_DRILL_BRANCH_SPEND
coût accepté     = $0.01344 / heure (compute branche)
parent           = Virtual Humans Studio (ejdb…nmvi)
nom branche      = mt013c-restore-drill
comprend         = création branche + frais horaires jusqu’à cleanup Auth séparée
limite           = ne prouve PAS le restore data du backup (schéma/migrations seulement)
note             = insuffisant seul pour RESTORE_DRILL=PASS au critère « backup restauré »
```

### Option B — Nouveau projet + restore PITR/backup Dashboard

```text
AUTH_RESTORE_DRILL_PROJECT_SPEND_AND_PITR
coût accepté     = $10 / mois (projet) + éventuels frais PITR
action           = créer projet temporaire OU restore backup/PITR vers projet dédié
interdit         = mutation Production ; apply MT-005 ; delete cible sans Auth
livrable         = ref cible ≠ Production + preuve restore data + checks MT-013B PASS
credentials      = accès Dashboard / Management pour restore plateforme
```

### Option C — Dump masqué / seed (si legal accepte ≠ backup plateforme)

```text
AUTH_RESTORE_DRILL_SANITIZED_DUMP
action           = export lecture seule Production (ou snapshot) → restore local/isolé
note             = ce n’est PAS le backup plateforme ; critères PASS à redéfinir
```

**Recommandation :** Option **B** pour satisfaire « backup réellement restauré » ; Option A utile seulement pour un drill **schéma** (insuffisant pour fermer `BACKUP_PRESENT_RESTORE_UNPROVEN` au sens data).

---

## 5. Suite

- `RESTORE_DRILL` reste `BLOCKED_TARGET_REQUIRED` (cible absente + STOP coût).  
- Privacy due diligence (`74_`) inchangée : `READY_FOR_HUMAN_DECISION`.  
- **MT-013C-PAID** (`76_`) : Auth $10 reçue — **STOP** (restore backup non disponible via MCP ; clone Dashboard requis).  
- Ne pas démarrer MT-005 remote apply ni benchmark.
