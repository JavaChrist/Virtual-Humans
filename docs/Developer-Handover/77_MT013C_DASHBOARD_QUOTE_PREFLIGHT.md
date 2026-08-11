# 77 — MT-013C-DASHBOARD-QUOTE — Préflight devis uniquement

**Date :** 11 août 2026  
**Auth reçue :** `AUTH_RESTORE_DASHBOARD_QUOTE_ONLY`  
**Exécutant :** **humain** (Dashboard) — l’agent **ne clique pas** et **ne confirme pas**

```text
RESTORE_DRILL                 = BLOCKED_TARGET_REQUIRED  (inchangé)
MT013C_DASHBOARD_QUOTE        = AWAITING_HUMAN_CAPTURE
CLONE_CONFIRMED               = false
PROJECT_CREATED               = false
BACKUP_RESTORED               = false
PRODUCTION_MUTATIONS          = 0
NEW_CREDENTIALS               = NOT_EXTRACTED
COST_SPENT_USD                = 0
```

---

## 1. Périmètre Auth (strict)

| Autorisé | Interdit |
|---|---|
| Ouvrir Dashboard Production | Cliquer le bouton **final de confirmation** du clone |
| Naviguer jusqu’à l’écran de **devis / confirmation** | Créer le clone / lancer la restauration |
| Relever coût, région, backup, frais additionnels | Muter Production (PITR in-place, apply migrations, etc.) |
| Capturer / noter (redacted) puis **fermer / Cancel** | Saisir ou extraire nouveaux credentials (DB password, API keys, PAT) |
| Remplir §5 de ce document | Lier Vercel / runtime / webhooks / workers / providers |

**STOP obligatoire** dès que l’écran final de confirmation est visible — **avant** tout bouton du type *Confirm / Restore / Create project / I understand*.

---

## 2. Identités (ne pas confondre)

| Rôle | Nom | Ref (redacted) | Région |
|---|---|---|---|
| **Source uniquement** | Virtual Humans Studio | `ejdb…nmvi` | `eu-west-3` |
| **Cible clone** | *ne doit pas exister encore* | — | attendue = même région source |

URL de départ (source) :

```text
https://supabase.com/dashboard/project/ejdbksxaswhdtsudnmvi/database/backups/restore-to-new-project
```

Si la navigation par menu est préférée :

1. Org **JavaChrist** → projet **Virtual Humans Studio** (vérifier ref `ejdb…nmvi`).  
2. **Database** → **Backups**.  
3. Onglet **Restore to a New Project** (pas *Scheduled*, pas *PITR* « restore this project »).

---

## 3. Runbook humain (STOP avant Confirm)

1. Se connecter au Dashboard Supabase (compte déjà autorisé — **pas** de nouveau PAT).  
2. Ouvrir l’URL / navigation §2 — **uniquement** le projet Production ci-dessus.  
3. Vérifier la liste des backups disponibles (dates / types).  
4. Sélectionner **un** backup plateforme (noter date/heure UTC + type daily/physical).  
   - Si PITR proposé : **ne pas** lancer de restore in-place sur Production ; rester sur « Restore to a New Project ».  
5. Avancer jusqu’à l’écran qui affiche le **récapitulatif de coût** (compute miroir, disque, add-ons éventuels).  
6. **STOP** — ne pas confirmer.  
7. Remplir §5 (chiffres exacts affichés).  
8. **Cancel / fermer** la modale ou quitter la page sans confirmer.  
9. Coller les valeurs dans ce fichier (ou message agent) — **redacted** si secrets visibles (ne pas copier mots de passe / keys).

Checklist anti-erreur :

- [ ] Projet ouvert = Production `ejdb…nmvi` (pas un autre projet de l’org)  
- [ ] Onglet = **Restore to a New Project**  
- [ ] Aucun clic Confirm / Restore  
- [ ] Aucune page API keys / Database password ouverte pour extraction  
- [ ] Aucune mutation Production (pas de restore in-place, pas de pause, pas d’add-on)

---

## 4. Ce que l’agent fera après capture

Une fois §5 rempli (par vous) :

1. Documenter le devis dans le handover (compléter ce fichier → statut `QUOTE_CAPTURED`).  
2. Comparer au plafond historique 10 USD (`76_`).  
3. Proposer le texte d’Auth **suivante** exacte (clone payant ou STOP si coût inacceptable) — **sans** lancer le clone.

L’agent **n’exécutera pas** le clone tant qu’une Auth distincte du type `AUTH_RESTORE_DRILL_DASHBOARD_CLONE_…` n’est pas reçue.

---

## 5. Capture devis (à remplir par l’humain)

**Statut capture :** `PENDING`

| Champ | Valeur relevée | Notes |
|---|---|---|
| Date/heure du relevé (local) | _à remplir_ | |
| Backup sélectionné (date/heure UTC) | _à remplir_ | |
| Type backup (daily physical / PITR point) | _à remplir_ | |
| Région cible affichée | _à remplir_ | attendu `eu-west-3` |
| Compute instance (taille) | _à remplir_ | miroir source |
| Coût compute / mois (USD) | _à remplir_ | |
| Disk size / type / IOPS | _à remplir_ | |
| Coût disque / mois (USD) | _à remplir_ | si séparé |
| Frais one-shot / restore fee | _à remplir_ | 0 si absent |
| Add-ons listés (PITR, IPv4, …) | _à remplir_ | |
| **Total mensuel affiché (USD)** | _à remplir_ | **chiffre clé** |
| **Total one-shot affiché (USD)** | _à remplir_ | si présent |
| Bouton final visible (libellé exact) | _à remplir_ | **ne pas cliquer** |
| Capture écran jointe | non / oui (chemin local privé) | ne pas committer de secrets |

### Verdict préliminaire (après remplissage)

```text
QUOTE_TOTAL_MONTHLY_USD   = ?
QUOTE_TOTAL_ONESHOT_USD   = ?
WITHIN_PRIOR_10_USD_CAP   = yes | no | unknown
READY_FOR_CLONE_AUTH      = no  (tant que Auth clone distincte absente)
```

---

## 6. Autorisations respectées (agent)

| Action | Statut |
|---|---|
| `confirm_cost` / `create_project` / `restore_project` | **Non appelés** |
| Mutation Production | **0** |
| Extraction credentials | **Non** |
| Clone confirmé | **Non** |
| Rapport / runbook | **Ce document** |

---

## 7. Suite

1. **Vous** : exécuter §3 → remplir §5 → Cancel.  
2. **Agent** : figer `QUOTE_CAPTURED` + Auth clone proposée.  
3. Ne pas démarrer MT-005 / deploy / provider / benchmark.
