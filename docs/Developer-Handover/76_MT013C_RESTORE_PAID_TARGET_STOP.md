# 76 — MT-013C-RESTORE-PAID-TARGET — STOP

**Date :** 11 août 2026  
**Auth reçue :** `AUTH_RESTORE_DRILL_PAID_ISOLATED_PROJECT_MAX_10_USD`  
**Opération :** **NON DÉMARRÉE** (STOP préflight)

```text
RESTORE_DRILL                 = BLOCKED_TARGET_REQUIRED  (inchangé)
MT013C_PAID_ATTEMPT           = STOPPED_RESTORE_NOT_AVAILABLE_VIA_TOOLS
PRODUCTION_MUTATIONS          = 0
PROJECT_CREATED               = false
CONFIRM_COST_CALLED           = false
BACKUP_RESTORED               = false
MT005_REMOTE_APPLY            = NOT_ATTEMPTED
PROVIDER_CALLS                = 0
COST_SPENT_USD                = 0
```

---

## 1. Identités vérifiées (préflight lecture seule)

| Élément | Preuve | Statut |
|---|---|---|
| **Organisation** | id `narku…flqb` · nom `JavaChrist` · plan `pro` | Confirmé MCP `get_organization` |
| **Production** | Nom `Virtual Humans Studio` · ref `ejdb…nmvi` · région `eu-west-3` · `ACTIVE_HEALTHY` · Postgres 17 | Confirmé MCP `get_project` / `list_projects` |
| **Cible isolée existante** | Aucune dédiée restore drill dans l’org | Confirmé inventaire projets |
| **Branches Production** | non requises pour ce chemin « projet » | — |

Production ≠ toute future cible : prouvable seulement après création d’un `project_ref` distinct. **Aucune création effectuée.**

---

## 2. Coût affiché (plafond 10 USD)

| Option MCP | Coût `get_cost` | vs plafond Auth |
|---|---|---|
| Nouveau **project** (création vide) | **$10 / mois** | **≤ 10 USD** (égal au plafond) |

`confirm_cost` **n’a pas** été appelé. Aucune ressource créée. Aucun engagement facturé pour ce drill.

**Cependant :** le plafond « création projet vide $10 » **ne couvre pas** le coût réel du seul mécanisme plateforme qui restaure un backup vers une nouvelle cible (voir §3–4).

---

## 3. STOP — restauration du backup existant non disponible sur le chemin autorisé

### 3.1 Ce que l’Auth exige

Créer **un** projet isolé **et** y **restaurer le backup plateforme** de Production, avec contrôles d’intégrité.

### 3.2 Outils MCP disponibles vs besoin

| Outil / flux | Rôle réel | Restaure le backup Production vers une cible isolée ? |
|---|---|---|
| `create_project` | Crée un projet **vide** (migrations absentes / data absentes) | **Non** |
| `restore_project` | **Unpause** un projet paused (`POST …/restore`) | **Non** (≠ restore backup) |
| `create_branch` | Branche **data-less** | **Non** (déjà écarté en `75_`) |
| Restore PITR API `…/backups/restore-pitr` | Restaure **sur le même** `project_ref` | **Interdit** — muterait Production |
| Liste backups Management API | Lecture backups source | Nécessite **PAT** ; ne crée pas la cible |
| **Restore to a New Project** (Dashboard) | Clone depuis backups source → **crée automatiquement** un nouveau projet + data | Oui, mais **hors MCP** ; coût = **ressources miroir** source |

→ Sur le chemin automatisable MCP sous cette Auth : **la restauration du backup existant n’est pas réellement disponible** sur une cible créée via `create_project`.

Clause Auth : *« Si la restauration du backup existant n’est pas réellement disponible sur cette cible … STOP avant l’opération. »*  
→ **STOP obligatoire** avant `confirm_cost` / `create_project`.

### 3.3 Pourquoi ne pas créer quand même le projet à 10 USD

Créer un projet vide consommerait le plafond **sans** permettre le restore plateforme du backup. Cela violerait l’intention de l’Auth (restore + vérification) et gasillerait le budget autorisé.

---

## 4. STOP complémentaires (indépendants)

### 4.1 Coût du vrai clone non prouvé ≤ 10 USD

Doc officielle [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project) :

- le nouveau projet **réplique compute, disque, SSL, network restrictions** de la source ;
- un **aperçu de coûts** est présenté **dans le Dashboard** avant lancement ;
- frais mensuels = ressources miroir (peut dépasser le Nano / $10 `get_cost`).

Sans cet aperçu Dashboard, **impossible de prouver** que le clone reste ≤ **10 USD**.  
Créer via MCP à $10 puis espérer coller un backup après coup **n’est pas** le flux plateforme documenté.

### 4.2 Credentials / surface humaine

| Besoin | État |
|---|---|
| MCP OAuth existant | Suffisant pour `get_cost` / `create_project` / lectures |
| Management API PAT (`SUPABASE_ACCESS_TOKEN`) pour lister backups / automatiser | **Non présent** dans la config studio connue ; constituerait un **nouveau credential** |
| Action Dashboard « Restore to a New Project » | **Humaine** ; hors outils agent ; coût miroir non confirmé ici |

Clause Auth : *« si des credentials nouveaux sont nécessaires … STOP »*.  
→ Même un contournement Management API PAT déclencherait STOP.

### 4.3 Lien runtime

Aucun lien Vercel / webhook / worker / provider créé (opération non démarrée).

---

## 5. Autorisations respectées

| Autorisé | Fait |
|---|---|
| Confirmer coût ≤ 10 USD | **Préflight seulement** — $10/mois pour projet vide ; clone miroir **non confirmable** ≤ 10 |
| Créer un projet isolé | **Non** — STOP |
| Restaurer backup plateforme | **Non** — mécanisme indisponible via outils |
| Écritures sur cible | **Non** |
| Contrôles intégrité | Préflight lecture Production/org uniquement |
| Rapport redacted | **Ce document** |

| Interdit | Respecté |
|---|---|
| Mutation Production | **Oui** (0 write) |
| Lien Vercel/runtime/webhooks/workers/providers | **Oui** |
| Apply MT-005 Production | **Oui** |
| Provider / média / deploy / budget app / benchmark | **Oui** |
| Seconde cible | **Oui** (0 cible) |
| Dépassement 10 USD | **Oui** ($0 dépensé) |
| Suppression auto cible | N/A |

---

## 6. Auth suivante exacte requise

Pour lever ce STOP, une Auth humaine **distincte** doit couvrir le chemin Dashboard réel :

```text
AUTH_RESTORE_DRILL_DASHBOARD_CLONE_ACCEPT_MIRROR_COST
action           = humain : Dashboard Production → Database → Backups
                   → onglet "Restore to a New Project"
                   → sélectionner backup plateforme
                   → accepter l’aperçu de coût affiché (même si > 10 USD)
                   → lancer le clone
post-clone       = communiquer le project_ref cible (≠ ejdb…nmvi)
agent autorisé   = lectures + contrôles redacted UNIQUEMENT sur ce ref
                   (schéma, migrations, RLS, fonctions, tables critiques, counts non sensibles)
interdit         = mutation Production ; apply MT-005 ; deploy ; provider ;
                   delete cible sans Auth destructive séparée ;
                   lier Vercel/runtime à la cible
plafond          = montant EXPLICITE de l’aperçu Dashboard (à coller dans l’Auth)
```

Variante si le Dashboard affiche **≤ 10 USD** pour le clone miroir :

```text
AUTH_RESTORE_DRILL_DASHBOARD_CLONE_MAX_10_USD_CONFIRMED
preuve           = capture / citation de l’aperçu coût Dashboard ≤ 10 USD
sinon            = même périmètre post-clone que ci-dessus
```

**Ne pas** autoriser « créer projet vide MCP + dump manuel » sous le label « backup plateforme » sans redéfinition explicite du critère PASS.

---

## 7. Suite

- `RESTORE_DRILL` reste `BLOCKED_TARGET_REQUIRED`.  
- P1 `BACKUP_PRESENT_RESTORE_UNPROVEN` **inchangé**.  
- Privacy (`74_`) inchangée : `READY_FOR_HUMAN_DECISION`.  
- Ne pas démarrer MT-005 remote apply ni benchmark.  
- Attendre Auth Dashboard clone + plafond miroir explicite (ou preuve ≤ 10 USD) avant toute création.
