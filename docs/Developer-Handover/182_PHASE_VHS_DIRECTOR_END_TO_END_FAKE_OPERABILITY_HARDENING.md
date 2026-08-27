# 182 — Director end-to-end fake operability hardening

**Auth :** `AUTH_VHS_DIRECTOR_END_TO_END_FAKE_OPERABILITY_HARDENING_IMPLEMENT_NO_DEPLOY_NO_FLAG_WRITE_NO_PROVIDER`  
**Verdict :** `VHS_DIRECTOR_END_TO_END_FAKE_OPERABILITY_HARDENED_READY`  
**Date :** 2026-08-27  
**Branche :** `main`  
**SHA fonctionnel :** `d376a7c4fa273641336b939e73f03a8207428e68` (`d376a7c`)  
**SHA documentaire :** renseigné au commit docs de cette porte  
**origin/main resté :** `26e9b0267ab8bdcd650e23886308e5442d8f2244`  
**Push :** 0  
**Déploiement :** 0  
**Flag writes :** 0  
**Providers :** 0  

---

## 1. Objectif

Durcir l’expérience utilisateur du Réalisateur IA et prouver localement, derrière une barrière réseau fail-closed, le parcours fake :

Brief → Marketing → Creative → Script → Art → Storyboard → Prompt → Routing → Production → Voice → Lipsync → Merge → Export synthétique.

Aucun média réel, aucun export réel, aucun provider, aucune mutation Production.

---

## 2. Préconditions

| Contrôle | Résultat |
|---|---|
| Branche `main` | PASS |
| HEAD de départ = origin/main = `26e9b02` | PASS |
| Ahead/behind départ | 0/0 |
| Dirty hors scope | 2 fichiers AICCOS seulement |
| Index vide | PASS |
| Flags Production | OFF |
| `mergeExportAuthorized` | false |
| Adapters réels lipsync / merge-export | absents |
| RideCloud apply | `SUSPENDED_NOT_CONSUMED` |
| Ledger | 437 / 391 / 0 / 46 |
| AICCOS | non touché, non stagé |

---

## 3. Matrice des défauts

| ID | Étape | Action | Observé | Sévérité | Correction | Test |
|---|---|---|---|---|---|---|
| D1 | Livraison | Télécharger le média final | Libellé et ancre `download` laissaient croire à un fichier réel | HIGH | Boutons locaux désactivés, plus d’ancre download | `merge-export-section-view` · journey |
| D2 | Lipsync / Merge | Ouvrir les sections | `videoResolved/audioResolved` forcés à `true` | HIGH | Prérequis réels depuis script + routage | lipsync/merge view + operability |
| D3 | Pipeline | Se situer | Aucune progression visible | MEDIUM | Nav `director-pipeline-progress` + événements d’étape | pipeline unit + journey |
| D4 | Merge/Export | Lire le blocage | Jargon `mergeExportAuthorized` | MEDIUM | Copie humaine « L’export réel n’est pas autorisé » | merge view |
| D5 | Reprise | Banner stale | Types internes d’artifacts | MEDIUM | `humanArtifactLabel` | pipeline unit |
| D6 | E2E | Happy path | Téléchargement Phase 9 pris pour succès | HIGH | Voix → lipsync → manifeste 11E ; 0 download | `director-journey` ×2 |
| D7 | Barrière | Requête hors local | Hosts non-provider en `fallback()` | HIGH | Toute URL non locale abort + `assertClean` | `network-barrier` |
| D8 | Export | Fin de parcours | Pas de manifeste synthétique visible | MEDIUM | `director-synthetic-export-manifest` | journey · merge section |
| D9 | Production fake | Worker | `dataUrl` persisté → jobs failed, run zombie | HIGH | Fake adapter = `internal` metadata only | fake-adapter unit · journey |
| D10 | Auth E2E | Logout | `goto /director` aborté (course bouton + navigation) | MEDIUM | Logout UI attend `/login` sans second goto | `auth-and-eye` |
| D11 | QC | Dry-run | `empty_file` si `sizeBytes=0` | LOW | Taille synthétique 86, sans bytes | journey |

**Écartés / différés :** audit WCAG complet ; flag Director Production ON ; suppression des APIs Phase 9 ; refonte graphique ; `vh_spend` 42501 local (non bloquant).

DIRECTOR_UI_DEFECTS_FOUND=11  
DIRECTOR_UI_DEFECTS_FIXED=11  
DIRECTOR_UI_DEFECTS_DEFERRED=4  

---

## 4. Corrections

- Progression humaine (étapes done / current / locked / prepared_disabled).
- Prérequis lipsync/merge honnêtes ; boutons fake activés seulement si les métadonnées existent.
- Livraison : « Export réel non autorisé » ; plus de téléchargement réel.
- Fake adapter : chemin interne `e2e-fake/…`, aucun `dataUrl`.
- Barrière E2E : allowlist locale uniquement ; abort immédiat sinon.
- Harnais : happy path ×2 + 8 scénarios d’opérabilité.

---

## 5. Scénarios E2E

| # | Scénario | Spec | Résultat |
|---|---|---|---|
| 1 | Happy path 1 | `director-journey` | PASS |
| 2 | Happy path 2 (idempotence) | `director-journey` | PASS |
| 3 | Prérequis manquant | `director-operability` | PASS |
| 4 | Erreur synthétique puis reprise | `director-operability` | PASS |
| 5 | Refresh / brief conservé | `director-operability` | PASS |
| 6 | Annulation + anti double-clic | `director-operability` + `double-click-and-conflict` | PASS |
| 7 | Lipsync disabled/fake | `director-operability` | PASS |
| 8 | Merge/export disabled/fake | `director-operability` | PASS |
| 9 | `merge_ready` n’autorise pas l’export réel | journey + Delivery banner | PASS |
| 10–11 | Blocker in-flight + cleanup | `director-operability` | PASS |
| 12 | Clavier | `director-operability` | PASS |
| 13 | Mobile | `director-operability` | PASS |
| 14 | Pas de sélecteur provider | `director-operability` + journey | PASS |
| 15 | Pas de lien download/publication | journey + operability | PASS |
| + | Processing UX, director-off, barrier | specs existantes | PASS |

DIRECTOR_E2E_SCENARIOS_RUN=16  
DIRECTOR_E2E_SCENARIOS_PASSED=16  
Suite Playwright complète : **38/38**.  

DIRECTOR_HAPPY_PATH_RUNS=2  
DIRECTOR_HAPPY_PATH_PASSED=2  

Desktop : PASS (Chromium).  
Mobile viewport 390×844 : PASS (opérabilité + `mobile-keyboard`).  

---

## 6. Preuves réseau

Toute URL hors localhost / 127.0.0.1 / `data:` / `blob:` est abortée.  
`assertClean` échoue si une tentative hors allowlist apparaît.  
Aucun mock silencieux.

PROVIDER_NETWORK_ATTEMPTS=0  
PRODUCTION_SUPABASE_ATTEMPTS=0  
PRODUCTION_STORAGE_ATTEMPTS=0  

---

## 7. Idempotence

Deux happy paths indépendants (deux projets fake).  
Pas de resubmit automatique.  
Fake lipsync/merge en mémoire, non persistés comme médias.  
Clés fake stables côté adapter.  
Aucun passage fake → réel.

---

## 8. Blockers

Registre unique réutilisé.  
Blocker visible pendant execute marketing simulé ; cleanup après terminal.  
0 `SKIP_WAITING` · 0 reload · 0 apply automatique.  
AICCOS non câblé.

---

## 9. Accessibilité ciblée

Labels de progression, `aria-current`, live region blockers, focus visible sur la nav, boutons disabled non actionnables, dialogues existants (ConfirmProvider).  
Pas d’audit WCAG complet.

---

## 10. Validations

| Suite | Résultat |
|---|---|
| Unitaires ciblées Director / 11D / 11E / blockers / pipeline | PASS |
| Suite unitaire complète | **2006/2006** |
| Typecheck | PASS |
| Lint (fichiers touchés) | 0 error · warnings pre-existants set-state-in-effect |
| Build Production local | PASS |
| Playwright fake | **38/38** |
| Fraîcheur living handover | mise à jour cette porte |
| Secret scan officiel `findSecretHits` | à relancer sur ce rapport |

Tests historiques non relancés : pgTAP distant, smokes provider 10B–11C, intégration DB 33.

---

## 11. Limites

- QC Phase 9 peut rester « non prêt » sur assets metadata-only ; le succès 11E est le manifeste synthétique, pas un fichier.
- `spendSummary` local logue 42501 `vh_spend` — hors périmètre, 0 dépense.
- Production alias reste `26e9b02` (docs `181_`). Le hardening n’est **pas** déployé.
- Director Production et runtime réel restent OFF.

---

## 12. Compteurs

```text
DIRECTOR_E2E_SCENARIOS_RUN=16
DIRECTOR_E2E_SCENARIOS_PASSED=16
DIRECTOR_HAPPY_PATH_RUNS=2
DIRECTOR_HAPPY_PATH_PASSED=2
DIRECTOR_UI_DEFECTS_FOUND=11
DIRECTOR_UI_DEFECTS_FIXED=11
DIRECTOR_UI_DEFECTS_DEFERRED=4
PROVIDER_NETWORK_ATTEMPTS=0
PRODUCTION_SUPABASE_ATTEMPTS=0
PRODUCTION_STORAGE_ATTEMPTS=0
REAL_GENERATIONS=0
REAL_LIPSYNC_SUBMITS=0
REAL_MERGES=0
REAL_EXPORTS=0
FILES_CREATED_BY_MERGE_EXPORT=0
SIGNED_URLS_CREATED=0
DOWNLOADS_TRIGGERED=0
ASSETS_ACTIVATED=0
ASSETS_PUBLISHED=0
MERGE_EXPORT_AUTHORIZED=0
SKIP_WAITING_DURING_BLOCKER_TESTS=0
RELOAD_DURING_BLOCKER_TESTS=0
UPDATE_BLOCKER_REGISTRIES_CREATED=0
AICCOS_BLOCKERS_INTEGRATED=0
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
PHASE_COST=0¢
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
```

---

## 13. Prochaine porte — non exécutée

```text
AUTH_VHS_DIRECTOR_END_TO_END_FAKE_OPERABILITY_HARDENING_SYNC_AND_DEPLOY_ONCE_NO_PROVIDER_NO_FLAG_WRITE
```

Synchronisation et déploiement uniques du hardening UI/E2E. Toujours sans provider ni flag.  
L’activation Production du Director et toute exécution réelle restent des décisions humaines distinctes.
