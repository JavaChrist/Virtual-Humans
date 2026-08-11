# 74 — MT-013B Restore Drill & Privacy Due Diligence

**Date :** 11 août 2026  
**Base :** HEAD `b7c74ab` · suite de `73_MT013A`  
**Périmètre :** preuves + verdicts séparés — **aucun** apply MT-005 distant · **aucun** benchmark · **0** appel fal

```text
RESTORE_DRILL            = PASS  (levé — voir 78_ ; historique ci-dessous = état MT-013B)
PRIVACY_DUE_DILIGENCE    = READY_FOR_HUMAN_DECISION
MV001_NOT_EXECUTED
REAL_PROVIDER_CALLS      = 0
REMOTE_MIGRATION         = NOT_APPLIED
PAID_BENCHMARK           = NOT_AUTHORIZED
Production mutations     = 0
```

> **Mise à jour 11 août 2026 :** restore drill exécuté + vérifié → **`RESTORE_DRILL = PASS`** dans [`78_MT013C_RESTORE_DRILL_PASS.md`](./78_MT013C_RESTORE_DRILL_PASS.md). Les sections §2 ci-dessous restent le **journal** de l’évaluation MT-013B (blocage initial).

---

## 1. Verdicts séparés (obligatoires)

| Domaine | Verdict |
|---|---|
| **RESTORE_DRILL** | `PASS` (voir `78_`) — était `BLOCKED_TARGET_REQUIRED` en MT-013B |
| **PRIVACY_DUE_DILIGENCE** | `READY_FOR_HUMAN_DECISION` |

Ces verdicts **ne sont pas fusionnés**. Un PASS privacy n’autorise pas le restore ; un restore futur PASS n’autorise pas MT-005 ni le paid call.

---

## 2. Restore drill — preuve d’évaluation (non exécuté)

### 2.1 Constations techniques (lecture seule)

| Check | Résultat | Preuve |
|---|---|---|
| Projet Production identifié | Virtual Humans Studio · ref `ejdb…nmvi` · `eu-west-3` · `ACTIVE_HEALTHY` | MCP `get_project` 2026-08-11 |
| Branches isolées existantes | **0** (`branches: []`) | MCP `list_branches` |
| Migrations Production | **29** (dernière `vhs_134_…`) — **sans** `20260811180000` MT-005 | MCP `list_migrations` |
| Migrations locales | **30** (inclut MT-005) | `studio/supabase/migrations/` |
| Backup réellement restauré | **NON** — aucun restore lancé | — |
| Checksum / intégrité restore | **NON démontré** | — |
| Schéma restauré vérifié sur cible isolée | **NON** (pas de cible) | — |
| Tables critiques lisibles sur cible isolée | **NON** | — |
| Mutation Production | **0** (lecture MCP uniquement) | — |
| Nettoyage destructif | **non effectué** (rien à nettoyer) | — |

### 2.2 Critères PASS — statut

| Critère PASS requis | Atteint ? |
|---|---|
| Cible isolée vérifiée ≠ Production | **NON** — aucune branche / projet temporaire dédié |
| Backup réellement restauré (pas seulement présent) | **NON** |
| Checksum/intégrité ou preuve équivalente | **NON** |
| Schéma restauré vérifié | **NON** |
| Historique migrations constaté sur cible | **NON** (constaté sur Production en lecture : 29) |
| Tables critiques lisibles | **NON** sur isolé |
| Aucune mutation Production | **OUI** (cette phase) |
| Nettoyage destructif non fait sans Auth | **OUI** (N/A) |

### 2.3 Pourquoi `BLOCKED_TARGET_REQUIRED`

- Aucune branche Supabase isolée n’existe sur le projet Production.  
- Créer une branche / projet temporaire constitue une **écriture distante / ressource facturable** et exige une Auth humaine explicite (hors périmètre auto).  
- Sans cible isolée, un restore ne peut **pas** être prouvé sans risque Production.  
- La présence d’un mécanisme backup plateforme reste **UNVERIFIED** (pas d’API backup listée via MCP ; Dashboard non interrogé ici).

**Non retenu :**

| Verdict alternatif | Pourquoi non |
|---|---|
| `PASS` | Critères restore non démontrés |
| `BLOCKED_CREDENTIALS_REQUIRED` | MCP org accessible en lecture ; blocage principal = cible absente |
| `BLOCKED_BACKUP_UNAVAILABLE` | Backup non prouvé indisponible — simplement non inventorié ; secondaire |
| `FAIL` | Aucune tentative restore n’a échoué — elle n’a pas démarré |

### 2.4 Autorisation humaine exacte pour lever le blocage

```text
AUTH_RESTORE_DRILL_ISOLATED_TARGET
action       = créer branche Supabase OU projet temporaire dédié restore-drill
parent       = Virtual Humans Studio Production (lecture seule comme source backup)
interdit     = restore/PITR/mutation sur Production ; delete Production ; apply MT-005
opérateur    = <nom>
fenêtre      = <ISO>
livrables    =
  1) ref cible isolée ≠ ejdb…nmvi
  2) preuve restore/PITR vers cible (timestamp + méthode)
  3) migration history sur cible
  4) SELECT non sensible tables critiques (counts)
  5) preuve Production inchangée (migration count 29, status HEALTHY)
  6) plan cleanup séparé (Auth destructrice distincte)
```

**Ne pas** démarrer MT-005 remote apply tant que `RESTORE_DRILL ≠ PASS`.

---

## 3. Privacy due diligence — cinq décisions

**Contrat :** `mt011-privacy-1.0.0`  
**Aucune décision passée à `true` automatiquement.**  
**Date de vérification des sources :** 2026-08-11.

Légende recommandations : `ACCEPT` · `REJECT` · `LIMIT_TO_MV001` · `UNRESOLVED`.

---

### 3.1 `providerRetentionAccepted`

| Champ | Contenu |
|---|---|
| Preuve officielle | [Data Retention & Storage](https://fal.ai/docs/documentation/model-apis/media-expiration) — payloads JSON **30 jours** par défaut ; opt-out `X-Fal-Store-IO: 0` ; suppression Platform API après completed |
| Date preuve | 2026-08-11 (fetch docs fal) |
| Portée exacte | Stockage **payloads IO** fal (JSON inputs/outputs dashboard), **pas** les fichiers CDN (séparé) ; pour **un** submit MV-001 |
| Risque résiduel | Opt-out empêche le stockage payload mais pas forcément toute télémétrie partenaire ; historique dashboard peut être incomplet |
| Recommandation | **LIMIT_TO_MV001** — accord conditionnel **uniquement** si headers `X-Fal-Store-IO: 0` + suppression post-run documentée |
| Formulation déclaration humaine future | « Pour le benchmark MV-001 uniquement, j’accepte que fal puisse traiter les payloads de la requête ; j’exige l’opt-out `X-Fal-Store-IO: 0` et la suppression post-completed des IO restants. Cet accord expire 30 jours après le run ou sur révocation. Je n’autorise pas d’autres runs. » |
| Valeur technique actuelle | `false` / PENDING |

---

### 3.2 `providerCdnExposureAccepted`

| Champ | Contenu |
|---|---|
| Preuve officielle | [media-expiration](https://fal.ai/docs/documentation/model-apis/media-expiration) + [FAQ](https://fal.ai/docs/documentation/model-apis/faq) (CDN ≥7 jours défaut, URLs publiques par défaut) + [File Access Controls](https://fal.ai/docs/documentation/model-apis/file-access-controls) (`initial_acl`, expiration) |
| Date preuve | 2026-08-11 |
| Portée exacte | Fichiers CDN fal v3 (`v3b.fal.media`) pour **inputs uploadés** et **output** du seul job MV-001 ; exposition publique possible si ACL non posée |
| Risque résiduel | Inputs uploadés avant inference ne héritent pas automatiquement de l’ACL d’inference ; Partner model peut avoir contraintes additionnelles ; signed URL si mal loguée |
| Recommandation | **LIMIT_TO_MV001** — **uniquement** avec `initial_acl.default=forbid`, `expiration_duration_seconds` court (ex. 3600), download immédiat, ingest privé VHS, **interdiction** de persister l’URL CDN |
| Formulation déclaration humaine future | « Pour MV-001 uniquement, j’accepte l’hébergement temporaire sur le CDN fal des médias du run, à condition : ACL forbid par défaut, expiration ≤ 1 h, download immédiat vers Storage VHS privé, aucune URL CDN dans artifacts/logs. Révocation = pas de nouvel upload. » |
| Valeur technique actuelle | `false` / PENDING |

---

### 3.3 `biometricProcessingConsentConfirmed`

| Champ | Contenu |
|---|---|
| Preuve officielle | Page modèle Kling MC : badge **Partner** + docs input image/video personnage ([model page](https://fal.ai/models/fal-ai/kling-video/v3/pro/motion-control), 2026-08-11). FAQ Partner : modèles hébergés par partenaires, disponibilité gérée par le partenaire. **Aucun** détail biométrique exhaustif sur le traitement Partner. |
| Date preuve | 2026-08-11 |
| Portée exacte | Traitement de l’image d’identité + vidéo source (corps/visage/mouvement) par fal **et** partenaire Kling pour **un** inference MV-001 + QC VHS local |
| Risque résiduel | Localisation/sous-traitance Partner **non documentée** exhaustivement ; API Services « no training » **non re-fetchée** live ce jour (timeout) — s’appuyer sur `66_` DOCUMENTED antérieur + relecture legal |
| Recommandation | **UNRESOLVED** côté provider détaillé · **LIMIT_TO_MV001** **seulement après** consentement talent écrit + acceptation résiduelle Partner |
| Formulation déclaration humaine future | « La personne représentée consent explicitement au traitement de son image et de sa vidéo de mouvement par fal et le partenaire Kling pour le seul benchmark MV-001 et le QC VHS associé. Ce consentement ne couvre aucun autre usage, entraînement, ni diffusion. Expiration = fin du benchmark ou retrait. » |
| Valeur technique actuelle | `false` / PENDING |

---

### 3.4 `commercialUsageRightsConfirmed`

| Champ | Contenu |
|---|---|
| Preuve officielle | Badge **Commercial use** sur [page modèle](https://fal.ai/models/fal-ai/kling-video/v3/pro/motion-control) (2026-08-11) ; FAQ licences par modèle |
| Date preuve | 2026-08-11 |
| Portée exacte | Droit d’usage **commercial de la sortie générée via l’API fal** selon badge modèle — **distinct** des droits talent/source vidéo |
| Risque résiduel | ToS fal complets non re-lus live (429/timeout antérieurs) ; droits talent/source restent **hors** badge fal |
| Recommandation | **LIMIT_TO_MV001** — badge fal OK pour sortie API **et** preuves séparées droits source/identité ; sinon usage strictement interne documenté |
| Formulation déclaration humaine future | « Pour MV-001, je confirme (1) que le badge Commercial use fal Kling MC couvre l’usage prévu de la sortie API, et (2) que les droits sur la source vidéo et l’identité autorisent cet usage. Périmètre = ce benchmark uniquement. » |
| Valeur technique actuelle | `false` / PENDING |

---

### 3.5 `geographicRestrictionsSatisfied`

| Champ | Contenu |
|---|---|
| Preuve officielle | Région projet VHS Supabase `eu-west-3` (infra VHS). Fal/Kling : **pas** de carte de régions d’inférence Partner publiée sur la page modèle consultée. FAQ Partner = hébergement partenaire. |
| Date preuve | 2026-08-11 |
| Portée exacte | Acceptabilité du transfert/traitement hors UE éventuel pour un run unique MV-001 |
| Risque résiduel | Localisation GPU Partner **UNKNOWN** ; clauses SCCs / sous-traitants non inventoriées ici |
| Recommandation | **UNRESOLVED** jusqu’à note legal/ops · sinon **LIMIT_TO_MV001** seulement si legal accepte le risque résiduel Partner |
| Formulation déclaration humaine future | « Après revue legal/ops, je confirme que les restrictions géographiques applicables au workspace autorisent le traitement MV-001 via fal Kling Partner, malgré l’incertitude de localisation d’inférence. Périmètre = MV-001 ; expiration 90 jours ou changement de politique. » |
| Valeur technique actuelle | `false` / PENDING |

---

### 3.6 Synthèse due diligence

| Décision | Reco | Bloquant humain |
|---|---|---|
| Retention | LIMIT_TO_MV001 (+ headers) | Signature |
| CDN | LIMIT_TO_MV001 (+ ACL/TTL) | Signature |
| Biométrie | UNRESOLVED → LIMIT_TO_MV001 après consent talent | Signature talent + PO |
| Commercial | LIMIT_TO_MV001 (+ droits source) | Signature |
| Geo | UNRESOLVED → LIMIT_TO_MV001 si legal OK | Note legal |

**Verdict `READY_FOR_HUMAN_DECISION` :** les preuves officielles et formulations sont suffisantes pour une décision humaine éclairée **avec risques résiduels explicites**. Ce n’est **pas** un PASS technique des décisions (`false` inchangé).

Si legal exige les ToS/API Services re-lus verbatim avant toute signature biométrie/geo → traiter ces deux clés comme encore `MORE_INFORMATION_REQUIRED` **individuellement**, sans changer le verdict pack global (pack prêt ; infos complémentaires optionnelles).

---

## 4. Interdictions respectées

| Action | Statut |
|---|---|
| Restore vers Production | Non tenté |
| Création branche / projet isolé | Non tenté (Auth requise) |
| Apply MT-005 distant | Non tenté |
| Benchmark / fal call | **0** |
| Upload média | **0** |
| Lecture `FAL_KEY` | **0** |
| Décisions privacy → `true` | **0** |
| Cleanup destructif | Non effectué |

---

## 5. Prochaines Auth (ordre, non fusionnées)

1. **`AUTH_RESTORE_DRILL_ISOLATED_TARGET`** — lever `BLOCKED_TARGET_REQUIRED`.  
2. Exécuter restore drill → viser `RESTORE_DRILL = PASS`.  
3. Signatures Privacy Decision Pack (5 formulations §3) — indépendantes du restore.  
4. **Ensuite seulement** : Auth MT-005 remote apply (hors ce ticket).  
5. **Ensuite** : Auth budget / deploy / paid MT-013 benchmark (hors ce ticket).

---

## 6. Suite

- Ne **pas** démarrer MT-005 remote apply.  
- Ne **pas** démarrer le benchmark MV-001.  
- **MT-013C** : tentative cible isolée — **STOP** (`75_`) coût ≠ 0 + branche data-less.  
- P1 conservé : `BACKUP_PRESENT_RESTORE_UNPROVEN` tant que `RESTORE_DRILL ≠ PASS`.
