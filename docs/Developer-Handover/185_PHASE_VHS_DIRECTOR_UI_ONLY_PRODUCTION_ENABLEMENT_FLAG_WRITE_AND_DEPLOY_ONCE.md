# 185 — VHS Director UI-only Production enablement flag write and deploy once

**Date :** 2026-08-28  
**Auth :** `AUTH_VHS_DIRECTOR_UI_ONLY_PRODUCTION_ENABLEMENT_FLAG_WRITE_AND_DEPLOY_ONCE_NO_PROVIDER_NO_PERSISTENCE_NO_RUNTIME`  
**Nature :** écriture unique `DIRECTOR_V2_ENABLED=1` · Production Vercel `virtual-humans` · redéploiement unique du source déjà publié `8081744` · **0** push · **0** persistence · **0** provider  
**HEAD local au départ :** `e2ce07b` (`184_` non poussé)  
**origin/main :** `8081744`  
**SHA fonctionnel hardening :** `d376a7c`  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_DIRECTOR_UI_ONLY_PRODUCTION_ENABLED_RUNTIME_OFF
SOURCE_HEAD=8081744
ORIGIN_MAIN=8081744
AHEAD_BEHIND_AT_START=1/0
FUNCTIONAL_COMMIT=d376a7c
LOCAL_PREFLIGHT_COMMIT=e2ce07b
PRODUCTION_DEPLOY=dpl_Fno67njpypVzs3Lxa96P66y9PF9J
PRODUCTION_ALIAS=virtual-humans.vercel.app
DIRECTOR_FLAG_WRITES=1
DIRECTOR_FLAG_VALUE_FINAL=ON
DIRECTOR_PERSISTENCE_FLAG_WRITES=0
DIRECTOR_PERSISTENCE_ENABLED=0
OTHER_FLAG_WRITES=0
NOMINAL_PRODUCTION_DEPLOYS=1
ROLLBACK_TRIGGERED=0
ROLLBACK_FLAG_WRITES=0
ROLLBACK_DEPLOYS=0
GIT_PUSHES=0
PRODUCTION_ALIAS_VERIFIED=1
PRODUCTION_DIRECTOR_UI_VISIBLE_AUTHENTICATED=1
PRODUCTION_DIRECTOR_PUBLIC_UNAUTHENTICATED=0
PRODUCTION_DIRECTOR_PERSISTENCE_AVAILABLE=0
PRODUCTION_DIRECTOR_PROJECT_WRITES=0
PRODUCTION_SUPABASE_MUTATIONS=0
PRODUCTION_STORAGE_READS=0
PRODUCTION_STORAGE_WRITES=0
PROVIDER_CALLS=0
REAL_GENERATIONS=0
REAL_LIPSYNC_SUBMITS=0
REAL_MERGES=0
REAL_EXPORTS=0
DOWNLOADS_TRIGGERED=0
ASSETS_ACTIVATED=0
ASSETS_PUBLISHED=0
MERGE_EXPORT_AUTHORIZED=0
BUDGET_WRITES=0
PHASE_COST=0¢
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
```

---

## 1. Autorisation humaine consommée

`AUTH_VHS_DIRECTOR_UI_ONLY_PRODUCTION_ENABLEMENT_FLAG_WRITE_AND_DEPLOY_ONCE_NO_PROVIDER_NO_PERSISTENCE_NO_RUNTIME` — Christian, chat courant.

Autorisé explicitement :

- ouverture UI-only du Réalisateur IA en Production ;
- audience = toute personne disposant de la session studio (mot de passe partagé) ;
- écriture unique `DIRECTOR_V2_ENABLED=1` dans l’environnement Vercel Production du projet `virtual-humans` ;
- redéploiement Production unique du source déjà publié `8081744` ;
- rollback fail-closed si les vérifications échouent.

Non couvert : tout autre flag · persistence Director · provider · génération réelle · dépense · Preview · Development · push de `e2ce07b`.

`184_` reste le snapshot de preflight. `157_`–`183_` restent immuables.

### Distinguer les SHA

| Pointeur | SHA | Rôle |
|---|---|---|
| origin/main | `8081744de29ab34e5efa8aa48d5cd8c363cf8e34` | SHA Git servi / documentaire Production |
| Commit fonctionnel hardening | `d376a7c4fa273641336b939e73f03a8207428e68` | UX fake · **dans le tree servi** |
| Preflight local `184_` | `e2ce07be3f8c463748f9a674101d22bcfdb79e1f` | **non poussé** · **non déployé** |
| Déploiement précédent | `dpl_CTA5DF8JWDwqoyEF3QLvy8ooCxbc` | source `8081744` avant le flag |
| Déploiement actuel | `dpl_Fno67njpypVzs3Lxa96P66y9PF9J` | redeploy du même source + env Production |

---

## 2. Audience

Aucun rôle admin/opérateur n’existe. Le proxy est le mot de passe partagé (VHS-002).

| Audience | Comportement constaté |
|---|---|
| Non authentifié | `/director` → 307 `/login?next=%2Fdirector` · `x-matched-path: /login` |
| Session studio | nav « Réalisateur IA » · `/director` 200 · wizard localStorage |
| Admin / opérateur | **n’existe pas** — non inventé |

---

## 3. Préconditions avant écriture

| # | Contrôle | Résultat |
|---|---|---|
| 1 | Fetch lecture seule | PASS |
| 2 | Branche `main` | PASS |
| 3 | HEAD local = `e2ce07b` | PASS |
| 4 | origin/main = `8081744` | PASS |
| 5 | ahead/behind `1/0` | PASS |
| 6 | Dirty = 2 AICCOS seulement | PASS |
| 7 | Index vide | PASS |
| 8 | `e2ce07b` non poussé | PASS |
| 9–10 | Alias sert `dpl_CTA5DF8JW…` · SHA `8081744` | PASS |
| 11 | GET `/api/version` avant écriture | PASS · `gitShaShort=8081744` · `buildId=dpl_CTA5DF8JW…` · `environment=production` · `deployedAt=null` · `no-store` |
| 12–14 | Projet `virtual-humans` · Production uniquement · 0 Preview/Development | PASS |
| 15–19 | Flags interdits EMPTY/ABSENT · `FORBIDDEN_ON=none` | PASS |
| 20–23 | Lipsync unavailable · 0 moteur merge/export · `mergeExportAuthorized=false` · RideCloud suspendu | PASS (flags + contrats `178_`–`181_`) |
| 24 | Ledger 437 / 391 / 0 / 46 | PASS (documentaire, 0 mutation) |
| 25 | Audience session partagée | PASS |
| 26 | Redeploy du source `8081744` reprendra les variables Production | PASS |

STOP avant écriture : **non déclenché**.

---

## 4. Flags redacted-safe

Parseur : `parseStrictEnabledFlag` — ON seulement `"1"` / `"true"`. Pull Vercel Production : valeurs Encrypted apparaissent **EMPTY** (redaction). Preuve runtime = `GET /api/settings` après Ready.

| Flag | Pull avant write | Pull après write | Live après Ready |
|---|---|---|---|
| `DIRECTOR_V2_ENABLED` | EMPTY | EMPTY (Encrypted) | **ON** (`features.directorV2=true`) |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | EMPTY | EMPTY | **OFF** |
| Worker / paid / AI Director (8) | EMPTY | EMPTY | **OFF** |
| Harness E2E (3) | ABSENT | ABSENT | non actifs |
| 11A exception | EMPTY | EMPTY | **OFF** |
| 11B (6) | EMPTY | EMPTY | **OFF** |
| 11C (6) | EMPTY | EMPTY | **OFF** |
| 11D (6) | ABSENT | ABSENT | **OFF** |
| 11E (7) | ABSENT | ABSENT | **OFF** |
| Motion (5) | EMPTY/ABSENT | EMPTY/ABSENT | **OFF** |

`FORBIDDEN_ON=none` avant et après. Aucun flag interdit n’était ON. Aucun autre flag n’a été écrit.

---

## 5. Écriture nominale

Exactement une écriture :

```text
npx vercel env update DIRECTOR_V2_ENABLED production --value 1 --yes
```

Résultat CLI : `Updated Environment Variable DIRECTOR_V2_ENABLED in Project virtual-humans`.

- Plateforme : Vercel  
- Projet : `virtual-humans` (`prj_NTK8yqoLHiXvBmqMLl98plAxGKdP`)  
- Environnement : **Production uniquement**  
- `DIRECTOR_FLAG_WRITES=1`  
- `OTHER_FLAG_WRITES=0`  
- `DIRECTOR_PERSISTENCE_FLAG_WRITES=0`

La variable existait déjà (créée antérieurement, valeur vide = fail-closed OFF). Update, pas add. Valeur jamais imprimée.

---

## 6. Déploiement nominal

Exactement un redéploiement du déploiement déjà publié :

```text
npx vercel redeploy dpl_CTA5DF8JWDwqoyEF3QLvy8ooCxbc --target production
```

| Champ | Valeur |
|---|---|
| Nouveau id | `dpl_Fno67njpypVzs3Lxa96P66y9PF9J` |
| `githubCommitSha` | `8081744de29ab34e5efa8aa48d5cd8c363cf8e34` |
| `originalDeploymentId` | `dpl_CTA5DF8JWDwqoyEF3QLvy8ooCxbc` |
| `action` | `redeploy` |
| `target` | `production` |
| `readyState` | READY |
| Alias | `virtual-humans.vercel.app` assigné par le mécanisme normal |
| Tree fonctionnel | `d376a7c` (ancêtre de `8081744`) |
| Push Git | **0** |
| Source locale / `e2ce07b` | **non déployé** |

`NOMINAL_PRODUCTION_DEPLOYS=1`.

---

## 7. Vérifications non-auth

| # | Contrôle | Résultat |
|---|---|---|
| 1 | GET `/api/version` | 200 |
| 2 | `gitShaShort` | `8081744` |
| 3 | `buildId` | `dpl_Fno67njpypVzs3Lxa96P66y9PF9J` |
| 4 | `environment` | `production` |
| 5 | `deployedAt` | `null` |
| 6 | Cookie créé par `/api/version` | aucun `set-cookie` |
| 7 | Headers | `cache-control: no-store, max-age=0` · `cdn-cache-control: no-store` |
| 8 | POST `/api/version` | 403 |
| 9 | GET `/api/budget` sans session | 401 |
| 10 | GET `/director` sans session | 307 → `/login?next=%2Fdirector` · `x-matched-path: /login` |
| 11–12 | Provider / média | aucune requête observée |

`PRODUCTION_DIRECTOR_PUBLIC_UNAUTHENTICATED=0`.

---

## 8. Vérifications session studio

Mécanisme : login canonique `/api/login` + Chromium headless contre l’alias. Mot de passe et cookie **non** journalisés. Brief de test nettoyé ensuite.

Live `/api/settings` : `directorV2=true` · persistence et 8 runtimes Director **false**.

| # | Contrôle | Résultat |
|---|---|---|
| 1 | Nav « Réalisateur IA » | PASS |
| 2 | `/director` interface, pas 404 | PASS · 200 · `x-matched-path: /director` |
| 3 | Wizard brief | PASS · `/director/new` · « sauvegarde locale uniquement » |
| 4 | Brouillon `localStorage` seulement | PASS · 1 clé après autosave · 0 POST projet |
| 5 | « Créer le projet » | ABSENT |
| 6 | POST projet | 404 |
| 7 | `/director/:id` | 404 |
| 8 | `/api/director/projects` GET/POST | 404 |
| 9 | Marketing réel | bouton « Analyse marketing — prochainement » **disabled** |
| 10 | Nom de provider | aucun (`openai` / `elevenlabs` / `fal.ai` / …) |
| 11 | Fake harness Production | OFF (ABSENT) |
| 12 | Lipsync réel | section absente |
| 13 | Merge/Export réel | section absente |
| 14–15 | Télécharger / Publier | absents |
| 16 | `mergeExportAuthorized` | false (contrat + flags 11E ABSENT) |
| 17 | Worker / cron | 0 |
| 18 | OpenAI / fal / ElevenLabs | 0 host provider |
| 19 | Storage média | 0 |
| 20 | Budget | GET inchangé · 0 write |
| 21 | Logout puis `/director` | redirige `/login` |
| 22 | Desktop + mobile 390×844 | PASS |

Écriture produit : brouillon localStorage de test uniquement, **nettoyé** après vérif.

47/47 checks session PASS. `PRODUCTION_DIRECTOR_UI_VISIBLE_AUTHENTICATED=1`.

---

## 9. Observabilité

Fenêtre après Ready : comptes runtime Production sur `dpl_Fno67njpypVzs3Lxa96P66y9PF9J` — 200 / 401 / 307 / 304 / 404 / 403. **Aucun 5xx.** 404 = APIs Director + `/director/:id`. 401 = routes protégées sans session. 403 = POST `/api/version`. Aucune télémétrie nouvelle.

---

## 10. Rollback

Aucun critère de rollback rencontré.

Rollback prêt, non exécuté :

1. `DIRECTOR_V2_ENABLED=0` (ou suppression Production) ;
2. redéploiement Production correctif du même source ;
3. non-auth `/director` → login ;
4. session : nav absente · `/director` 404 ;
5. `/api/version` + routes protégées ;
6. runtimes OFF.

`ROLLBACK_TRIGGERED=0`.

---

## 11. État Git

| Champ | Valeur |
|---|---|
| origin/main | `8081744` (inchangé) |
| HEAD au départ de la porte | `e2ce07b` |
| ahead/behind au départ | `1/0` |
| Dirty | 2 AICCOS non stagés |
| Push | **0** |
| Commit documentaire `185_` | ce commit, local, au-dessus de `e2ce07b` |

État nominal après ce commit : origin/main `8081744` · HEAD docs `185_` · ahead **2/0** · AICCOS dirty.

---

## 12. Compteurs

Voir le bandeau. Voie nominale respectée. `PHASE_COST=0¢`.

---

## 13. STOP

```text
VHS_DIRECTOR_UI_ONLY_PRODUCTION_ENABLED_RUNTIME_OFF
```

Prochaine porte **non exécutée** — décision séparée entre :

- synchronisation documentaire `184_` + `185_` ;
- persistance Director ;
- preflight d’une première capacité réelle ;
- autre chantier fonctionnel.

Aucun runtime réel, provider, persistence, média ou dépense n’est autorisé implicitement par cette ouverture UI-only.
