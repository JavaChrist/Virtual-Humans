# MT-015A — MV-002 BENCHMARK DESIGN & READINESS PREP

**Date :** 2026-08-13  
**Nature :** documentaire / non payante  
**Auth :** Phase MT-015A — zéro média · zéro provider · zéro budget write

```text
VERDICT = MV002_DESIGN_READY
OPS_STATUS = DEFERRED   (décision humaine Phase 11A-RESUME — 13 août 2026)
MV002_PRIVACY = PENDING
MV002_MEDIA = NOT_SELECTED
MV002_BUDGET = NOT_AUTHORIZED
MV002_PROVIDER = NOT_AUTHORIZED
REGISTRY_PRODUCTION = DISABLED
RUNTIME_MOTION = UNAVAILABLE
REAL_PROVIDER_CALLS = 0
REMOTE_WRITES = 0
```

**Note ops :** aucune Privacy/budget/média Auth MV-002 ; reprise chantier principal → `101_`.

---

## 1. Mission

Préparer **MV-002** : *same motion, different virtual character*.

Objectif principal : déterminer si le transfert validé par MV-001 fonctionne avec  
une **seconde identité virtuelle distincte**, sans confondre cette preuve avec une  
validation générale de l’`identity control`.

**Une seule variable contrôlée.** Aucune exécution dans cette phase.

---

## 2. Hypothèse

```text
Le même mouvement source peut être transféré vers une seconde identité
virtuelle sans dégradation majeure de continuité, posture ou cohérence visuelle.
```

---

## 3. Variable contrôlée vs constantes

| | Valeur |
|---|---|
| **Variable** | nouvelle référence personnage virtuel |
| Source Motion | même clip 8s (ré-upload Auth futur — **pas** réutilisation auto asset MV-001) |
| Intervalle / durée | 8s |
| Endpoint | `fal-ai/kling-video/v3/pro/motion-control` |
| Orientation / caméra | identiques à MV-001 |
| Résolution / fps source | identiques |
| Paramètres provider | identiques |
| Politique QC | identique (unavailable metrics → human_review) |
| Human Review | même processus append-only |
| Submit max | **1** |
| Retry / fallback | **0** |

Code design : `studio/src/application/motion/mv002/mv002-benchmark-design.ts`

---

## 4. Nouvelle identité virtuelle — checklist (NOT_SELECTED)

Ne **pas** sélectionner ni lire de fichier dans cette phase.

- [ ] Création détenue ou correctement licenciée  
- [ ] Personne non réelle **ou** consentement distinct  
- [ ] Apparence suffisamment différente de Mei  
- [ ] Image full-body ou cadrage compatible motion-control  
- [ ] Résolution suffisante  
- [ ] Visage, mains, pieds et tenue lisibles  
- [ ] Arrière-plan simple  
- [ ] Aucun média dans Git  
- [ ] Checksum futur (post-sélection)  
- [ ] Consent / reference provenance futurs  

**Statut :** `MV002_MEDIA = NOT_SELECTED`

---

## 5. Critères humains (avant exécution)

À renseigner lors du visionnage privé MV-002 (comparaison à MV-001) :

1. Mouvement global comparable à MV-001  
2. Continuité temporelle  
3. Équilibre / posture  
4. Trajectoires bras / mains  
5. Stabilité jambes / pieds  
6. Conservation de la **nouvelle** identité  
7. Stabilité de la tenue  
8. Cadrage / caméra  
9. Déformations  
10. Artefacts  

### Décisions autorisées (aucun retry implicite)

| Décision | Signification |
|---|---|
| `APPROVE` | exploitable pour preuve MV-002 |
| `REJECT` | non exploitable |
| `RETRY_WITH_UPDATED_CONSTRAINTS` | intent seulement — Auth distincte requise |
| `REQUEST_NEW_REFERENCE` | intent seulement — nouvelle identité |

---

## 6. Grille comparative préparée (sans conclure)

| Dimension | MV-001 | MV-002 | Écart |
|---|---|---|---|
| mouvement | référence approuvée | futur | futur |
| identité | Mei (virtuelle) | nouvelle identité | futur |
| posture | humain | futur | futur |
| mains/pieds | unavailable + humain | futur | futur |
| tenue | humain | futur | futur |
| artefacts | humain | futur | futur |
| coût | **135¢** | futur (est. 135¢) | futur |
| incidents ops | présents puis corrigés (MT-013P) | futur | futur |

---

## 7. Preuves MT-013P attendues en conditions réelles

Lors de l’exécution future (Auth séparée), vérifier :

- polling / reclaim **sans** intervention corrective manuelle `max_attempts` ;  
- `resumeInput` durable présent après submit ;  
- **aucun** faux `qc_rejected` d’hydratation ;  
- multi-invocation drain OK ;  
- Human Review seedée normalement (`overallStatus=human_review`).

---

## 8. Privacy — pack MV-002 séparé (PENDING)

Le Privacy Pack MV-001 (`ACCEPTED_LIMITED_MV001`, exp. **2026-09-10**)  
**n’autorise pas** MV-002 ni la réutilisation automatique des assets privés.

| Clé | Valeur design |
|---|---|
| providerRetentionAccepted | **PENDING** |
| providerCdnExposureAccepted | **PENDING** |
| biometricProcessingConsentConfirmed | **PENDING** |
| commercialUsageRightsConfirmed | **PENDING** |
| geographicRestrictionsSatisfied | **PENDING** |
| sourceMotionPersonConsentConfirmed | **PENDING** |
| sourceMotionReuseForMv002Authorized | **PENDING** |
| virtualIdentityRightsConfirmed | **PENDING** |

Toute valeur reste **PENDING** jusqu’à déclaration humaine Auth dédiée.

---

## 9. Budget (recalcul lecture seule — aucun write)

### Estimate 8s

```text
estimate = 135¢  ($0.168/s × 8)
reservation prudente = 162¢
plafond absolu = 200¢
```

### État Production observé (post-MV-001)

| Champ | Minor (¢) |
|---|---|
| hard | **274** |
| committed (ledger) | **247** |
| reserved (open) | **0** |
| available | **27** (= 274 − 247) |

### Shortfall MV-002

```text
shortfall = max(0, 162 − 27) = 135¢
min hard raise to cover reservation = 274 + 135 = 409¢
```

**Aucune modification budgétaire dans cette phase.**  
`MV002_BUDGET = NOT_AUTHORIZED`

---

## 10. Données MV-001 (audit lecture seule redacted)

| Item | État |
|---|---|
| inputs privés | source `12c4bd0b…` · identity `f42393ae…` · bucket privé |
| output | `2d7ffcad…` · lifecycle **approved** · **active=false** |
| URLs persistées | absentes (audit provenance) |
| Privacy expiry MV-001 | 2026-09-10 · scope **MV-001 only** |
| Réutilisation implicite | **interdite** |
| Médias lus/téléchargés cette phase | **0** |

---

## 11. Plan de portes séparées

```text
MV-002 design                          ← CETTE PHASE (DONE)
→ Privacy decision (Auth humaine)
→ local media validation
→ budget auth si shortfall
→ project creation
→ private upload (source ré-déclarée + nouvelle identité)
→ deploy/preflight sans provider
→ paid Auth unique (submit ≤ 1)
→ Human Review
→ benchmark comparison MV-001 / MV-002
```

Aucune fusion d’autorisations distantes ou payantes.

---

## 12. Registry (inchangé)

```text
enabled = false
paidExecution = false
status = UNVERIFIED
critical hard-eligible = false
```

MV-002 **ne peut pas** à lui seul activer Production.

### Preuves qui pourraient évoluer *après* MV-002 (si APPROVE)

- confiance character reference (2e sample) ;  
- confiance identity control (**PARTIAL** → plus de confiance, pas auto-SUPPORTED) ;  
- répétabilité sur deux personnages ;  
- pipeline ops post-MT-013P en conditions réelles.

---

## 13. Idempotence / isolation

| Contrôle | Règle |
|---|---|
| Privacy | pack MV-002 distinct ; MV-001 pack ≠ couverture |
| Assets | pas de réutilisation auto des objets privés MV-001 |
| correlationId / idempotency | namespaces `mv002` distincts |
| project | projet dédié futur (≠ `390c25db-…` sauf Auth explicite) |
| submit | max 1 ; retry/fallback 0 |

---

## 14. Tests (non payants)

| Suite | Résultat |
|---|---|
| `mt015a-mv002-benchmark-design.test.ts` | PASS |
| estimate 8s = 135 | PASS |
| Privacy / asset / idempotency isolation | PASS |
| Registry disabled | PASS |
| typecheck / build | PASS (rapport commit) |

---

## 15. Prochaine décision humaine exacte

Choisir **une** des options suivantes (pas d’exécution automatique) :

1. **Auth Privacy Decision Pack MV-002** (PENDING → ACCEPTED_LIMITED_MV002), **ou**  
2. **Reporter MV-002** et revenir à **Phase 11A média** / fonctionnalités principales, **ou**  
3. **Auth budget raise** design-only discussion (135¢ shortfall) — sans write tant que Privacy/media non prêts.

**Ne pas démarrer l’exécution MV-002.**

---

## 16. Non-goals confirmés

- 0 lecture / copie / upload / download média  
- 0 fal / submit / poll  
- 0 budget write / réservation / run / job / asset  
- 0 Vercel / deploy / flags  
- 0 activation Registry  
- 0 suppression données MV-001  
- 0 décision Human Review
