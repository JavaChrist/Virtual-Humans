# 79 — MT-013C Delete Isolated Target — STOP (outil absent)

**Date :** 11 août 2026  
**Auth reçue :** `AUTH_DELETE_ISOLATED_RESTORE_PROJECT_QMSH_QLNQ`  
**Opération :** **NON EXÉCUTÉE** — suppression définitive indisponible via MCP

```text
DELETE_ATTEMPT                = STOPPED_NO_MCP_DELETE_PROJECT  (agent)
# Suite humaine + vérif : voir 80_ DELETE_VERIFIED
TARGET_STILL_PRESENT          = false  (post-humain — 80_)
PRODUCTION_MUTATIONS          = 0
OTHER_PROJECTS_TOUCHED        = 0
PAUSE_USED_AS_SUBSTITUTE      = false
```

---

## 1. Préflight obligatoire — tous PASS

| Check | Résultat | Preuve |
|---|---|---|
| Cible exacte = `qmsh…qlnq` | **PASS** | Nom `VHS Restore Drill 2026-08-09` · ref `qmshhqdmsduixpjgqlnq` · `ACTIVE_HEALTHY` · `eu-west-3` |
| Cible ≠ Production `ejdb…nmvi` | **PASS** | `list_projects` : Production `Virtual Humans Studio` distincte · `ACTIVE_HEALTHY` |
| Rapport `78_` + preuves enregistrés | **PASS** | `78_MT013C_RESTORE_DRILL_PASS.md` présent (git `aa31a3e`) · `RESTORE_DRILL=PASS` |
| Aucun runtime / Vercel / webhook / worker / provider lié | **PASS** | Edge Functions cible `[]` ; repo studio référence uniquement Production `ejdb…` (settings, tests, guard) ; **aucune** occurrence de `qmshhqdmsduixpjgqlnq` hors docs handover |
| Rien d’unique nécessaire seulement sur la cible | **PASS** | Clone = copie drill ; Production intacte avec data courante ; preuves dans `78_` |

---

## 2. STOP — motif

Outils MCP Supabase disponibles pour projets :

| Outil | Rôle | Suffit pour Auth « suppression définitive » ? |
|---|---|---|
| `pause_project` | Pause (≠ delete) | **Non** — non utiliséé (substituer serait hors Auth) |
| `restore_project` | Unpause | N/A |
| `delete_branch` | Branche seulement | N/A (cible = projet) |
| **`delete_project`** | — | **Absent** du serveur MCP configuré |

CLI `supabase` : **non installé** sur la machine agent.  
→ Impossible d’exécuter une **suppression définitive** sous cette session sans Dashboard humain ou Management API + PAT (nouveau credential → hors Auth actuelle).

**Aucune** pause, **aucune** suppression partielle, **aucune** action Production.

---

## 3. Action humaine requise (une seule cible)

Dashboard (vérifier le ref dans l’URL) :

```text
https://supabase.com/dashboard/project/qmshhqdmsduixpjgqlnq/settings/general
```

1. Confirmer le titre **VHS Restore Drill 2026-08-09**.  
2. **Delete project** (libellé Dashboard) — **uniquement** ce projet.  
3. Ne pas toucher `ejdbksxaswhdtsudnmvi` / Virtual Humans Studio.  
4. Répondre ici : `DELETE_DONE` (ou coller confirmation).

L’agent vérifiera ensuite :

- `qmsh…qlnq` **absent** de `list_projects` ;  
- Production `ejdb…nmvi` toujours `ACTIVE_HEALTHY` ;  
- aucune autre ressource manquante vs inventaire préflight ;  
- facturation cible arrêtée (inférence : projet absent ; pas d’accès facture).

---

## 4. Auth respectées

| Interdit | Respecté |
|---|---|
| Supprimer / suspendre / modifier Production | **Oui** (0 action) |
| Toucher tout autre projet | **Oui** |
| Substituer pause sans Auth | **Oui** (pause non appelée) |

| Autorisé | Statut |
|---|---|
| Une suppression de `qmsh…qlnq` | **Bloquée outil** — à faire humain Dashboard |
| Vérifs préflight | **Faites** |

---

## 5. Suite

1. Humain : delete Dashboard **fait**.  
2. Agent : post-vérif **PASS** → [`80_MT013C_DELETE_TARGET_VERIFIED.md`](./80_MT013C_DELETE_TARGET_VERIFIED.md).  
3. Ne pas démarrer MT-005 / paid sans Auth.
