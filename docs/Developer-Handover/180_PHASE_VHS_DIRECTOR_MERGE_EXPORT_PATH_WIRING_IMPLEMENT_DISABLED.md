# 180 — VHS Director merge/export path wiring implement disabled

**Date :** 2026-08-27  
**Auth :** `AUTH_VHS_DIRECTOR_MERGE_EXPORT_PATH_WIRING_IMPLEMENT_DISABLED_NO_PROVIDER_NO_DEPLOY_NO_FLAG_WRITE`  
**Nature :** code local · **0** push · **0** deploy · **0** provider · **0** moteur · **0** flag write  
**SHA fonctionnel :** `a602de974a7029b355300d0e3d320f487d3c5d73`  
**Parent :** `134631d`  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_DIRECTOR_MERGE_EXPORT_PATH_WIRED_DISABLED_READY
FUNCTIONAL_COMMIT=a602de9
SOURCE_HEAD=134631d
MERGE_EXPORT_EXISTING_COMPONENTS_AUDITED=48
MERGE_CAPABILITIES_CREATED=0
EXPORT_CAPABILITIES_CREATED=0
REAL_MERGE_ADAPTERS_CREATED=0
REAL_EXPORT_ADAPTERS_CREATED=0
FAKE_MERGE_ADAPTERS_CREATED=1
FAKE_EXPORT_ADAPTERS_CREATED=1
REAL_MERGES=0
REAL_EXPORTS=0
MERGE_REPLAYS_WITH_SECOND_SUBMIT=0
EXPORT_REPLAYS_WITH_SECOND_SUBMIT=0
MERGE_RETRIES=0
EXPORT_RETRIES=0
MERGE_FALLBACKS=0
EXPORT_FALLBACKS=0
FILES_CREATED_BY_MERGE_EXPORT=0
SIGNED_URLS_CREATED=0
DOWNLOADS_TRIGGERED=0
ASSETS_ACTIVATED=0
ASSETS_PUBLISHED=0
MERGE_EXPORT_AUTHORIZED=0
UPDATE_BLOCKER_REGISTRIES_CREATED=0
AICCOS_BLOCKERS_INTEGRATED=0
SERVICE_WORKER_WRITES=0
FLAG_WRITES=0
DEPLOY_CALLS=0
GIT_PUSHES=0
PRODUCTION_WRITES=0
SUPABASE_MUTATIONS=0
PROVIDER_CALLS=0
MEDIA_READS=0
MEDIA_WRITES=0
STORAGE_UPLOADS=0
BUDGET_WRITES=0
BUDGET_RESERVATIONS=0
PHASE_COST=0¢
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
```

## 1. Objectif

Câbler le chemin final merge/export `/director` en `WIRED_DISABLED` : bundle explicite, plans non persistés, fakes métadonnées, QC préparé, Human Review future non persistée, manifeste synthétique. Aucun fichier, URL, moteur, média Production ni publication.

## 2. Audit initial (48 composants)

| # | Composant | État | Réutilisable | Adaptation | Risque | Décision |
|---|---|---|---|---|---|---|
| 1 | Delivery Section | UI QC/HR/merge/export existante | oui | bandeau WIRED_DISABLED | `merge_ready` ≠ auth | extend |
| 2 | Boutons export Delivery | Phase 9 fake | oui | inchangés, fail-closed serveur | faible | reuse |
| 3 | LipsyncSection | 11D WIRED_DISABLED | oui | ordre pipeline | faible | reuse |
| 4 | Fake merge Phase 8–9 | bytes locaux | non pour 11E | bytes interdits | faux fichier | new metadata fake |
| 5 | local-fake-delivery | gate process-local | oui | hors 11E | Vercel | reuse |
| 6 | PostProductionDirector | Phase 9 pose auth true | partiel | 11A–11E `false` gagne | sémantique | extend |
| 7 | Routes legacy merge | fal / mux | non | interdit comme preuve | provider | refuse |
| 8 | ProductionResult / delivery | `mergeExportAuthorized?` | oui | `phase11e` | faible | extend |
| 9 | QualityReport | FinalQualityReport | oui | QC 11E séparé | faible | reuse |
| 10 | artifact-bundle-coherence | fail-closed | oui | lire `phase11e` | un `false` gagne | extend |
| 11 | Tests coherence | 15+ cas | oui | cas 11E | — | extend |
| 12 | phase-11b pointer coherence | appelle readMerge | oui | — | — | reuse |
| 13 | existing-media-asset-reference | still 11A | oui | rejeté comme source | mélange | reuse |
| 14 | existing-voice-reference | Voice | oui | pas comme vidéo | — | reuse |
| 15 | existing-timed-media-asset-reference | I2V/Voice | oui | bundle 11E | — | reuse |
| 16 | phase-11d references | paire lipsync | oui | lipsync fake/real | — | extend |
| 17 | Capability registry génération | pas de merge/export | oui | 0 nouvelle profile | — | reuse |
| 18 | capability-profiles | audio.lipsync etc. | oui | 0 ajout | — | reuse |
| 19 | MergeEngineCapabilities | stub OFF | oui | `STUB_MERGE_CAPABILITIES` | — | reuse |
| 20 | MergeEngine ports | validate/execute | oui | pas d’adapter réel | — | reuse |
| 21 | fal-compose-merge-engine | réel | non | non sélectionné | coût | unused |
| 22 | merge-stub | unavailable | oui | — | — | reuse |
| 23 | export-stubs / aiccos adapter | AICCOS hors scope | oui | non câblé | AICCOS | unused |
| 24 | Router génération | hors merge | oui | — | — | reuse |
| 25 | Plan 11D + SHA-256 | template | oui | copie 11E | — | extend |
| 26 | RPC delivery SQL | persist runs | non cette porte | mémoire | migration | unused |
| 27 | Run-state 11D | terminaux immuables | oui | merge + export | — | extend |
| 28 | readMergeExportAuthorized | 11A–11D | oui | + phase11e | — | extend |
| 29 | refuseMergeExportIfUnauthorized | downstream false | oui | — | — | reuse |
| 30 | Routes director merge/export/download | Phase 9 | oui | 11E n’y écrit pas | — | reuse |
| 31 | director-final-asset-path | bucket final | non 11E | 0 fichier | — | unused |
| 32 | download-final-asset | bytes | non 11E | 0 download | — | unused |
| 33 | QC/HR delivery-for-project | Phase 9 | oui | 11E QC séparé | — | reuse pattern |
| 34 | HR 11A–11D | `mergeExportAuthorized=false` | oui | même règle 11E | — | reuse |
| 35 | update-blocker-reasons | registre unique | oui | `directorMergeExport` | — | extend |
| 36 | update-blocker-policy | dry exempt | oui | `shouldBlockMergeExportInFlight` | — | extend |
| 37 | update-blockers registry | Map ref-count | oui | 0 second registre | — | reuse |
| 38 | use-update-blocker | hook | oui | — | — | reuse |
| 39 | Migration vhs_125 | kinds export | oui | 0 nouvelle migration | — | unused |
| 40 | Template 11D allowlist/plan/fake/qc/UI | WIRED_DISABLED | oui | miroir 11E | — | extend |
| 41 | director-project-client | insertion Lipsync | oui | + MergeExportSection | — | extend |
| 42 | E2E fake `/director` | harnais local | partiel | tests orchestration 11E | flag | unit as local E2E |
| 43 | ProductionResult phase11d | false | oui | phase11e | — | extend |
| 44 | Flags 11D | 6 gates OFF | oui | 7 gates 11E OFF | write Vercel | read-only |
| 45 | Ledger 437/391/0/46 | live | oui | inchangé | — | reuse |
| 46 | RideCloud apply | suspendu | oui | non consommé | — | unused |
| 47 | AICCOS send/UI | dirty hors scope | non | intact | — | unused |
| 48 | sw.js / manifest | PWA | non | 0 write | — | unused |

Aucune architecture parallèle. Les capabilities merge/export réutilisent `postproduction.merge` / `postproduction.export` et `STUB_MERGE_CAPABILITIES`. **0** nouvelle capability registry.

## 3. Livrable

- Bundle explicite I2V + Voice + lipsync (fake accepté seulement en mode fake ; réel exigé pour un futur mode réel).
- Sélection last-active **refusée**.
- Plans merge/export non persistés, clés SHA-256 déterministes.
- Fake merge + fake export : métadonnées seulement, `synthetic=true`, 0 fichier, 0 URL, 0 download.
- Export **jamais** auto-démarré après merge.
- Replay sans second submit. 0 retry. 0 fallback. Terminaux immuables. Annulation. Erreur structurée.
- QC préparé, HR future `decision=none`, `mergeExportAuthorized=false`.
- UI Delivery + section Merge/Export « préparé mais désactivé ». Pas de `<select>` moteur.
- Blocker `director-merge-export` sur le registre unique ; dry/fake sync n’enregistre pas.

## 4. Validations

- Tests ciblés 11E **21/21** · vue **3/3** · related **75/75**
- Suite **2002/2002**
- typecheck PASS
- lint **0 erreur**
- build local PASS
- fraîcheur living handover (après commit docs)
- secret scan officiel sur les fichiers 11E : **0 hit**

## 5. Git

- origin/main resté `134631d`
- commit fonctionnel `a602de9` local
- commit documentaire distinct après ce rapport
- 2 AICCOS dirty non stagés
- 0 push

## 6. Prochaine porte — non exécutée

`AUTH_VHS_DIRECTOR_MERGE_EXPORT_PATH_WIRING_SYNC_AND_DEPLOY_ONCE_NO_PROVIDER_NO_FLAG_WRITE`

Toute exécution réelle, publication, téléchargement ou sélection de moteur exige une Auth humaine séparée.
