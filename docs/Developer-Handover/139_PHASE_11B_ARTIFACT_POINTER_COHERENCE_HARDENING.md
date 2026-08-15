# 139 — Phase 11B Artifact Pointer Coherence Hardening

**Date :** 2026-08-15  
**Auth :** `AUTH_11B_ARTIFACT_POINTER_COHERENCE_HARDENING`  
**Nature :** read-only Production · code-only · **0** mutation de pointeur  
**HEAD au départ :** `26fd10e` (`138_`)

```text
VERDICT = ARTIFACT_POINTER_COHERENCE_HARDENED_NO_LIVE_MUTATION_REQUIRED
STRATEGY = C_explicit_run_plan_output
POINTER_WRITES = 0
PRODUCTION_WRITES = 0
PROVIDER_CALLS = 0
SIGNED_URL_COUNT = 0
MEDIA_READS = 0
BUDGET_WRITES = 0
FLAGS_WRITTEN = 0
PHASE_COST = 0
VIDEO_LIFECYCLE = approved
VIDEO_ACTIVE = false
VIDEO_PUBLISHED = false
MERGE_ALLOWED = false
EXPORT_ALLOWED = false
DOWNSTREAM_ALLOWED = false
HARD = 437
COMMITTED = 389
RESERVED = 0
AVAILABLE = 48
RUNTIME_PAID_MEDIA = OFF
NEXT_AUTH = AUTH_11C_VOICE_TTS_PRODUCTION_WIRING_PREFLIGHT
```

---

## 1. Autorisation consommée

`AUTH_11B_ARTIFACT_POINTER_COHERENCE_HARDENING` — Christian, chat courant.

Read-only Production et code-only. Aucune mutation de pointeur, d’artifact, d’asset, de budget, de flag ou de média.

## 2. Git initial et final

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main initiaux | `26fd10e` |
| ahead / behind | **0 / 0** |
| Hors scope | AICCOS protégés · non touchés |
| Preview MP4 | gitignorée · non touchée |

## 3. Working tree

Au départ : uniquement `studio/src/app/api/aiccos/send/route.ts` et `studio/src/components/send-to-aiccos.tsx` (hors périmètre).  
Cette phase n’a ni restauré, ni reformaté, ni stashé ces fichiers.

## 4. État live des pointeurs

Lecture MCP redacted, projet `ejdb…nmvi`, 2026-08-15. **0 write.**

| Type | Id prefix | Rev | Actif | Provenance |
|---|---|---|---|---|
| `generation_plan` | `a55bd426` | 2 | **oui** | 11A `image.text_to_image` |
| `generation_plan` | `3d1858eb` | 3 | **non** | I2V `video.image_to_video` · source `49284892` · fingerprint `6e7199283c45e940…` |
| `quality_report` | `0da85052` | 5 | **oui** | I2V · output `9be6cb0c` · visuel `unavailable_humanOnly` |
| `production_result` | `fa5c42bd` | 10 | **oui** | I2V · `delivery=merge_ready` · `mergeExportAuthorized=false` · `outputActive=false` · output `9be6cb0c` · source `49284892` · HR `301ee080` APPROVE |

Vidéo `9be6cb0c` : `approved` · `active=false` · `published=false` · checksum `e929f00a…` · run `4c5b53a5`.  
Image `49284892` : `approved` · `active=false` · `published=false` · checksum `9ac484b7…`.  
Attempt `6be95728` : `completed` · `retryable=false`. Budget **437 / 389 / 0 / 48** ¢ (inchangé, non relu en somme ledger cette phase — hard live confirmé).

## 5. Schéma et portée des pointeurs

`active_artifact_revisions` : **PK `(project_id, artifact_type)`** — un actif par type par projet.  
`workspace_id` est dénormalisé ; l’unicité n’est **pas** par run, scène ou output.

`set_active_artifact_revision` remplace le pointeur du couple projet+type avec optimistic lock sur la révision attendue. Activer le GenerationPlan I2V remplacerait le pointeur 11A.

Quality Report : pas de clés de provenance dans le contrat `FinalQualityReport` générique. L’enveloppe I2V live porte `videoAssetId`.  
Production Result canonique : `generationPlanRevisionId` + `manifest.runId`. L’enveloppe I2V live porte `videoAssetId`, `sourceAssetId`, `capability`, `delivery.finalAssetId` / `qualityReportId` / `humanReviewId`, `phase11b`.  
Human Review : décision `301ee080` liée à l’asset vidéo et au QR.  
GenerationPlan I2V rev.3 : **résolvable par id** sans devenir actif.

## 6. Liste des consumers

| Consumer | Avant | Après |
|---|---|---|
| Reprise `/director` / `loadActiveGenerationPlan` | GP actif = 11A | inchangé · affichage seulement |
| Dernier résultat / Quality Review | QR/PR actifs I2V | inchangé · pas de merge |
| Prepare / execute merge | `merge_ready` seul | **+ `mergeExportAuthorized=true`** fail-closed |
| Export | merge completed | **+ autorisation explicite** |
| UI Livraison | dry-run `executable` | dry-run + message `merge_ready` insuffisant |
| Recovery / scripts admin 11A–11B | lecture par type | hors mutation |
| Tests / fixtures Phase 9 | merge après HR APPROVE | HR APPROVE pose `delivery.mergeExportAuthorized=true` |

Aucun consumer ne peut plus traiter un ensemble naïf mixte comme un pipeline unique pour merge/export.

## 7. Incohérences détectées

Ensemble naïf par types actifs = **incohérent** : GP 11A + QR I2V + PR I2V.  
Codes : `naive_plan_mismatch` · `naive_capability_mismatch` · `naive_output_mismatch`.

Ensemble I2V explicite (GP `3d1858eb` rev.3 + QR + PR + output `9be6cb0c` + source `49284892` + HR APPROVE) = **cohérent**.  
`delivery=merge_ready` **et** `mergeExportAuthorized=false`.

## 8. Stratégies A–D

| | Stratégie | Verdict |
|---|---|---|
| A | Activer le GP I2V rev.3 | **Refusée** — masque une faiblesse de résolution · écrase le GP 11A |
| B | Garder les pointeurs par type + cohérence stricte | Insuffisante seule : l’unicité est par type, pas par run |
| C | Résoudre explicitement par run/plan/output | **Retenue** — minimale et sûre |
| D | Bundle canonique persisté | Plus lourd · non nécessaire à la sécurité |

## 9. Stratégie retenue

**C — résolution explicite par run / GenerationPlan / output.**  
Les pointeurs actifs restent un index opérationnel, jamais une preuve d’appartenance au même pipeline.  
Le GP I2V n’est pas activé.

## 10. Contrat de cohérence

Module générique `artifact-bundle-coherence.ts` (aucun UUID 11B) :

- même workspace / projet / scène / run / job ;
- GenerationPlan exact + fingerprint ;
- source et output attendus ;
- capability / action compatibles ;
- QR, PR et HR sur le même output / plan / run ;
- lifecycle et checksum ;
- stale / quarantine refusés ;
- activation indépendante de l’approbation ;
- downstream distinct.

`readMergeExportAuthorized` : fail-closed ; un `false` explicite (`phase11a` / `phase11b` / `delivery`) l’emporte.

## 11. Résolution explicite

`selectExplicitArtifactBundle` refuse l’absence, l’ambiguïté et une sélection qui ne matche pas.  
Le GP I2V rev.3 se charge par id, **sans** `set_active_artifact_revision`.  
L’image 11A reste accessible par son propre bundle explicite.

## 12. Guard merge/export avant et après

**Avant :** `delivery.status === "merge_ready"` suffisait pour prepare/execute merge. Execute dry-run ne vérifiait même pas l’autorisation. L’UI suivait le dry-run.

**Après :**

- merge : `merge_ready` **et** `mergeExportAuthorized=true` ;
- export : autorisation explicite (le merge completed ne suffit plus) ;
- UI : boutons toujours liés au dry-run ; message « `merge_ready` seul n’autorise pas » ; raison redacted.

État live : `mergeAllowed=false` · `exportAllowed=false` · `downstreamAllowed=false` · `merge_ready_without_authorization`.

Le chemin Phase 9 fake pose `delivery.mergeExportAuthorized=true` lors d’un HR APPROVE générique. Les APPROVE 11A/11B gardent `phase11*.mergeExportAuthorized=false`, qui gagne.

## 13. Compatibilité 11A

Accès explicite à l’image `49284892` conservé. Le plan image n’est pas remplacé. Les HR historiques restent valides. Aucun downstream. Budget inchangé. Pointeurs live inchangés.

## 14. Compatibilité 11B

Accès explicite à la vidéo `9be6cb0c` conservé. La vidéo reste `approved` / inactive / unpublished. Elle ne remplace pas l’image. Le plan image n’est pas mélangé au résultat vidéo. 0 provider. 0 budget write.

## 15. Dry-run live

```text
activeGenerationPlan = 11A rev.2
persistedI2vGenerationPlan = I2V rev.3
activeQualityReport = I2V rev.5
activeProductionResult = I2V rev.10
pointerSetCoherent = false
explicitI2vBundleCoherent = true
mergeExportAuthorized = false
mergeAllowed = false
exportAllowed = false
downstreamAllowed = false
mutationRequired = false
mutationAllowed = false
```

Refus exercés : mauvais workspace/projet/run/output · QR/PR/HR d’un autre asset/plan · checksum · stale · `merge_ready` sans autorisation · bundles ambigus.

## 16. Replay et fingerprint

Replay déterministe.  
Fingerprint : `18078129d3a6b8e030316a027e6770034784a01fbb9ee382518531c06775365a`.

## 17. Mutation de pointeur

**Conclusion 1 :** aucune mutation nécessaire. La résolution explicite rend l’état actuel sûr.  
Activer `3d1858eb` n’est **pas** recommandé : ce serait la stratégie A.

## 18. Futur CAS

Aucun. Pas de preflight de reconciliation live préparé. Voice/TTS n’ouvre pas une mutation de pointeur.

## 19. Tests

| Check | Résultat |
|---|---|
| Ciblés cohérence + delivery | **46/46** |
| Suite unitaire | **1732/1732** |
| Typecheck | **PASS** |
| Lint périmètre | **PASS** (warning préexistant `set-state-in-effect` sur mount Livraison) |
| Build | **PASS** |
| pgTAP / intégration DB / E2E | **non relancés** |

## 20. Secret scan

Diff de phase : pas de secret, URL signée, média, base64, clé ou `external_job_id` complet.

## 21. Compteurs

`PROVIDER_CALLS=0` · `SIGNED_URL_COUNT=0` · `MEDIA_READS=0` · `PRODUCTION_WRITES=0` · `POINTER_WRITES=0` · `BUDGET_WRITES=0` · `FLAGS_WRITTEN=0` · `PHASE_COST=0¢`.

## 22. Fichiers modifiés

- `studio/src/application/production/artifact-bundle-coherence.ts`
- `studio/src/application/production/phase-11b-artifact-pointer-coherence.ts`
- `studio/src/application/production/__tests__/artifact-bundle-coherence.test.ts`
- `studio/src/application/production/__tests__/phase-11b-artifact-pointer-coherence.test.ts`
- `studio/src/application/directors/delivery/delivery-for-project.ts`
- `studio/src/application/directors/delivery/__tests__/delivery-for-project.test.ts`
- `studio/src/application/postproduction/post-production-director.ts`
- `studio/src/domain/production/delivery.ts`
- `studio/src/app/director/_components/delivery-section.tsx`
- `docs/Developer-Handover/14_PRODUCTION_DIRECTOR.md`
- docs living + ce rapport

Hors scope : AICCOS.

## 23. Commit et push

Commit de clôture sur `main` · push normal si le scope est propre. Pas de force push.

## 24. Verdict

`ARTIFACT_POINTER_COHERENCE_HARDENED_NO_LIVE_MUTATION_REQUIRED`

## 25. Prochaine porte, non exécutée

`AUTH_11C_VOICE_TTS_PRODUCTION_WIRING_PREFLIGHT`

Ne pas ouvrir une reconciliation de pointeurs en parallèle. Voice doit résoudre explicitement par run/plan/output, jamais par types actifs mélangés.
