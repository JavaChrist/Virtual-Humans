# 80 — MT-013C Delete Isolated Target — VERIFIED

**Date :** 11 août 2026  
**Auth :** `AUTH_DELETE_ISOLATED_RESTORE_PROJECT_QMSH_QLNQ`  
**Exécution delete :** **humain** (Dashboard)  
**Vérification agent :** MCP `list_projects` post-delete

```text
DELETE_ATTEMPT                = HUMAN_DASHBOARD_COMPLETED
DELETE_VERIFIED               = true
TARGET_ABSENT                 = true
PRODUCTION_STATUS             = ACTIVE_HEALTHY
OTHER_PROJECTS_REMOVED        = false
PRODUCTION_MUTATIONS          = 0
RECURRING_COST_TARGET         = STOPPED  (projet absent → plus facturé)
RESTORE_DRILL                 = PASS  (preuves 78_ conservées)
```

---

## 1. Cible

| Champ | Avant | Après |
|---|---|---|
| Nom | VHS Restore Drill 2026-08-09 | **absent** |
| Ref | `qmshhqdmsduixpjgqlnq` | **absent** de `list_projects` |
| Région | `eu-west-3` | — |

---

## 2. Production (inchangée)

| Champ | Valeur |
|---|---|
| Nom | Virtual Humans Studio |
| Ref | `ejdbksxaswhdtsudnmvi` |
| Status | **ACTIVE_HEALTHY** |
| Région | `eu-west-3` |

---

## 3. Inventaire org — aucune autre suppression

Projets encore présents (échantillon / totaux) : **15** projets listés après delete (était **16** avec la cible).  
Conservés notamment : Virtual Humans Studio, Tai-Chi AI Coach, et les autres projets org préexistants.  
**Seul** `qmsh…qlnq` a disparu.

---

## 4. Coût

Facturation récurrente ~**$10.18/mois** de la cible : **arrêtée** par absence du projet (inférence plateforme ; pas d’accès facture API ici).  
Prorata éventuel jusqu’à l’heure de delete : hors contrôle agent.

---

## 5. Preuves restore

Rapport [`78_MT013C_RESTORE_DRILL_PASS.md`](./78_MT013C_RESTORE_DRILL_PASS.md) **conservé** dans le repo.  
`RESTORE_DRILL = PASS` et P1 restore **fermé** restent valides.

---

## 6. Suite

- Privacy (`74_`) : `READY_FOR_HUMAN_DECISION`.  
- MT-005 remote / deploy / paid / benchmark : **non autorisés** sans Auth distincte.
