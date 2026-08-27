# 176 — VHS app update blockers workflow integration implement

**Date :** 2026-08-27  
**Auth :** `AUTH_VHS_APP_UPDATE_BLOCKERS_WORKFLOW_INTEGRATION_IMPLEMENT_NO_DEPLOY_NO_FLAG_WRITE`  
**Nature :** câblage local du registre `registerUpdateBlocker` existant aux workflows longs/sensibles **non-AICCOS** · **0** push · **0** deploy · **0** flag write  
**HEAD au départ :** `3f83f4f` (`175_` local, non poussé)  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_APP_UPDATE_BLOCKERS_WORKFLOW_INTEGRATION_IMPLEMENT_READY
WORKFLOWS_AUDITED=32
WORKFLOWS_BLOCKER_INTEGRATED=18
WORKFLOWS_EXCLUDED=14
UPDATE_BLOCKER_REGISTRIES_CREATED=0
AICCOS_BLOCKERS_INTEGRATED=0
STALE_BLOCKERS_AFTER_TESTS=0
SKIP_WAITING_DURING_BLOCKER_TESTS=0
RELOAD_DURING_BLOCKER_TESTS=0
SERVICE_WORKER_WRITES=0
MANIFEST_WRITES=0
FLAG_WRITES=0
DEPLOY_CALLS=0
GIT_PUSHES=0
PRODUCTION_WRITES=0
SUPABASE_MUTATIONS=0
PROVIDER_CALLS=0
TTS_CALLS=0
MEDIA_READS=0
MEDIA_WRITES=0
STORAGE_UPLOADS=0
BUDGET_WRITES=0
BUDGET_RESERVATIONS=0
PHASE_COST=0¢
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
FUNCTIONAL_COMMIT=045f48ad65cfd4fcd14e4a6942c1ccdead71c007
NEXT_AUTH=AUTH_VHS_APP_UPDATE_BLOCKERS_WORKFLOW_INTEGRATION_SYNC_AND_DEPLOY_ONCE_NO_FLAG_WRITE
```

---

## 1. Autorisation consommée

`AUTH_VHS_APP_UPDATE_BLOCKERS_WORKFLOW_INTEGRATION_IMPLEMENT_NO_DEPLOY_NO_FLAG_WRITE` — Christian, chat courant.

Porte de **code locale**. Inspection, implémentation, tests, documentation, commits locaux. Aucun `git push`. Aucun déploiement. Aucun flag write. Aucun provider. Aucune dépense. Aucune mutation Production/Supabase. `sw.js`, manifest, `clients.claim()` et le filtre d’identité de build **intacts**. Les deux fichiers AICCOS protégés restent dirty, non stagés, non committés, **non câblés**. RideCloud apply non consommée. La porte de sync/deploy n’est pas exécutée.

`157_`–`175_` restent des snapshots immuables.

## 2. Git

| Champ | Attendu Auth | Réel initial | Réel final (après commits de cette porte) |
|---|---|---|---|
| Branche | `main` | `main` | `main` |
| HEAD départ | `3f83f4f` | `3f83f4f1c744996bf9a7b5665e52aaf55468b102` | fonctionnel **`045f48a`** + commit documentaire local |
| origin/main | `80cc7fa` | `80cc7fa8b68707fa9d7dab2707ca9003ef551bd2` | **`80cc7fa` inchangé** |
| ahead/behind départ | `1/0` | `1/0` | **`3/0`** attendu |
| Unique commit local non poussé au départ | `3f83f4f` | oui | `3f83f4f` préservé |
| Dirty départ | 2 AICCOS | 2 AICCOS, index vide | 2 AICCOS non stagés |
| Fetch lecture seule | oui | `git fetch origin` | origin/main toujours `80cc7fa` |

Préconditions fail-closed **PASS**. Aucun reset / restore / stash / rebase / amend.

## 3. Inventaire audité

Critères YES : génération/orchestration asynchrone, écriture non confirmée, soumission perdue au reload, état local significatif non persisté, `pending|running|saving|submitting|generating|processing`, interruption sans confirmation.

Non-blockers : fetch de lecture, poll sans job, chargement initial, navigation passive, erreur terminale, formulaire vide/inchangé, état déjà sauvé, opération provider jamais commencée.

### 3.1 Matrice retenue (18)

| Workflow | Risque reload | Blocker | Raison | Enregistrement | Cleanup | Tests |
|---|---|---|---|---|---|---|
| Directeurs texte ×5 | génération + persist artifact | oui | Une génération est en cours. | `useDirectorProcessing` dès `isDirectorUiProcessing` | succès / échec / idle / unmount | policy + source processing |
| Production Director | run non terminal ou execute/cancel/approve | oui | Une génération est en cours. | `shouldBlockProductionRun` | `finally` busy + run terminal + unmount | policy production |
| Création projet | POST projet après validation | oui | Votre projet est en cours d’enregistrement. | `setSubmitting(true)` **après** `normalizeBriefFields` | `finally` / unmount | source wizard |
| Brouillon brief | dirty ou saving autosave | oui | Des modifications ne sont pas encore enregistrées. | `displayStatus` dirty\|saving | saved/idle/error/unmount | policy autosave |
| Révision brief | execute seulement | oui | Votre projet est en cours d’enregistrement. | busy=`execute` après confirm | `finally` | policy non-dry |
| Delivery | qc-exec, review, merge-prep/exec, export, dl-media | oui | Votre projet est en cours d’enregistrement. | busy hors `qc-dry` | `finally` | policy |
| Routing | execute / approve | oui | Votre projet est en cours d’enregistrement. | busy hors `dry` | `finally` | policy |
| Prompts | execute | oui | Une génération est en cours. | busy hors `dry` | `finally` | policy |
| Motion review | POST décision après confirm | oui | Votre projet est en cours d’enregistrement. | `decisionBusy` (pas le GET `load`) | `finally` / unmount | source motion |
| Studio image | `loading` generate | oui | Une génération est en cours. | `loading` | `finally` | wiring |
| Studio voix | `loading` generate | oui | Une génération est en cours. | `loading` | `finally` | wiring |
| Studio vidéo | job in-flight | oui | Une génération est en cours. | `shouldBlockStudioJob` | statut terminal / erreur / unmount | policy studio |
| Studio lipsync | voix ou job in-flight | oui | Une génération est en cours. | `voiceBusy` ou job | `finally` / terminal | policy |
| Studio scène génération | image, voix ou vidéo | oui | Une génération est en cours. | busy composite | terminal / `finally` | policy |
| Studio scène save | POST scène | oui | Votre projet est en cours d’enregistrement. | `sceneSaving` après nom+character | `finally` | wiring |
| Storyboard | master/duo/merge/shots/partners | oui | Une génération est en cours. | `shouldBlockStoryboard` | dernier job terminal / unmount | policy concurrent |
| Produits | save / addScreens / delete après confirm | oui | Votre projet est en cours d’enregistrement. | `saving` | `finally` | wiring |
| Login | POST session | oui | Connexion en cours. | `busy` | succès (navigation) / erreur / unmount | wiring |

### 3.2 Matrice écartée (14)

| Workflow | Risque reload | Blocker | Raison d’écart |
|---|---|---|---|
| Dashboard | lecture | non | fetch lecture |
| Settings | lecture | non | fetch lecture |
| Budget | lecture | non | fetch lecture |
| Characters | lecture | non | fetch lecture |
| Dry-run Director | vérification locale | non | `dry` / `dry-run` / `qc-dry` |
| Motion GET initial | chargement page | non | lecture ; `ui=loading` ≠ submit |
| Confirming Director | modale avant confirm | non | validation locale encore refusable |
| Estimate POST | coût | non | pas une génération / persist métier |
| Drafts `usePersistentState` idle/saved | déjà durable | non | distinction fiable absente ou déjà sauvé |
| Formulaire ouvert inchangé | écran seulement | non | pas de dirty tracking vaste |
| AICCOS | envoi | **non — interdit** | collision fichiers protégés |
| Erreur terminale | déjà fini | non | pas d’opération active |
| Provider disabled jamais démarré | aucun | non | flags OFF, pas de `loading` |
| Chargement / navigation passifs | aucun | non | hors critères |

## 4. Fichiers fonctionnels

Registre **réutilisé** : `studio/src/lib/update-blockers.ts`. **0** second registre, **0** seconde modale PWA, **0** `sw.js`.

Ajouts :

- `studio/src/lib/update-blocker-reasons.ts`
- `studio/src/lib/update-blocker-policy.ts`
- `studio/src/lib/use-update-blocker.ts`
- tests `update-blocker-policy` / `integration` / `wiring-source`

Câblage : hooks Director listés ci-dessus + pages image, voix, vidéo, lipsync, scène, storyboard, produits, login.

## 5. Raisons utilisateur

| Clé | Texte |
|---|---|
| generating | Une génération est en cours. |
| saving | Votre projet est en cours d’enregistrement. |
| unsaved | Des modifications ne sont pas encore enregistrées. |
| login | Connexion en cours. |

Courtes, sans HTML, sans id interne, sans prompt, sans secret, sans média, sans donnée personnelle.

## 6. Cleanup et refcount

`useUpdateBlocker` enregistre seulement si `active` ; l’effet React rend le cleanup du registre au passage `active→false`, au changement d’id/raison, et au démontage.

Un cleanup par enregistrement ; second appel no-op (`released`).

Opérations concurrentes **même id** : refcount du registre (storyboard multi-plans). Opérations **ids distincts** : plusieurs raisons visibles, apply refusé tant qu’il en reste une.

Cleanup **ne déclenche pas** l’application de la mise à jour. L’utilisateur doit relancer explicitement. `SKIP_WAITING` et reload restent à 0 pendant le blocage.

Corrections de timing (sans changer le métier provider) :

- brief-wizard : `setSubmitting(true)` **après** validation `normalizeBriefFields` ;
- Director texte : processing, **pas** `confirming` ;
- Motion : `decisionBusy` submit-only, **pas** le GET `load`.

## 7. Tests

| Suite | Résultat |
|---|---|
| Ciblés blockers + policy + integration + wiring + `update-blockers` + `app-update-client` + `pwa-register-source` + `director-processing` | **37/37 PASS** |
| Director UI + login markup + MT-010 | **45/45 PASS** |
| Suite unitaire complète | **1956/1956 PASS** |
| typecheck | PASS |
| lint | **0 error** (33 warnings préexistants) |
| build Production local | PASS |
| fraîcheur living handover | PASS (après commit documentaire) |
| secret scan officiel (`findSecretHits`) | **0 hit** / 24 fichiers de porte |

Preuves comportementales : enregistrement au vrai start ; absence avant start ; raison user ; registre visible ; apply refusé ; 0 `SKIP_WAITING` pendant blocage ; 0 reload pendant blocage ; cleanup succès/erreur/annulation/unmount ; idempotence ; refcount concurrent ; opération terminée ne bloque plus ; fetch lecture ≠ blocker ; AICCOS non câblé ; `sw.js` sans `update-blocker` ; hash `studio/public/sw.js` inchangé `341d3cf8…`.

## 8. Preuves d’invariants

- AICCOS : `git status` ` M` non stagé ; source test sans `registerUpdateBlocker` / `useUpdateBlocker`.
- `sw.js` : `git diff` vide ; test source.
- 0 provider / 0 flag write / 0 deploy / 0 push.
- Ledger inchangé 437 / 391 / 0 / 46.
- `DIRECTOR_V2_ENABLED` non écrit ; câblage `/director` local testable seulement.

## 9. Limites restantes

- AICCOS **non protégé** (interdit par cette porte).
- Formulaires sans dirty tracking fiable **non bloqués** du seul fait d’être ouverts.
- Dry-run Director **non bloqué**.
- Cleanup ne relance pas l’apply (volontaire).
- `clients.claim()` / multi-onglets / filtre docs-only **inchangés**.
- Mécanisme **non déployé** tant que la prochaine Auth n’a pas poussé `main`.
- Notification E2E réelle toujours non observée (`175_`).

## 10. Compteurs

```text
WORKFLOWS_AUDITED=32
WORKFLOWS_BLOCKER_INTEGRATED=18
WORKFLOWS_EXCLUDED=14
UPDATE_BLOCKER_REGISTRIES_CREATED=0
AICCOS_BLOCKERS_INTEGRATED=0
STALE_BLOCKERS_AFTER_TESTS=0
SKIP_WAITING_DURING_BLOCKER_TESTS=0
RELOAD_DURING_BLOCKER_TESTS=0
SERVICE_WORKER_WRITES=0
MANIFEST_WRITES=0
FLAG_WRITES=0
DEPLOY_CALLS=0
GIT_PUSHES=0
PRODUCTION_WRITES=0
SUPABASE_MUTATIONS=0
PROVIDER_CALLS=0
TTS_CALLS=0
MEDIA_READS=0
MEDIA_WRITES=0
STORAGE_UPLOADS=0
BUDGET_WRITES=0
BUDGET_RESERVATIONS=0
PHASE_COST=0¢
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
FUNCTIONAL_COMMIT=045f48ad65cfd4fcd14e4a6942c1ccdead71c007
```

## 11. Prochaine Auth exacte — non exécutée

```text
AUTH_VHS_APP_UPDATE_BLOCKERS_WORKFLOW_INTEGRATION_SYNC_AND_DEPLOY_ONCE_NO_FLAG_WRITE
```

Synchroniser les commits locaux (`3f83f4f`, `045f48a`, commit documentaire `176_`) et déployer **une fois** l’intégration des blockers. **0 flag provider.** Ne pas activer le Réalisateur IA, RideCloud, le filtre docs-only, AICCOS, ni une phase média.
