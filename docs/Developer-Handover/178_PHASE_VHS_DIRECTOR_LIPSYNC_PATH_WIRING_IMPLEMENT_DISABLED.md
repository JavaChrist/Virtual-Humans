# 178 — VHS Director lipsync path wiring implement (disabled)

**Date :** 2026-08-27  
**Auth :** `AUTH_VHS_DIRECTOR_LIPSYNC_PATH_WIRING_IMPLEMENT_DISABLED_NO_PROVIDER_NO_DEPLOY_NO_FLAG_WRITE`  
**Nature :** câblage local du chemin lipsync `/director` · **WIRED_DISABLED** · fakes seulement · **0** push · **0** deploy · **0** flag write · **0** provider  
**HEAD au départ :** `9b62799`  
**Commit fonctionnel :** `366abd6141a3f4198560769511f8608b0e1ac5d1`  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_DIRECTOR_LIPSYNC_PATH_WIRED_DISABLED_READY
LIPSYNC_EXISTING_COMPONENTS_AUDITED=40
LIPSYNC_CAPABILITIES_CREATED=0
LIPSYNC_REAL_ADAPTERS_CREATED=0
LIPSYNC_FAKE_ADAPTERS_CREATED=1
LIPSYNC_PROVIDER_SELECTED=0
LIPSYNC_REAL_SUBMITS=0
LIPSYNC_REPLAYS_WITH_SECOND_SUBMIT=0
LIPSYNC_RETRIES=0
LIPSYNC_FALLBACKS=0
LIPSYNC_ASSETS_ACTIVATED=0
MERGE_EXPORT_AUTHORIZED=0
MERGE_EXPORT_CALLS=0
UPDATE_BLOCKER_REGISTRIES_CREATED=0
AICCOS_BLOCKERS_INTEGRATED=0
SERVICE_WORKER_WRITES=0
FLAG_WRITES=0
DEPLOY_CALLS=0
GIT_PUSHES=0
PRODUCTION_WRITES=0
SUPABASE_MUTATIONS=0
PROVIDER_CALLS=0
LIPSYNC_PROVIDER_CALLS=0
TTS_CALLS=0
MEDIA_READS=0
MEDIA_WRITES=0
SIGNED_URLS_CREATED=0
STORAGE_UPLOADS=0
BUDGET_WRITES=0
BUDGET_RESERVATIONS=0
PHASE_COST=0¢
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
FUNCTIONAL_COMMIT=366abd6141a3f4198560769511f8608b0e1ac5d1
NEXT_AUTH=AUTH_VHS_DIRECTOR_LIPSYNC_PATH_WIRING_SYNC_AND_DEPLOY_ONCE_NO_PROVIDER_NO_FLAG_WRITE
```

---

## 1. Autorisation consommée

`AUTH_VHS_DIRECTOR_LIPSYNC_PATH_WIRING_IMPLEMENT_DISABLED_NO_PROVIDER_NO_DEPLOY_NO_FLAG_WRITE` — Christian, chat courant.

Porte de **code locale**. Architecture, contrats, guards, idempotence, états, UI désactivée, tests fake, documentation. Aucun `git push`. Aucun déploiement. Aucun flag write. Aucun provider (OpenAI, fal, ElevenLabs). Aucun choix arbitraire de provider lipsync. Aucune dépense. Aucune mutation Supabase. Aucune lecture média Production. Aucune URL signée. Aucune Human Review réelle. Aucune activation. Aucun merge/export. `sw.js` intact. AICCOS hors scope. RideCloud apply non consommée.

La synchronisation documentaire de `177_` est **terminée** dans ce living handover (origin/main = `9b62799`). Aucun rapport séparé n’est créé pour cette sync.

`157_`–`177_` restent des snapshots immuables.

## 2. Git

| Champ | Attendu Auth | Réel initial | Réel après commit fonctionnel |
|---|---|---|---|
| Branche | `main` | `main` | `main` |
| HEAD départ | `9b62799` | `9b62799446a9a7475a9b4473f922a41fc31eb1e4` | fonctionnel **`366abd6`** |
| origin/main | `9b62799` | `9b62799` | **`9b62799` inchangé** |
| ahead/behind départ | `0/0` | `0/0` | **`1/0`** puis `2/0` après docs |
| Dirty départ | 2 AICCOS | 2 AICCOS, index vide | 2 AICCOS non stagés |
| Fetch lecture seule | oui | effectué | origin/main toujours `9b62799` |

Préconditions fail-closed **PASS**. Aucun reset / restore / stash / rebase / amend. AICCOS jamais stagés.

## 3. Matrice d’audit (40)

| # | Composant existant | Réutilisable | Adaptation | Fichier | Risque | Décision |
|---|---|---|---|---|---|---|
| 1 | Client projet `/director` | oui | insérer section après Production | `director-project-client.tsx` | faible | étendu |
| 2 | Production Section | oui | aucun | `production-section.tsx` | faible | inchangé |
| 3 | Delivery Section | oui | merge reste fermé | `delivery-section.tsx` | moyen | inchangé |
| 4 | Voice narrator selector | oui | hors lipsync | `voice-narrator-selector.tsx` | faible | inchangé |
| 5 | Motion review | oui | isolé Motion | `motion-review-section.tsx` | faible | inchangé |
| 6 | Page Studio `/lipsync` | non comme preuve Director | rester legacy | `lipsync/page.tsx` | élevé si confondu | isolé |
| 7 | Route `/api/generate/lipsync` | non | refuse comme preuve | `api/generate/lipsync/route.ts` | élevé | interdit 11D |
| 8 | Adapter fal lipsync | non sélectionné | aucun choix | `fal-adapter.ts` | élevé | **unavailable** |
| 9 | Fake universel | non comme preuve | fake 11D dédié | `fake-universal-adapter.ts` | moyen | non réutilisé |
| 10 | Profil `audio.lipsync` | oui | typage explicite | `capability-profiles.ts` | faible | **réutilisé** |
| 11 | Validation génération lipsync | oui | aucun | `validation.ts` | faible | inchangé |
| 12 | QC kind lipsync | oui | QC préparé 11D | `quality.ts` | faible | inchangé + QC 11D |
| 13 | Stratégie dialogue Router | non exécutée | aucun | `strategy-library.ts` | moyen | non ouverte |
| 14 | Registry E2E lipsync | E2E only | aucun | `e2e-capability-registry.ts` | faible | inchangé |
| 15 | Run/job I2V 11B | pattern oui | miroir mémoire | `phase-11b-*` | moyen | étendu en 11D |
| 16 | Run/job Voice 11C | pattern oui | miroir mémoire | `phase-11c-voice-worker.ts` | moyen | étendu en 11D |
| 17 | HR Voice `lipsyncAuthorized=false` | oui | garde amont | `phase-11c-voice-human-review.ts` | faible | inchangé |
| 18 | Audit clôture 11C | snapshot | aucun | `phase-11c-close-and-next-gate-audit.ts` | faible | inchangé |
| 19 | Cohérence artifacts | oui | lire `phase11d` | `artifact-bundle-coherence.ts` | moyen | **étendu** |
| 20 | Réf. asset image 11A | pattern oui | frère timed | `existing-media-asset-reference.ts` | moyen | nouveau timed |
| 21 | Réf. voix 11C | non vidéo | aucun | `existing-voice-reference.ts` | faible | inchangé |
| 22 | Registre blockers | oui | 0 second registre | `update-blockers.ts` | élevé si doublé | **réutilisé** |
| 23 | Policy blockers | oui | predicat lipsync | `update-blocker-policy.ts` | faible | **étendu** |
| 24 | Reasons blockers | oui | id `director-lipsync` | `update-blocker-reasons.ts` | faible | **étendu** |
| 25 | Hook `useUpdateBlocker` | oui | section lipsync | `use-update-blocker.ts` | faible | **câblé** |
| 26 | `DIRECTOR_V2_ENABLED` | lecture seule | aucun write | flags | élevé | **non écrit** |
| 27 | `parseStrictEnabledFlag` | oui | audit flags 11D | `feature-flags.ts` | faible | lecture seule |
| 28 | Delivery merge auth | oui | false gagne | `delivery-for-project.ts` | élevé | inchangé |
| 29 | SQL `kind='lipsync'` | déjà là | 0 migration | migrations | élevé si apply | **pas de migration** |
| 30 | Post-production director | non ouvert | aucun | `post-production-director.ts` | moyen | inchangé |
| 31 | Plan I2V sans lipsync | oui | borné 11B | `phase-11b-single-step-plan.ts` | faible | inchangé |
| 32 | RideCloud lipsync-free | oui | 1re pub sans lipsync | contrats RideCloud | faible | inchangé |
| 33 | Nav Studio Lip-sync | hors Director | aucun | `nav.tsx` | faible | inchangé |
| 34 | Blocker `generate-lipsync` | Studio page | id Director distinct | `update-blocker-reasons.ts` | faible | id séparé |
| 35 | E2E `/director` fake | flag OFF | source markup | `director-off.spec.ts` | faible | source + off |
| 36 | Fraîcheur living | oui | nextPhase 11D | `current-state-freshness.test.ts` | faible | aligné |
| 37 | Schéma capability lipsync | oui | aucun | `capabilities/schemas.ts` | faible | inchangé |
| 38 | Pricing legacy lipsync | non choisi | aucun | `legacy-pricing-adapter.ts` | moyen | inchangé |
| 39 | Estimate coût lipsync | hors exécution | aucun | `domain/cost` | faible | inchangé |
| 40 | Ingest Voice contexte I2V | garde amont | aucun | `phase-11c-voice-ingest.ts` | faible | inchangé |

**Décision architecturale :** étendre les abstractions I2V/Voice (références explicites, plan non persisté, run in-memory, QC/HR préparés, registre blockers unique). Pas d’architecture parallèle. Capability domaine **`audio.lipsync` réutilisée** → `LIPSYNC_CAPABILITIES_CREATED=0`. Adapter réel **absent**. Fake local `fake-local-lipsync` **≠** validation provider.

## 4. Chemin câblé

Vidéo approuvée + audio approuvé (métadonnées / fixtures opaques)  
→ validation des références  
→ plan lipsync non persisté  
→ capability `audio.lipsync` / action `lipsync`  
→ adapter fake déterministe **ou** refus disabled  
→ QC préparé (pas d’auto-approve)  
→ Human Review future (non persistée)  
→ `mergeExportAuthorized=false`.

Sélection explicite : références distinctes, même workspace/projet, MIME `video/mp4` + `audio/mpeg`, lifecycle `approved`, privé, `active=false` accepté uniquement parce que le pipeline référence un asset approuvé existant, pas de mélange 11A/still, pas d’IDs Production en dur.

## 5. Gates fail-closed (tous OFF)

| Gate | Env lu seulement | Valeur |
|---|---|---|
| capability | `VHS11D_LIPSYNC_CAPABILITY_ENABLED` | OFF |
| paid | `VHS11D_LIPSYNC_PAID_ENABLED` | OFF |
| provider | `VHS11D_LIPSYNC_PROVIDER_ENABLED` | OFF |
| worker | `VHS11D_LIPSYNC_WORKER_ENABLED` | OFF |
| exception `/director` | `VHS11D_LIPSYNC_DIRECTOR_EXCEPTION` | OFF |
| downstream merge/export | `VHS11D_LIPSYNC_DOWNSTREAM_ENABLED` | OFF |

Aucune valeur Vercel définie. Provider lipsync = **`unavailable`**. Exécution réelle toujours refusée.

## 6. Idempotence et durabilité

- Clé SHA-256 déterministe (workspace, projet, assets, fingerprints).
- Replay = état existant / fake déterministe, **0** second submit.
- Terminaux `completed` / `failed` / `cancelled` immuables.
- 0 retry, 0 fallback, 0 second provider.
- `completed` n’ouvre pas merge/export.
- Plan et run **in-memory** : aucune migration, aucune écriture Production.

## 7. UI `/director`

Section **Lipsync** après Production, avant Delivery. État « préparé mais désactivé ». Dry-run local sans blocker. Bouton d’exécution réelle **disabled**. Aucun `<select>` provider. `DIRECTOR_V2_ENABLED` inchangé. Navigation `/director` non activée. Lipsync non présenté comme disponible en Production.

## 8. Blocker app-update

Registre **unique** réutilisé. Id `director-lipsync`. Raison canonique « Une génération est en cours. » Predicat `shouldBlockLipsyncInFlight` = même exception dry que Production. Absent pendant dry-run. Présent seulement si une opération réelle était in-flight. Cleanup succès / erreur / annulation / démontage. 0 apply automatique. 0 second registre. AICCOS hors scope.

## 9. Tests et validations

| Contrôle | Résultat |
|---|---|
| Tests ciblés 11D + view | **18/18** |
| Delivery / Production / registry / blockers | **PASS** |
| Suite unitaire | **1975/1976** avant docs (fraîcheur nextPhase) puis **1976/1976** |
| typecheck | PASS |
| lint | 0 error |
| build Production local | PASS |
| E2E fake `/director` | harnais OFF (`director-off`) · markup source 11D |
| Fraîcheur living | alignée dans le commit docs |
| secret scan | 0 hit sur les fichiers de porte |

## 10. Ledger et compteurs

Ledger inchangé : **437 / 391 / 0 / 46**.  
`PHASE_COST=0¢`. Origin/main reste `9b62799`.

## 11. Prochaine porte — non exécutée

```text
AUTH_VHS_DIRECTOR_LIPSYNC_PATH_WIRING_SYNC_AND_DEPLOY_ONCE_NO_PROVIDER_NO_FLAG_WRITE
```

Synchronisation et déploiement unique du wiring lipsync. Toujours **sans** provider ni flag. Le choix d’un provider lipsync réel, son preflight, toute dépense, activation, Human Review ou merge/export exigent des Auth humaines séparées.
