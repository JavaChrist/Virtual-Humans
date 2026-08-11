# 73 — MT-013A MV-001 Benchmark Governance & Readiness Audit

**Date :** 11 août 2026  
**Capability :** `video.motion_transfer`  
**Statut :** `AUDIT_COMPLETE` · **aucun benchmark exécuté**

```text
Verdict                      = READY_FOR_HUMAN_GOVERNANCE_DECISIONS
MV001_NOT_EXECUTED
REAL_PROVIDER_CALLS          = 0
PAID_BENCHMARK               = NOT_AUTHORIZED
PRIVACY_DECISIONS            = PENDING
REMOTE_MIGRATION             = NOT_APPLIED
RUNTIME_CAPABILITY           = UNAVAILABLE
BACKUP_PRESENT_RESTORE_UNPROVEN = OPEN
HEAD                         = ee75619 (base) → commit MT-013A
```

**Hors scope respecté :** 0 appel fal · 0 upload · 0 deploy · 0 écriture Vercel · 0 réservation · 0 run · 0 migration distante · 0 restore exécuté · 0 écriture budget.

---

## 1. Verdict

| Verdict possible | Applicable ? |
|---|---|
| `READY_FOR_HUMAN_GOVERNANCE_DECISIONS` | **OUI — verdict retenu** |
| `READY_FOR_BACKUP_RESTORE_AUTH` | Prêt en parallèle (prochaine Auth technique) |
| `READY_FOR_MIGRATION_AUTH` | Non — dépend restore drill PASS |
| `READY_FOR_BENCHMARK_PREP` | Non — dépend privacy + restore + migration + budget |
| `BLOCKED` | Non — audit complet ; blocages = Auth humaines explicites |

**Ordre d’autorisation humaine exact (ne pas fusionner) :**

1. **Pack privacy MV-001** (5 décisions — Gate B/C/D) — peut être signé offline.  
2. **Restore drill isolé** (Gate E) — Auth technique distincte.  
3. **Apply MT-005 Production** (Gate F) — seulement après E = PASS.  
4. **Augmentation budget** (Gate H) — Auth distincte.  
5. **Deploy / flags preflight** (Gate I) — Auth distincte.  
6. **Paid provider call** (Gate J) — Auth distincte, 1 call max.

---

## 2. Matrice des portes (A–J)

### Gate A — Source media readiness

| Champ | Valeur |
|---|---|
| Statut | `NOT_READY` — médias hors Git, non inventoriés ici |
| Preuve requise | Checklist §4 remplie + checksums locaux + preuves de droits |
| Décision humaine | Validation produit que les assets MV-001 existent et sont autorisés |
| Écriture distante | Non (préparation locale) |
| Réversible | Oui |
| Dépendances | Aucune technique |
| Procédure future | Préparer fichiers privés hors repo ; `sha256sum` ; jamais commit |
| PASS | Checklist complète + checksums + droits documentés + hors Git |

### Gate B — Consent and usage rights

| Champ | Valeur |
|---|---|
| Statut | `PENDING` — `biometricProcessingConsentConfirmed` + `commercialUsageRightsConfirmed` = false |
| Preuve requise | Décisions signées (auteur, date, expiration, périmètre MV-001) |
| Décision humaine | **Obligatoire** — pas un flag technique |
| Écriture distante | Non à ce stade (store futur Auth) |
| Réversible | Révocation documentée → runtime re-bloqué |
| Dépendances | Pack §5 |
| PASS | Les deux décisions `true` avec provenance + expiration |

### Gate C — fal retention / CDN acceptance

| Champ | Valeur |
|---|---|
| Statut | `PENDING` — `providerRetentionAccepted` + `providerCdnExposureAccepted` = false |
| Preuve requise | Acceptation explicite des défauts fal (payload 30j, CDN public configurable) + stratégie opt-out |
| Décision humaine | **Obligatoire** |
| Écriture distante | Non |
| Réversible | Oui (révocation) |
| Dépendances | Audit fal §6 (sources officielles) |
| PASS | Deux décisions acceptées + plan headers (`X-Fal-Store-IO`, lifecycle/ACL) documenté pour MT-013B |

### Gate D — Geographic restrictions

| Champ | Valeur |
|---|---|
| Statut | `PENDING` — `geographicRestrictionsSatisfied` = false |
| Preuve requise | Confirmation que le traitement fal / sous-traitants est acceptable pour le cas MV-001 |
| Décision humaine | **Obligatoire** (legal/ops) |
| Écriture distante | Non |
| Réversible | Oui |
| Dépendances | Sources fal + avis legal si besoin |
| PASS | Décision `true` avec auteur + expiration |

### Gate E — Backup restore proof

| Champ | Valeur |
|---|---|
| Statut | `BACKUP_PRESENT_RESTORE_UNPROVEN` (P1 ouvert) |
| Preuve requise | Restore drill isolé PASS (schéma + smoke non sensible) |
| Décision humaine | Auth pour créer/utiliser une **cible isolée** (branche Supabase ou projet temporaire) + credentials |
| Écriture distante | Restore vers isolé seulement — **jamais Production** |
| Réversible | Nettoyage cible isolée séparé |
| Dépendances | Dashboard Supabase Backups ; Auth credentials |
| Procédure | §7 — **non exécutée** dans MT-013A |
| PASS | Preuve écrite restore réussi + checksum/schéma vérifiés + Production intacte |

### Gate F — MT-005 Production migration

| Champ | Valeur |
|---|---|
| Statut | `NOT_APPLIED` Production · locale appliquée (30 migrations) |
| Preuve requise | Gate E PASS + SQL audité §8 + fenêtre maintenance |
| Décision humaine | Auth apply distant explicite |
| Écriture distante | **Oui** (CHECK + RPC) |
| Réversible | Rollback logique documenté (re-contraindre allowlist) — pas de DROP data |
| Dépendances | **E = PASS** |
| PASS | History Production 30/30 · pgTAP + integration verts post-apply · drift = 0 |

### Gate G — Registry verification candidate

| Champ | Valeur |
|---|---|
| Statut | `UNVERIFIED` · `enabled=false` · `paidExecution=false` |
| Preuve requise | Plan §10 — un benchmark ne flippe pas tout en SUPPORTED |
| Décision humaine | Phase Registry post-benchmark séparée |
| Écriture distante | Non dans MT-013A |
| Réversible | N/A |
| Dépendances | MV-001 exécuté + rapport |
| PASS | (hors scope) phase dédiée après MT-013B |

### Gate H — Benchmark budget

| Champ | Valeur |
|---|---|
| Statut | `SHORTFALL` — available **10¢** ≪ réserve proposée **62¢** |
| Preuve requise | Auth hard-limit ou libération committed |
| Décision humaine | Auth budget distincte |
| Écriture distante | Ledger budget (si Auth) |
| Réversible | Hard-limit peut être rebaissé après fermeture |
| Dépendances | Durée/estimate §9 |
| PASS | `available ≥ reserved` avant submit ; plafond absolu respecté |

### Gate I — Deploy preflight

| Champ | Valeur |
|---|---|
| Statut | `NOT_AUTHORIZED` |
| Preuve requise | Deploy commit + flags OFF par défaut + dry-run live sans provider |
| Décision humaine | Auth deploy / fenêtre |
| Écriture distante | Vercel (si Auth) |
| Réversible | Flags OFF immédiats |
| Dépendances | F + H partiels ; flags plan §11 |
| PASS | Runtime déployé · flags OFF · dry-run unavailable/blocked cohérent jusqu’à Auth paid |

### Gate J — Paid provider authorization

| Champ | Valeur |
|---|---|
| Statut | `NOT_AUTHORIZED` |
| Preuve requise | A–I verts (sauf G post-benchmark) + Auth écrite 1 call |
| Décision humaine | **Obligatoire** — 1 submit max |
| Écriture distante | fal submit + éventuel Storage ingest privé |
| Réversible | Flags OFF ; pas de resubmit |
| Dépendances | A–F, H, I, privacy accepted |
| PASS | Auth signée + submit=1 + poll sans resubmit + QC + review + fermeture flags |

---

## 3. Définition MV-001 (sans média dans le dépôt)

```text
Benchmark ID       = MV-001
Use case           = coaching / Tai-Chi (métier externe opaque — pas de constantes sport dans VHS)
Provider           = fal
Model / endpoint   = fal-ai/kling-video/v3/pro/motion-control
Duration           = 3 secondes  ← minimum officiel adapter (ACCEPTÉ)
Orientation        = video  (car preserveCamera=true pour motion complexe / critical)
Source video       = référence privée, hors Git
Identity image     = référence privée, hors Git
Outfit lock        = preferred | none  (NOT required — adapter refuse outfitLock=required)
Fidelity           = critical
Human review       = obligatoire
Automatic retry    = 0
Fallback           = 0
Maximum calls      = 1
Maximum jobs       = 1
Maximum outputs    = 1
Merge / export     = interdit
```

### Durée 3 s — validation adapter

| Check | Résultat |
|---|---|
| `FAL_KLING_V3_PRO_MIN_DURATION_SECONDS` | **3** — DOCUMENTED |
| `assertFalKlingDurationAllowed(3, "video")` | PASS (max video = 30) |
| OpenAPI / page modèle | min duration alignée — DOCUMENTED (x-fal / docs 2026-08-11) |
| Justification &lt; 3 s | **refusée** par adapter |

**Durée retenue : 3 secondes.**

---

## 4. Inventaire média requis (checklist — pas de fichiers)

### 4.1 Source vidéo (future)

| Propriété | Attendu |
|---|---|
| Format / MIME | `video/mp4` (préféré) ; aussi `video/webm`, `video/quicktime` côté VHS |
| Durée | **exactement 3 s** pour ce benchmark (ou trim local → 3 s) |
| Résolution | ≥ 720p ; 1080p recommandé |
| fps | 24 (aligné registry profil) |
| Cadrage | full-body visible (tête → pieds) |
| Mains / pieds | visibles, non occultés |
| Caméra | fixe préférable pour premier run ; si mobile → documenter (orientation `video`) |
| Coupes | **aucune** |
| Droits | licence / autorisation d’usage pour traitement fal + QC VHS |
| Consentement | talent / figure représentée informé |
| Conservation | politique locale (durée, lieu, destruction) |
| Checksum | `sha256` local avant upload — jamais dans Git |
| Hors Git / logs | **obligatoire** — pas d’URL signée persistée |

### 4.2 Référence personnage (identity)

| Propriété | Attendu |
|---|---|
| Format / MIME | `image/png` \| `image/jpeg` \| `image/webp` |
| Résolution | visage net ; corps entier ou upper-body selon docs fal |
| Cadrage | identité claire, fond simple recommandé |
| Identité | personne autorisée uniquement |
| Tenue | cohérente avec usage ; **pas** de champ outfit provider (lock non-required) |
| Droits d’exploitation | commerciaux si sortie commercialement utilisée |
| Consentement biométrique | explicite (Gate B) |
| Hors Git / logs | **obligatoire** |

---

## 5. Privacy Decision Pack (humain)

Contrat : `mt011-privacy-1.0.0`.  
**Statut courant :** **`ACCEPTED_LIMITED_MV001`** — voir [`81_`](./81_MT013D_MV001_PRIVACY_DECISION_PACK_ACCEPTED.md) (Auth 2026-08-11 · expire **2026-09-10** · 5 clés `true` gouvernance).  
**N’autorise pas** upload / fal / spend / deploy.  
Sections 5.1–5.5 ci-dessous = pack de formulations **pré-signature** (historique readiness).

### 5.1 `providerRetentionAccepted`

| Champ | Contenu |
|---|---|
| Formulation | « J’accepte que fal conserve les payloads JSON de requête/réponse jusqu’à 30 jours par défaut, sauf opt-out `X-Fal-Store-IO: 0`. » |
| Si accord | Benchmark autorisé côté rétention payload ; headers d’opt-out recommandés |
| Si refus | Runtime Motion reste bloqué |
| Info officielle | https://fal.ai/docs/documentation/model-apis/media-expiration — **DOCUMENTED** (vérifié 2026-08-11) |
| Inconnues | Effet exact de l’opt-out sur l’historique dashboard pendant le run |
| Périmètre | **MV-001 uniquement** (renouveler pour runs suivants) |
| Expiration proposée | 90 jours ou fin de benchmark + 30 j |
| Preuve minimale | Signature auteur + date + référence doc |
| Auteur | Product owner / legal désigné |
| Révocation | Décision `false` + flags OFF immédiat |

### 5.2 `providerCdnExposureAccepted`

| Champ | Contenu |
|---|---|
| Formulation | « J’accepte que les médias fal (inputs uploadés / outputs) soient hébergés sur le CDN fal (URLs potentiellement publiques sauf ACL), avec rétention configurable via `X-Fal-Object-Lifecycle-Preference`. » |
| Si accord | Upload/submit autorisés sous stratégie download immédiat + ingest privé VHS + expiration courte |
| Si refus | Bloqué |
| Info officielle | même page retention + FAQ CDN — **DOCUMENTED** |
| Inconnues | ACL exacte supportée sur ce endpoint Partner ; délai min CDN historique « ≥7d » vs expiration configurable |
| Périmètre | MV-001 |
| Expiration | 90 j |
| Preuve | Signature + plan headers ACL/expiration pour MT-013B |
| Révocation | `false` + pas de nouvel upload |

### 5.3 `biometricProcessingConsentConfirmed`

| Champ | Contenu |
|---|---|
| Formulation | « La personne représentée consent au traitement de son image/visage/corps par fal Kling motion-control et au QC VHS pour le benchmark MV-001. » |
| Si accord | Upload identity + source autorisés |
| Si refus | Bloqué — **ne pas contourner** |
| Info officielle | fal ne détaille pas le biométrique modèle — **DECISION_REQUIRED** / legal |
| Inconnues | Sous-traitance géo exacte ; durée rétention côté modèle Partner |
| Périmètre | MV-001 + assets listés |
| Expiration | fin benchmark ou retrait consentement |
| Preuve | Formulaire / email signé hors Git (référence opaque en audit) |
| Révocation | Immédiat → destruction locale + pas de resubmit |

### 5.4 `commercialUsageRightsConfirmed`

| Champ | Contenu |
|---|---|
| Formulation | « Les droits d’exploitation de la source, de l’identité et de la sortie autorisent l’usage prévu (interne / commercial selon brief). » |
| Si accord | Review APPROVE possible sans conflit droits |
| Si refus | Bloqué ou usage strictement interne documenté |
| Info officielle | Badge « Commercial use » page modèle fal — **DOCUMENTED** ; ToS fal — **UNVERIFIED** ce jour (fetch terms 429) |
| Inconnues | Clauses ToS fal non re-lues live (429) — s’appuyer sur `66_` + relecture humaine |
| Périmètre | MV-001 |
| Expiration | selon contrat talent |
| Preuve | Licence / brief signé |
| Révocation | Selon contrat |

### 5.5 `geographicRestrictionsSatisfied`

| Champ | Contenu |
|---|---|
| Formulation | « Le traitement et l’hébergement fal pour MV-001 sont compatibles avec nos restrictions géographiques / conformité. » |
| Si accord | Gate D PASS |
| Si refus | Bloqué |
| Info officielle | Non exhaustif dans docs modèle — **DECISION_REQUIRED** legal |
| Inconnues | Régions d’inférence Partner Kling |
| Périmètre | MV-001 |
| Expiration | 90 j ou changement politique |
| Preuve | Note legal / ops |
| Révocation | `false` |

**Statut pack :** les 5 décisions = `PENDING` / `false`. Ne pas les flipper sans déclaration humaine.

---

## 6. Audit fal actualisé (sans API payante)

**Date de vérification :** 2026-08-11.

| Sujet | Statut | Source |
|---|---|---|
| Endpoint disponible | **DOCUMENTED** | https://fal.ai/models/fal-ai/kling-video/v3/pro/motion-control |
| Prix $0.168/s | **DOCUMENTED** | llms.txt + page modèle (re-vérifié) |
| Durée min 3 s | **DOCUMENTED** | OpenAPI x-fal / adapter `FAL_KLING_V3_PRO_MIN_DURATION_SECONDS` |
| Max 10 s (`image`) / 30 s (`video`) | **DOCUMENTED** | docs API + adapter |
| Payload retention 30 j | **DOCUMENTED** | https://fal.ai/docs/documentation/model-apis/media-expiration |
| Opt-out payload `X-Fal-Store-IO: 0` | **DOCUMENTED** | idem |
| CDN + expiration configurable | **DOCUMENTED** | idem (`X-Fal-Object-Lifecycle-Preference`) |
| Suppression request IO + CDN output | **DOCUMENTED** | Platform API (après completed) |
| Training on Client Content | **DOCUMENTED** (spike `66_`) | https://fal.ai/legal/api-services — re-fetch 2026-08-11 **bloqué** (challenge) → ne pas surclasser |
| Commercial use badge | **DOCUMENTED** | page modèle |
| ToS complet | **UNVERIFIED** ce jour | fetch `/terms` → 429 |
| Geo / sous-traitants | **DECISION_REQUIRED** | non exhaustif |
| Cancel | **DOCUMENTED** (code) | `cancel_unsupported` |
| Outfit dédié | **DOCUMENTED** | non supporté |

**Aucune clé fal lue ni exposée.**

---

## 7. Backup et restauration

```text
BACKUP_PRESENT_RESTORE_UNPROVEN
```

| Élément | État |
|---|---|
| Emplacement | Plateforme Supabase (Dashboard → Database → Backups) — **pas de dump dans le repo** |
| Date dernière preuve | **UNKNOWN** (`24_`) |
| Périmètre | Projet Production VHS (schéma + data) — non inventorié fichier |
| Chiffrement | **UNKNOWN** (plateforme) |
| Taille | **UNKNOWN** |
| Intégrité / checksum | **UNKNOWN** |
| Schéma couvert | Supposé full DB — **UNVERIFIED** |
| Procédure restore | Docs Supabase + drill isolé (`24_` §Backup/Restore) |
| Credentials | Accès Dashboard / Management API — **Auth humaine** |
| Risques | Restore mal ciblé → corruption ; credentials élargis ; durée ops |
| Durée technique approx. | Ordre de grandeur **30–90 min** pour drill isolé (création branche + restore + vérifs) — **pas** une estimation projet globale |

### Restore drill isolé (préparé — **NON EXÉCUTÉ**)

1. Auth humaine pour **cible isolée** (Supabase Branch ou projet temporaire dédié).  
2. Confirmer backup récent / PITR dans Dashboard Production (**lecture seule**).  
3. Restore **uniquement** vers la cible isolée.  
4. Vérifier : `supabase migration list` / schema_migrations = attendu ; smoke pgTAP non sensible ; **0** write Production.  
5. Preuve : rapport + timestamps + counts tables non sensibles.  
6. Cleanup cible isolée = procédure **séparée** + Auth.

**Autorisation humaine exacte requise avant exécution :**

```text
AUTH_RESTORE_DRILL_ISOLATED
cible        = <branch ou projet temporaire — JAMAIS Production>
opérateur    = <nom>
fenêtre      = <ISO>
interdit     = mutation Production ; delete Production ; PITR Production
livrable     = rapport restore PASS/FAIL + cleanup plan
```

---

## 8. Migration MT-005

**Fichier :** `studio/supabase/migrations/20260811180000_vhs_mt005_human_review_decision_extend.sql`  
**Test :** `studio/supabase/tests/vhs_mt005_human_review_decision.sql` (pgTAP plan 8)

| Check | Résultat |
|---|---|
| Locale unique | Oui — seule migration Motion |
| Idempotent ? | `DROP CONSTRAINT IF EXISTS` + `CREATE OR REPLACE` RPC — re-applicable |
| Contraintes | CHECK `decision` étendu (5 valeurs) |
| Grants / RLS | `REVOKE` anon/authenticated ; `GRANT EXECUTE` service_role |
| Compat ascendante | Additive — anciennes décisions `approved`/`rejected` restent valides |
| Rollback logique | Recréer CHECK à 2 valeurs + RPC précédente (fenêtre Auth) — **pas** de suppression de lignes |
| Lock / table | `ALTER TABLE` brief sur `human_review_decisions` |
| Suppression data | **Aucune** |
| History | Local **30** · Production **29** · drift = MT-005 only |

**Procédure apply distant future (ne pas exécuter) :** Gate E PASS → Auth → `supabase db push` / pipeline apply → vérifier 30/30 → pgTAP + integration → documenter.

---

## 9. Budget benchmark (3 s)

| Poste | Montant (USD minor = cents) |
|---|---|
| Tarif unitaire | **$0.168/s** = 16.8¢/s |
| Formule adapter | `ceil(durationSeconds * 168 / 10)` |
| Estimate provider 3 s | `ceil(50.4)` = **51¢** |
| Marge / buffer (~20 %) | ≈ 11¢ |
| Réservation proposée | **62¢** |
| Plafond absolu proposé | **100¢** (fail-closed si actual &gt; réserve) |
| Hard limit workspace | **122¢** |
| Committed | **112¢** |
| Reserved (ops) | **0¢** (checkpoint) |
| Available | **10¢** |
| Shortfall vs réserve 62 | **52¢** |
| Augmentation hard minimale | **+52¢** → hard **174¢** |
| Augmentation recommandée | **+90¢** → hard **212¢** (couvre plafond 100¢) |

**Aucune modification de budget dans MT-013A.**

---

## 10. Registry verification plan (post-benchmark — phase séparée)

Profil actuel **inchangé** :

```text
UNVERIFIED
enabled = false
paidExecution = false
```

Un seul MV-001 **ne** doit **pas** marquer toutes les capacités `SUPPORTED`.

| Capacité | Preuve minimale possible via MV-001 | Action Registry |
|---|---|---|
| sourceVideo | ingest + accept endpoint | → `SUPPORTED` candidat |
| characterReference | identity image acceptée | → `SUPPORTED` candidat |
| motionTransfer | output video + QC | → `SUPPORTED` / `PARTIAL` selon QC |
| timingPreservation | QC timing / human | souvent `PARTIAL` / `UNVERIFIED` |
| cameraPreservation | orientation video + review | `PARTIAL` plausible |
| identityControl | review humaine | `PARTIAL` |
| fullBodySupport | cadrage source + review | `PARTIAL` / `SUPPORTED` |
| hands/feet | review critique | rester `UNVERIFIED` si doute |
| async/polling | worker path | `SUPPORTED` si observé |
| coût réel | ledger | pricing evidence |
| output ingest | descriptor privé | process evidence |
| QC / review | rapports | process evidence |

**Toute promotion Registry = ticket séparé après rapport MV-001.**

---

## 11. Plan d’exécution futur (sans exécuter)

| # | Étape | Fermeture / rollback |
|---|---|---|
| 1 | Restore drill isolé | Cleanup cible isolée |
| 2 | Valider 5 décisions humaines | Révocation → blocked |
| 3 | Apply MT-005 | Rollback logique CHECK/RPC |
| 4 | Vérifier migrations 30/30 | Stop si drift autre |
| 5 | Préparer médias locaux | Pas de Git |
| 6 | Checksums | Journal opaque |
| 7 | Upload privé borné | Delete Storage + expiration fal |
| 8 | Registry benchmark-only (flags route) | Revert profile |
| 9 | Flags ON ciblés | Flags OFF immédiat |
| 10 | Dry-run live sans provider | N/A |
| 11 | Vérifier budget | Pas de submit si shortfall |
| 12 | Auth payante humaine | Expire écrite |
| 13 | **1 submit max** | Interdit resubmit |
| 14 | Polling sans resubmit | `submission_unknown` → review ops |
| 15 | Ingest privé | Pas d’URL en artifacts |
| 16 | QC | Pas d’auto-approve |
| 17 | Human Review | Append-only |
| 18 | Flags OFF immédiats | Obligatoire fin de run |
| 19 | Quarantaine / conservation | Selon décision |
| 20 | Rapport + reconciliation ledger | Freeze accounting |

---

## 12. Validations MT-013A

Exécutées (non payantes) — voir STOP.  
**Aucun test ne lit `FAL_KEY`.**

---

## 13. Suite

- **MT-013B** restore/privacy diligence — **DONE** (`74_`) : restore `BLOCKED_TARGET_REQUIRED` · privacy `READY_FOR_HUMAN_DECISION`.  
- Benchmark exécution / MT-005 apply — **NOT STARTED**.
