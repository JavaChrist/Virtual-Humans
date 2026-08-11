# 78 — MT-013C Restore Drill — PASS

**Date :** 11 août 2026  
**Clone :** humain (Dashboard « Restore to new project »)  
**Vérification agent :** lecture seule MCP + SQL redacted sur cible · Production lecture seule comparative

```text
RESTORE_DRILL                 = PASS
PRIVACY_DUE_DILIGENCE         = ACCEPTED_LIMITED_MV001  (post — voir 81_)
P1_BACKUP_RESTORE             = CLOSED_RESTORE_PROVEN
PRODUCTION_MUTATIONS          = 0
MT005_REMOTE_APPLY            = NOT_APPLIED
PROVIDER_CALLS                = 0
TARGET_DELETED                = false
```

---

## 1. Identités (prouvées distinctes)

| Rôle | Nom | Ref (redacted) | Région | Status | created_at (UTC) |
|---|---|---|---|---|---|
| **Production** | Virtual Humans Studio | `ejdb…nmvi` | `eu-west-3` | `ACTIVE_HEALTHY` | 2026-07-23 |
| **Cible isolée** | VHS Restore Drill 2026-08-09 | `qmsh…qlnq` | `eu-west-3` | `ACTIVE_HEALTHY` | 2026-08-11T19:40:26Z |

`project_ref` cible **≠** Production. Org = JavaChrist (pro).

---

## 2. Paramètres clone (déclarés humain + cohérents devis `77_`)

| Champ | Valeur |
|---|---|
| Clone créé | **OUI** |
| Backup source | **09 Aug 2026 05:24:51 UTC** |
| Région | `eu-west-3` |
| Coût affiché | **$10.18 / mois** (compute $9.68 + disk $0.5) |
| Méthode | Dashboard → Restore to new project (BETA) → Continue |

Postgres image : Production `17.6.1.147` · cible `17.6.1.155` (écart plateforme normal post-clone ; non bloquant).

---

## 3. Critères PASS

| Critère | Résultat | Preuve |
|---|---|---|
| Cible isolée ≠ Production | **OUI** | refs `qmsh…qlnq` ≠ `ejdb…nmvi` |
| Backup réellement restauré | **OUI** | data non vide sur cible ; counts &lt; Production (snapshot 09 Aug vs live 11 Aug) |
| Schéma public | **OUI** | 22 tables des deux côtés |
| Historique migrations | **OUI** | **29** versions identiques ; dernière `vhs_134_…` ; **sans** MT-005 |
| Fonctions public | **OUI** | **52** des deux côtés |
| Extensions | **OUI** | **5** des deux côtés |
| RLS enabled | **OUI** | **22/22** tables public `relrowsecurity` sur cible |
| Policies `pg_policy` | **0** cible = **0** Production | Parité (pas de régression restore) |
| Tables critiques lisibles | **OUI** | counts SQL §4 |
| Edge Functions cible | **[]** | attendu (non copiées par clone) |
| Mutation Production | **0** | agent : lectures seules |
| Cible non supprimée | **OUI** | pas d’Auth destructive |

---

## 4. Counts redacted (SQL `count(*)`)

| Table | Cible (`qmsh…`) | Production (`ejdb…`) | Lecture |
|---|---:|---:|---|
| workspaces | 1 | 1 | match |
| video_projects | 1 | 3 | cible ≤ prod (backup plus ancien) |
| project_artifacts | 4 | 11 | idem |
| director_runs | 13 | 23 | idem |
| cost_ledger | 33 | 59 | idem |
| budget_reservations | 13 | 22 | idem |
| audit_log | 5 | 15 | idem |
| production_jobs | 0 | 0 | match |

Aucune donnée sensible (contenu / PII / secrets) extraite — counts uniquement.

> Note : `list_tables` MCP affichait `rows: 0` juste après clone (stats stale) ; les `count(*)` SQL sont la source de vérité.

---

## 5. Migrations (les deux environnements)

29 versions, de `20260723203021_vh_studio_init_…` à `20260807213803_vhs_134_legacy_art_timeout_retry`.  
**MT-005** (`20260811180000_…`) : **absent** Production **et** cible — conforme (non appliqué).

---

## 6. Isolation runtime

| Lien | Statut |
|---|---|
| Vercel / domaine app | **non lié** (pas de modification Vercel) |
| Webhooks / workers / providers | **non configurés** par cette phase |
| Edge Functions | liste vide sur cible |
| Storage objects | non copiés par le produit clone (doc Supabase) — hors critère DB restore |

---

## 7. P1 / suite

- P1 `BACKUP_PRESENT_RESTORE_UNPROVEN` → **fermé** (`RESTORE_PROVEN` via drill Dashboard + vérif `78_`).  
- `RESTORE_DRILL = PASS` **n’autorise pas** MT-005 remote, deploy, provider, ni benchmark.  
- Privacy (`74_`) reste `READY_FOR_HUMAN_DECISION`.  
- Suppression cible `qmsh…qlnq` : **Auth destructive séparée** uniquement.  
- Coût récurrent ~**$10.18/mois** jusqu’à delete/pause autorisé.
