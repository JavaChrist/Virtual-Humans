# MT-014 — MOTION TRANSFER BENCHMARK EVALUATION & REGISTRY READINESS

**Date :** 2026-08-13  
**Nature :** évaluation technique + documentaire  
**Auth :** Phase MT-014 — sans provider, sans deploy, sans activation Production

```text
VERDICT = PROVIDER_ADAPTER_VALIDATED_BENCHMARK_ONLY
REAL_PROVIDER_CALLS = 0
REMOTE_WRITES = 0
RUNTIME_MOTION = UNAVAILABLE
REGISTRY_PRODUCTION.enabled = false
REGISTRY_PRODUCTION.paidExecution = false
CRITICAL_FIDELITY_HARD_ELIGIBLE = false
LIMITED_BETA_READY = NO
PRODUCTION_READY = NO
MV-002+ = NOT STARTED
```

---

## 1. Verdict

**`PROVIDER_ADAPTER_VALIDATED_BENCHMARK_ONLY`**

Un benchmark contrôlé (MV-001) a prouvé que l’adapter fal Kling v3 Pro  
`motion-control` est **callable** bout-en-bout (submit→poll→result→ingest→HR)  
avec coût réel observé et approbation humaine.

Ce n’est **pas** :

- une promotion Registry Production → `SUPPORTED` globale ;
- une readiness beta limitée ;
- une readiness Production.

Alternative écartée : `MORE_BENCHMARKS_REQUIRED` serait le verdict si l’objectif  
était d’ouvrir beta/Production ; ici l’objectif est l’évaluation adapter+pipeline.

---

## 2. État de départ (prouvé)

| Item | Valeur | Source |
|---|---|---|
| MV-001 | `PASS_WITH_HUMAN_APPROVAL` | `97_` |
| provider / endpoint | fal · `fal-ai/kling-video/v3/pro/motion-control` | `67_`, `95_` |
| durée | 8s | `86_`, `95_` |
| submit | **1** | `95_` |
| coût réel | **135¢** (réserve 162 / release 27) | `95_`, `97_` |
| output | privé, lifecycle `approved`, `active=false` | `97_` |
| Privacy Pack | `ACCEPTED_LIMITED_MV001` (exp. 2026-09-10) | `81_` |
| MT-013P | operational recovery **PASS** | `98_` |
| runtime Motion | **UNAVAILABLE** | flags OFF |
| Registry Production | `enabled=false` · `paidExecution=false` · `status=UNVERIFIED` | profil code |

---

## 3. Product readiness (séparé)

| Couche | Statut | Commentaire |
|---|---|---|
| Architecture ready | **YES** | `59_` + MT-001…012 |
| Adapter ready | **YES (code + 1 benchmark)** | MT-007B + MV-001 |
| Operational pipeline ready | **YES (hardened)** | MT-013K…P ; submit max 1 ; resumeInput |
| Benchmark validated | **YES (single sample)** | MV-001 only |
| Limited beta ready | **NO** | UI/ops/consent/quota gaps |
| Production ready | **NO** | Registry disabled ; QC Motion unavailable ; privacy limitée |

---

## 4. Matrice de capacités (conservatrice)

Légende : **SUPPORTED** | **PARTIAL** | **UNVERIFIED** | **NOT_SUPPORTED**

### 4.1 Capacités modèle / médias

| Capacité | Niveau | Preuve documentaire | Preuve runtime | Preuve QC | Confiance | Limites | Benchmark + |
|---|---|---|---|---|---|---|---|
| true motion transfer | **SUPPORTED** | MT-007A/B endpoint MC | MV-001 submit→output | HR approve | moyenne | 1 sample, 1 morpho, 1 mouvement | MV-002…006 |
| source video | **SUPPORTED** | adapter `video_url` | asset source privé utilisé | decode | haute | 8s/9:16 seulement prouvé | autres durées |
| character reference | **SUPPORTED** | adapter `image_url` | identity asset | HR identité subjective | moyenne | 1 personnage | MV-002/003 |
| outfit reference | **NOT_SUPPORTED** | adapter omet / `outfitLock=required` throw | — | — | haute (négatif) | pas de champ dédié | N/A tant qu’API |
| preserve motion | **PARTIAL** | sémantique provider | output jugé exploitable | mesures unavailable | basse | HR remplace mesure | MV-004/006 |
| timing preservation | **UNVERIFIED** | Registry spike | non mesuré | unavailable | basse | — | MV-004 |
| camera preservation | **PARTIAL** | `character_orientation` only | orientation image|video | unavailable | basse | pas caméra mobile prouvée | MV-005 |
| identity control | **PARTIAL** | image + elements optionnels | 1 identité | humanOnly | basse | pas multi-id | MV-002/003 |
| pose control | **PARTIAL** | `provider_native` only | 1 run | — | moyenne | pas d’autre mode | — |
| full-body support | **PARTIAL** | docs fal / Registry | HR full-body subjectif | unavailable | basse | 1 cadrage | MV-005 |
| hands/feet integrity | **UNVERIFIED** | spike explicite | — | unavailable | très basse | critique coaching | MV-002…006 + mesure |
| temporal continuity | **UNVERIFIED** | — | — | unavailable | très basse | — | + port mesure |

### 4.2 Capacités pipeline ops

| Capacité | Niveau | Preuve documentaire | Preuve runtime | Preuve QC | Confiance | Limites | Benchmark + |
|---|---|---|---|---|---|---|---|
| async submit | **SUPPORTED** | MT-007B / MT-008 | MV-001 `providerJobId` | — | haute | max 1 submit Auth | — |
| polling | **SUPPORTED** | MT-008 | MV-001 multi-poll | — | haute | reclaim ≠ attempt | — |
| fresh-process recovery | **SUPPORTED** | MT-013K / **MT-013P** | tests + incident résolu | anti-stub | haute | legacy `qc_rejected` conservé | crash drills |
| result fetch | **SUPPORTED** | MT-013K-OUTPUT | MV-001 | — | haute | 0 resubmit | — |
| secure download | **SUPPORTED** | `safe-fal-media-fetch` | MV-001 | MIME/SSRF | haute | allowlist hosts | — |
| private ingest | **SUPPORTED** | MT-005 / `93_` | asset privé non-actif | — | haute | bucket `director-final-assets` | — |
| technical QC | **PARTIAL** | MT-009 | decode path | partiel | moyenne | pas suite CV | + métriques |
| Motion QC | **PARTIAL** | MT-009 orchestrateur | Production = unavailable → HR | human_review | moyenne | pas de PASS auto | port mesure réel |
| Human Review | **SUPPORTED** | MT-010 / MT-013O | décision `approved` 1× | attestation | haute | humanOnly only | UI beta |
| cost estimation | **SUPPORTED** | pricing `$0.168/s` | estimate 135¢ | — | haute | formule firm | autres durées |
| real cost reconciliation | **SUPPORTED** | ledger V2 | 162/135/27 | recon=false | haute | 1 réservation | — |
| cancellation | **NOT_SUPPORTED** | `cancel_unsupported` | — | — | haute (négatif) | late result expected | design late-result |
| retry behavior | **PARTIAL** | intents HR only | `autoRetry=0` | — | moyenne | pas de job auto | Auth retry humain |
| fallback behavior | **NOT_SUPPORTED** | `maximumFallbacksPerStep=0` | refuse autre modelId | — | haute (volontaire) | aucun fallback | — |

---

## 5. Preuves MV-001 (bornées)

Ce qu’un seul MV-001 **peut** établir :

1. endpoint réellement callable ;
2. submit / poll / result / secure download / private ingest réels ;
3. coût réel observé **135¢** pour 8s ;
4. un cas de transfert jugé **exploitable** par examen humain ;
5. fonctionnement sur les caractéristiques exactes MV-001 (8s, 9:16, 1 identité, coaching opaque).

Ce qu’il **ne peut pas** prouver :

- robustesse multi-personnes / morphologies / tenues ;
- mains/pieds constants ; caméra mobile ; longues durées ; mouvements rapides ;
- autres styles de coaching ; stabilité statistique ;
- conformité juridique générale ; SLA provider.

---

## 6. Registry — avant / après proposé (design only)

### Avant (code Production profile)

```text
enabled = false
paidExecution = false
status = UNVERIFIED
outfitReference = NOT_SUPPORTED
cancellationSupported = false
motionFidelityLevels.* = UNVERIFIED
handFootQuality = UNVERIFIED
timingPreservation = UNVERIFIED
```

### Après proposé (évaluation — **aucune activation**)

```text
enabled = false                    # INCHANGÉ — interdit d’activer
paidExecution = false              # INCHANGÉ
status = UNVERIFIED                # profil global reste non Production-eligible
# Capacités modèle : matrice §4.1 (pas de promotion fidelity/hands/timing)
# Ops : documentées en §4.2 — hors bloc MotionTransferModelCapabilities
critical fidelity hard-eligible = false   # mesures Motion unavailable
Do NOT insert into Production CapabilityRegistrySnapshot
```

**Règle :** ne jamais dériver `SUPPORTED` global ni `paidExecution=true` d’un seul benchmark.

Profil code : `studio/src/domain/routing/capabilities/fal-kling-motion-control-registry-profile.ts`  
— note d’évaluation MT-014 ; flags d’activation inchangés.

---

## 7. Benchmarks suivants recommandés (non exécutés)

Durée indicative 8s sauf mention ; coût indicatif ≈ **135¢** @ `$0.168/s` (+ réserve buffer).

| ID | Objectif | Durée | Coût ind. | Preuve recherchée | Priorité | Risque |
|---|---|---|---|---|---|---|
| **MV-002** | même mouvement, autre personnage | 8s | ~135¢ | identité / morpho | P0 | privacy + budget |
| **MV-003** | autre morphologie / tenue | 8s | ~135¢ | outfit gap vs identité | P0 | outfit toujours NOT_SUPPORTED |
| **MV-004** | mouvement plus rapide | 8s | ~135¢ | timing / continuity | P1 | qualité mains/pieds |
| **MV-005** | caméra / cadrage différent | 8s | ~135¢ | camera PARTIAL→? | P1 | orientation only |
| **MV-006** | autre discipline coaching | 8s | ~135¢ | généralisation | P1 | privacy scope |
| Fail provider | erreur provider contrôlée | — | ~0–135¢ | fail-closed / ledger | P1 | coût partiel |
| Timeout / late | late result quarantine | — | ≤135¢ | `late_quarantined` | P1 | reclaim |
| Qualité insuffisante | HR REJECT path | 8s | ~135¢ | décision rejected | P2 | subjectif |
| Nouvelle référence | `request_new_reference` | — | 0¢ provider | intent HR only | P2 | pas de job auto |
| Retry humain Auth | retry explicit Auth | 8s | ~135¢ | 2e submit contrôlé | P2 | Auth stricte |

**Ne pas démarrer MV-002 dans cette phase.**

---

## 8. Gaps limited beta

### UI

- upload consent-aware (par asset) ;
- UI génération Motion ;
- suivi async (poll UI) ;
- preview privée (TTL) ;
- QC / Human Review UI opérateur ;
- rétention / suppression UI.

### Ops

- monitoring + alertes (submit/poll/late/QC) ;
- quota workspace Motion ;
- support opérateur (runbook incident) ;
- politique retry humaine explicite ;
- politique coûts (plafond, buffer) ;
- Registry allowlist benchmark/beta (pas Production globale).

### Privacy / consent

- Privacy Pack **MV-001 only** ≠ consentement global ;
- pas de réutilisation automatique des médias ;
- politique de suppression future à documenter/exécuter sous Auth ;
- asset approuvé mais **non actif** (conserve).

---

## 9. Sécurité & données (vérifié, aucune suppression)

| Contrôle | État |
|---|---|
| URLs non persistées | OK (redact / resumeInput internal) |
| output privé | OK · `director-final-assets` |
| inputs privés | OK |
| asset approuvé `active=false` | OK |
| Privacy Pack ≠ consentement global | OK |
| pas de réutilisation auto | OK |
| politique suppression future | documentée comme gap (non exécutée) |
| ledger / coût | 162/135/27 cohérent |
| historique incident `qc_rejected` | **conservé** |

---

## 10. Tests exécutés (non payants)

| Suite | Résultat |
|---|---|
| Registry MT-002 | PASS |
| Worker MT-008 | PASS |
| Wire / durability / QC / MT-013P | PASS |
| typecheck / lint / build / secret scan | voir rapport commit |

`REAL_PROVIDER_CALLS=0` · `REMOTE_WRITES=0`.

---

## 11. P0 / P1

### P0

1. Ne pas activer Registry Production / paidExecution.  
2. Ne pas élargir Privacy Pack sans Auth.  
3. Avant tout nouveau paid : Auth + budget + privacy scope explicite (MV-002).

### P1

1. UI consent + preview + HR.  
2. Port de mesure Motion (ou politique human-only durable).  
3. Monitoring / quota / late-result runbook.  
4. Décision ADR Motion Director (ticket archi `59_` MT-014) — **postpone** recommandé tant que capability Production OFF.

---

## 12. Prochaine recommandation

```text
NEXT = MORE_BENCHMARKS_REQUIRED_FOR_BETA
ACTION = préparer Auth MV-002 (design) — ne pas exécuter
DO_NOT = activer Registry · deployer flags · merge/export · supprimer médias
```

---

## 13. Non-goals confirmés

- 0 fal / 0 nouveau benchmark exécuté  
- 0 upload/download média Production  
- 0 URL signée  
- 0 décision Human Review  
- 0 activation asset  
- 0 flags / Vercel / deploy  
- 0 budget / migration  
- 0 suppression média  
- 0 activation Registry Production
