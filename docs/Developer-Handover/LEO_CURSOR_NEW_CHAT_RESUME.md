# Reprise commune Léo + Cursor — Virtual Humans Studio

Fichier autonome pour un **nouveau chat Léo** et un **nouveau chat Cursor**, sans historique conversationnel.  
Nature : living resume. `165_` bind preflight RideCloud **consommée**. Voir living handover.

<!-- RESUME_MARKERS
verifiedAt=2026-08-27
sourceHead=0faf2d9
lastFunctionalCommit=72016ea
lastDocumentationCommit=0faf2d9
thisGateDocumentationCommit=pending
lastPhaseReport=165_PHASE_RIDECLOUD_SEPARATE_PROJECT_STORYBOARD_PACK_BIND_PREFLIGHT.md
globalStatus=RIDECLOUD_SEPARATE_PROJECT_STORYBOARD_PACK_BIND_PREFLIGHT_READY
nextAuth=AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_PREFLIGHT_NO_PROVIDER
budgetHard=437
budgetCommitted=391
budgetReserved=0
budgetAvailable=46
voiceRuntime=OFF
paidMediaRuntime=OFF
voiceOutputLifecycle=approved
voiceHumanReviewDecision=approved
voiceSecondSubmitAllowed=false
lipsyncStatus=NOT_STARTED
realMergeExportStatus=NOT_AUTHORIZED
-->

**Distinguer toujours :**

| Pointeur | Valeur | Signification |
|---|---|---|
| `sourceHead` | `0faf2d9` | HEAD Git **audité** le 2026-08-27, avant le commit `165_` |
| `lastFunctionalCommit` | `72016ea` | dernier commit applicatif Voice/TTS payant |
| `lastDocumentationCommit` | `0faf2d9` | dernier commit docs **avant** cette porte (SHA record `164_`) |
| `thisGateDocumentationCommit` | pending | premier commit docs de la porte `165_` |
| SHA déployé Vercel | **non exposé par le CLI** | corrélation temporelle seulement, pas une preuve runtime |

> **Sécurité — interdit :** clé API, voiceId brut, URL signée, contenu audio/vidéo, base64, texte Production complet, credential, secret, chemin Storage canonique sensible.

---

## 1. Mission et répartition des rôles

**Christian** est le décideur humain. Il seul autorise les dépenses, les appels provider, les lectures/écritures média, les Human Reviews, les activations, les migrations et toute action Production sensible.

**Léo** pilote l’architecture. Il lit les STOP, décide de la porte suivante et produit les prompts Cursor sous la forme d’**un seul document continu**. Il ne rejoue aucune phase terminée et **n’improvise aucune autorisation**.

**Cursor** inspecte, code, teste, documente, commit et push. Il termine chaque porte par un **STOP précis**. Il ne commence aucune porte sans Auth explicite de Léo/Christian dans le chat courant.

Une autorisation d’un chat précédent n’est **jamais** réutilisable.

---

## 2. Règles permanentes

- Fail-closed en cas de divergence Git, documentaire, Production, flag ou budget.
- Aucun provider sans Auth humaine **distincte** dans le chat courant.
- Aucun second submit sans Auth explicite. Auth `153_` **consommée** → `maySubmit=false`.
- Aucun retry ni fallback implicite.
- Aucun secret, média, base64 ou URL signée dans Git, les rapports ou les logs.
- Flags ouverts seulement dans une fenêtre bornée, **fermés dans `finally`**.
- Aucun asset activé automatiquement après Human Review.
- Human Review = porte distincte, jamais implicite.
- Ne pas confondre fake, dry-run, preflight et exécution réelle.
- `merge_ready` **ne signifie pas** `mergeExportAuthorized`.
- Résoudre les artifacts **explicitement** par projet / run / plan / output (`139_`, stratégie C).
- Motion Transfer reste isolé du pipeline média générique.
- Tous les prompts Cursor sont livrés comme **un document unique et continu**.

---

## 3. État Git audité (2026-08-26)

| Champ | Valeur |
|---|---|
| Racine | `C:\Users\JavaChrist\Desktop\virtual-humans` |
| Branche | `main` |
| `sourceHead` | `0f3a3bb2be9a41c10d89b66a82b8b98133148f03` |
| `origin/main` à l’audit | `0f3a3bb2be9a41c10d89b66a82b8b98133148f03` |
| ahead / behind à l’audit | **0 / 0** |
| Commit fonctionnel | `72016ea` — feat(studio): execute unique paid Voice/TTS and keep output pending review |
| Commit documentaire `153_` | `0f3a3bb` — docs: record Voice TTS first paid execution commit SHA |

Working tree à l’audit : **uniquement** trois fichiers tracked dirty **hors scope**. Les protéger. Ne pas les modifier, restaurer, stasher ni stager :

- `studio/src/app/api/aiccos/send/route.ts`
- `studio/src/components/send-to-aiccos.tsx`
- `studio/src/app/page.tsx`

`studio/.env.local` et `studio/.tmp` sont ignorés et hors Git. Aucun MP3 Voice dans Git. Un MP4 I2V local historique peut exister sous `.tmp` : **gitignoré**, ce n’est pas une nouvelle phase.

**Le commit de ce fichier changera HEAD.** Revérifier Git au début de chaque nouveau chat.

---

## 4. État documentaire et divergences connues

Au moment de l’audit `VHS_CHAT_RESUME_STATE_ALIGNED_READY_FOR_PRIVATE_AUDIO_PREVIEW_AUTH` :

- `CURRENT_STATE_AND_RESUME.md` avait encore `documentedHead=72016ea` et `headStatus=pending commit`.
- Le corps contenait des pointeurs de clôture historiques (`HEAD local 72016ea`, `origin/main 933d4af` « au départ », Ready documenté `lf3o07217` / `933d4af`).
- Ces marqueurs **ne signifient pas** qu’une autre phase fonctionnelle a été exécutée. Ils sont le protocole living handover + snapshots de clôture `153_`.
- Le dernier état Git audité **avant cette porte** est `0f3a3bb`.
- Cette porte corrige seulement ce qui est factuel sans fabriquer un SHA récursif.

**Autorité :**

1. Code versionné + état Production **vérifié** (faits techniques).
2. Ce fichier = **directive de reprise pratique** pour un nouveau chat.
3. `CURRENT_STATE_AND_RESUME.md` = living handover technique.
4. Rapports numérotés = snapshots immuables.

---

## 5. État des capacités

| Capacité | État |
|---|---|
| Marketing Director | PASS_REAL · runtime OFF |
| Creative Director | PASS_REAL · runtime OFF |
| Script Director | PASS_REAL · runtime OFF |
| Art Director | PASS_REAL · runtime OFF |
| Storyboard Director | PASS_REAL · runtime OFF |
| OpenAI Image 11A | CLOSED PASS_WITH_NOTES · asset approuvé privé inactif |
| I2V 11B | CLOSED PASS_WITH_NOTES · vidéo approuvée privée inactive |
| Voice/TTS 11C | première exécution réelle réussie · audio privé **APPROVE** inactif |
| Voice catalog | 4 identities · 4 consents · 1 binding |
| `narrator_female` | liée au projet I2V · execution=false |
| `narrator_male` | disponible · **non sélectionné** |
| Mei / Tom | réservés aux dialogues Character · non substitués |
| Lipsync | **NOT_STARTED** |
| Merge / export réel | **non autorisé** et non validé en Production |
| UI `/director` | parcours câblé · capacités payantes OFF |
| Motion Transfer | benchmark réel APPROVE · Registry Production **disabled** |

---

## 6. Assets canoniques (redacted)

### Image 11A

- `49284892…`
- approved · active=false · published=false
- checksum prefix `9ac484b7…`
- privée
- aucun troisième appel OpenAI sans Auth distincte

### Vidéo I2V 11B

- `9be6cb0c…`
- approved · active=false · published=false
- checksum prefix `e929f00a…`
- privée
- Human Review **APPROVE**
- aucun second submit fal

### Audio Voice 11C

- `bc36bba7…`
- `audio/mpeg` · 80710 octets
- checksum `2ca9ebbd98187dd64553dc1866cd21a3fc4b12ede97a4556a42f02258c33fdad`
- bucket privé redacted
- lifecycle=`approved` · active=false · published=false
- Human Review decision=`approved` · `068a2b25…`
- copie privée locale `studio/.tmp/voice-tts-private-preview.mp3` (gitignorée, intégrité vérifiée)
- aucun second submit ElevenLabs

---

## 7. Voice catalog et binding

| Champ | Valeur redacted |
|---|---|
| Compteurs | identities / consents / bindings = **4 / 4 / 1** |
| Provider-active identities | **0** |
| Identity `narrator_female` | `bc1c8046…` |
| Consent female | `6fd84baf…` · authorized · `workspace_voice_over` · voice_over · non révoqué |
| Binding | `e3a1cc87…` → projet I2V · narrator · voice_over · fr · prepared · `selected_by=christian` |
| Locator | `env:ELEVENLABS_NARRATOR_FEMALE_VOICE_ID` |
| Fingerprint prefix | `99db51be34bc…` |
| `active_for_provider_execution` | **false** |
| `narrator_male` | non sélectionné |
| Mei / Tom | non substitués |

Aucune valeur voiceId brute.

---

## 8. Dernière exécution Voice réelle (`153_`)

- Auth `AUTH_11C_VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION` **consommée**
- Modèle `eleven_multilingual_v2`
- Exactement **1** submit ElevenLabs · `submitCount=1`
- Run `2eaffebf…` completed
- Job `428c7f48…` completed
- Attempt `ea07475f…` completed · retryable=false
- Output `bc36bba7…` `pending_review`
- 0 retry · 0 fallback · 0 second submit
- Replay planner : **`maySubmit=false`**
- Flags ouverts temporairement (fenêtre C) puis refermés dans `finally`
- Voice runtime **OFF**
- Aucune décision Human Review
- Aucun lipsync / downstream

---

## 9. Budget

Montants en **centimes USD**.

| | ¢ |
|---|---|
| Hard | **437** |
| Committed | **391** |
| Reserved actif | **0** |
| Available | **46** |

- Settlement TTS : **provisional 2¢** (pas une facture ferme)
- Settlement I2V : **provisional 140¢**
- Aucune réservation active
- Aucune reconciliation ouverte
- Toute future dépense exige une **nouvelle Auth humaine** dans le nouveau chat

---

## 10. Production et déploiement

- Supabase redacted `ejdb…nmvi` · Virtual Humans Studio · `eu-west-3` · **ACTIVE_HEALTHY** à l’audit
- Migrations **32 / 32**
- RLS Voice on · ACL Voice durcies (`147_`)
- Dernier Ready **observé** le 2026-08-26 : host `3waniv5tf-…` · id `dpl_x87m…` · créé le 2026-08-16 à 02:34:52 Europe/Paris
- Le CLI **n’a pas exposé** le SHA exact du commit déployé
- Corrélation temporelle : auto-deploy ~9 min après `0f3a3bb` (02:25:19). **Cette corrélation n’est pas une preuve runtime certaine.**
- Ne pas présenter `0f3a3bb` (commit docs) comme SHA runtime
- Ready documenté dans `153_` (`lf3o07217` / `933d4af`) = snapshot historique, plus ancien que le Ready observé
- Aucun déploiement manuel durant l’audit

---

## 11. Flags — niveau de preuve exact

- Dernière **preuve applicative forte** : fermeture dans le `finally` de `153_`
- Aucune activité payante ultérieure : 1 job ElevenLabs seulement, 0 réserve active, 0 audio supplémentaire
- Audit 2026-08-26 : **aucune preuve** qu’un flag soit resté à `1`
- Voice runtime **considéré OFF**
- Les noms de flags VHS11C existent côté Vercel (créés pendant la fenêtre C). **L’audit n’a pas obtenu une lecture directe suffisamment forte de chaque valeur chiffrée.**
- Ne pas prétendre que chaque valeur Vercel a été relue
- La prochaine porte doit **revalider fail-closed** les flags avant toute opération sensible

Attendus (non relus un par un le 26 août) : Voice / Paid Media / Worker payant / VHS11B / VHS11C / Motion / lipsync / downstream = OFF.

---

## 12. État RideCloud

**Objectif utilisateur :** produire des vidéos promotionnelles pour RideCloud, actuellement en phase de test Google Play, avec le JavaChrist Beta Club sur Discord.

**Déjà disponible (capacités techniques, pas les livrables RideCloud) :**

- brief marketing
- concept créatif
- script
- storyboard
- image réelle
- I2V réel
- narratrice et narrateur distincts
- TTS réel avec `narrator_female`
- stockage privé
- budget et idempotence

**Pack RideCloud (`158_` + `159_`) = READY.** Storyboard (`160_` + `161_` + `162_`) = **26 s / VO polie**. Create (`164_`) = **CREATED**. Bind preflight (`165_`) = **READY**. Encore manquant ensuite :

- étendre le **schéma kinds** (`storyboard_contract` + `media_input_manifest`) puis persister le bind
- merge / export réel
- QC et Human Review finale
- lipsync seulement si un personnage doit parler face caméra
- parcours autonome complet `/director`

**Recommandation — première publicité RideCloud sans lipsync :**

captures RideCloud → montage animé → `narrator_female` → textes / CTA → pas de musique tant que licence absente → export privé → Human Review.

Les assets actuels 11A / 11B / 11C **valident les capacités techniques**. Ils **ne sont pas** les livrables promotionnels RideCloud.

---

## 13. Prochaine porte canonique — non exécutée

```text
AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_PREFLIGHT_NO_PROVIDER
```

Périmètre futur uniquement :

- preflight local de l’extension de schéma pour les kinds bind
- aucun apply distant
- aucun provider, lecture média, upload ou dépense

Interdit : provider · dépense · média Git · lecture/upload pack · apply schéma · persist bind · run/job/attempt/output · activation · lipsync · merge/export · publication · TTS.

**Ne pas exécuter cette porte pendant la lecture de ce fichier.**

`AUTH_RIDECLOUD_SEPARATE_PROJECT_STORYBOARD_PACK_BIND_PREFLIGHT_NO_PROVIDER` est **consommée** (`165_`).
`AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_IDEMPOTENT_NO_PROVIDER` est **consommée** (`164_`).
`AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT_NO_PROVIDER` est **consommée** (`163_`).
`AUTH_RIDECLOUD_STORYBOARD_VO_COPY_POLISH_AND_SYNC_NO_PROVIDER` est **consommée** (`162_`).
`AUTH_RIDECLOUD_FIRST_AD_STORYBOARD_AUDIO_CONTINUITY_HARDENING_NO_PROVIDER` est **consommée** (`161_`).
`AUTH_RIDECLOUD_FIRST_AD_STORYBOARD_PREFLIGHT_NO_PROVIDER` est **consommée** (`160_`).
`AUTH_RIDECLOUD_PACK_HIGH_RES_VARIANTS_ADDENDUM_NO_PROVIDER` est **consommée** (`159_`).  
`AUTH_RIDECLOUD_SUPPLY_MISSING_REQUIRED_INPUTS_NO_PROVIDER` est **consommée** (`158_`).

---

## 14. Procédure de reprise pour Léo

Copier le bloc suivant dans un nouveau chat Léo :

```text
Tu es Léo, CTO et chef d’orchestre de Virtual Humans Studio. Cursor code, teste, documente, commit et push ; tu ne codes pas directement.

Lis entièrement docs/Developer-Handover/LEO_CURSOR_NEW_CHAT_RESUME.md, puis CURRENT_STATE_AND_RESUME.md et le rapport 165_PHASE_RIDECLOUD_SEPARATE_PROJECT_STORYBOARD_PACK_BIND_PREFLIGHT.md.

Ne rejoue aucune phase terminée. Vérifie d’abord Git et les éventuels nouveaux STOP Cursor. Une autorisation d’un chat précédent n’est jamais réutilisable.

La porte active est AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_PREFLIGHT_NO_PROVIDER. Elle n’est pas encore exécutée.

RideCloud bind preflight READY (165_). Projet CREATED (164_). Pack 158_ + 5 variantes HD 159_. Storyboard 26 s. Auth 165_ / 164_ / 163_ / 162_ / 161_ / 160_ / 159_ / 158_ / 157_ / 156_ / 155_ / 153_ consommées. Aucun provider. 0¢. N’invente aucun claim. Aucun média Git.

Budget 437/391/0/46. Voice runtime OFF. Flags considérés OFF avec preuve finally + absence d’activité, sans lecture directe de chaque valeur Vercel. Le SHA Vercel Ready n’est pas prouvé.

Fournis les prompts Cursor comme un seul document continu. N’improvise aucune autorisation.
```

---

## 15. Procédure de reprise pour Cursor

Copier le bloc suivant dans un nouveau chat Cursor :

```text
Tu es Cursor, exécutant code/test/doc de Virtual Humans Studio.

Lis entièrement docs/Developer-Handover/LEO_CURSOR_NEW_CHAT_RESUME.md, puis CURRENT_STATE_AND_RESUME.md, .cursor/rules/living-handover.mdc et 165_PHASE_RIDECLOUD_SEPARATE_PROJECT_STORYBOARD_PACK_BIND_PREFLIGHT.md.

Vérifie Git avant toute action. Racine attendue : C:\Users\JavaChrist\Desktop\virtual-humans. Branche main.

Protège les fichiers hors scope déjà dirty : studio/src/app/api/aiccos/send/route.ts, studio/src/components/send-to-aiccos.tsx, studio/src/app/page.tsx. Ne les modifie pas, ne les restaure pas, ne les stash pas, ne les stage pas.

Ne commence aucune porte sans prompt Auth explicite de Léo/Christian dans CE chat. Ne rejoue pas 153_, 155_, 156_, 157_, 158_, 159_, 160_, 161_, 162_, 163_, 164_ ni 165_. Aucun provider. 0¢. Aucun persist bind. Aucun média Git. N’invente aucun claim.

La prochaine porte est AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_PREFLIGHT_NO_PROVIDER. Elle n’est pas autorisée par ce fichier de reprise. 0 provider. 0¢.
```

---

## 16. Checklist de première minute

- [ ] Confirmer la racine Git `C:\Users\JavaChrist\Desktop\virtual-humans`
- [ ] Confirmer branche `main` et relever HEAD / origin/main / ahead-behind
- [ ] Lire le dernier STOP (ce fichier + living handover + `165_`)
- [ ] Vérifier le working tree sans le modifier
- [ ] Protéger les trois fichiers hors scope
- [ ] Confirmer budget 437 / 391 / 0 / 46
- [ ] Confirmer flags / runtime considérés OFF ; revalider avant toute opération sensible
- [ ] Confirmer output audio `bc36bba7…` `approved` · active=false · HR `068a2b25…`
- [ ] Confirmer aucune nouvelle Human Review
- [ ] Confirmer prochaine Auth = `AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_PREFLIGHT_NO_PROVIDER`
- [ ] Ne lancer aucune action sensible avant autorisation

---

## 17. Sources

| Document | Rôle |
|---|---|
| [`CURRENT_STATE_AND_RESUME.md`](./CURRENT_STATE_AND_RESUME.md) | Living handover technique |
| [`LEO_NEW_CHAT_HANDOVER.md`](./LEO_NEW_CHAT_HANDOVER.md) | Rôle Léo (complémentaire) |
| [`139_PHASE_11B_ARTIFACT_POINTER_COHERENCE_HARDENING.md`](./139_PHASE_11B_ARTIFACT_POINTER_COHERENCE_HARDENING.md) | Pointeurs explicites · merge fail-closed |
| [`147_PHASE_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY.md`](./147_PHASE_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY.md) | ACL Voice 32/32 |
| [`149_PHASE_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_SINGLE_TRANSACTION.md`](./149_PHASE_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_SINGLE_TRANSACTION.md) | Seed 4/4/0 |
| [`151_PHASE_11C_I2V_NARRATOR_BINDING_SINGLE_WRITE.md`](./151_PHASE_11C_I2V_NARRATOR_BINDING_SINGLE_WRITE.md) | Binding `e3a1cc87…` |
| [`152_PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_NO_PROVIDER.md`](./152_PHASE_11C_VOICE_TTS_LIVE_PREFLIGHT_NO_PROVIDER.md) | Preflight TTS · cap 2¢ |
| [`153_PHASE_11C_VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION.md`](./153_PHASE_11C_VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION.md) | Unique exécution payante |
| [`155_PHASE_11C_VOICE_TTS_HUMAN_REVIEW_APPROVE.md`](./155_PHASE_11C_VOICE_TTS_HUMAN_REVIEW_APPROVE.md) | Human Review APPROVE inactif |
| [`156_PHASE_11C_CLOSE_AND_NEXT_MEDIA_GATE_AUDIT.md`](./156_PHASE_11C_CLOSE_AND_NEXT_MEDIA_GATE_AUDIT.md) | Clôture 11C PASS_WITH_NOTES |
| [`157_PHASE_RIDECLOUD_SEPARATE_PROJECT_INPUT_COLLECTION_PREFLIGHT.md`](./157_PHASE_RIDECLOUD_SEPARATE_PROJECT_INPUT_COLLECTION_PREFLIGHT.md) | RideCloud inputs BLOCKED |
| [`158_PHASE_RIDECLOUD_SUPPLY_MISSING_REQUIRED_INPUTS.md`](./158_PHASE_RIDECLOUD_SUPPLY_MISSING_REQUIRED_INPUTS.md) | RideCloud pack READY |
| [`159_PHASE_RIDECLOUD_PACK_HIGH_RES_VARIANTS_ADDENDUM.md`](./159_PHASE_RIDECLOUD_PACK_HIGH_RES_VARIANTS_ADDENDUM.md) | RideCloud 5 variantes HD |
| [`160_PHASE_RIDECLOUD_FIRST_AD_STORYBOARD_PREFLIGHT.md`](./160_PHASE_RIDECLOUD_FIRST_AD_STORYBOARD_PREFLIGHT.md) | RideCloud storyboard 26 s |
| [`161_PHASE_RIDECLOUD_FIRST_AD_STORYBOARD_AUDIO_CONTINUITY_HARDENING.md`](./161_PHASE_RIDECLOUD_FIRST_AD_STORYBOARD_AUDIO_CONTINUITY_HARDENING.md) | RideCloud VO continue |
| [`162_PHASE_RIDECLOUD_STORYBOARD_VO_COPY_POLISH_AND_SYNC.md`](./162_PHASE_RIDECLOUD_STORYBOARD_VO_COPY_POLISH_AND_SYNC.md) | RideCloud VO polish s03/s04 |
| [`163_PHASE_RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT.md`](./163_PHASE_RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT.md) | RideCloud create preflight READY |
| [`164_PHASE_RIDECLOUD_SEPARATE_PROJECT_CREATE_IDEMPOTENT.md`](./164_PHASE_RIDECLOUD_SEPARATE_PROJECT_CREATE_IDEMPOTENT.md) | RideCloud create idempotent CREATED |
| [`165_PHASE_RIDECLOUD_SEPARATE_PROJECT_STORYBOARD_PACK_BIND_PREFLIGHT.md`](./165_PHASE_RIDECLOUD_SEPARATE_PROJECT_STORYBOARD_PACK_BIND_PREFLIGHT.md) | RideCloud bind preflight READY |
| [`00_README.md`](./00_README.md) | Index |
| [`.cursor/rules/living-handover.mdc`](../../.cursor/rules/living-handover.mdc) | Règle de clôture |

Rapport docs-only de cette sync : [`154_VHS_LEO_CURSOR_NEW_CHAT_HANDOVER_SYNC.md`](./154_VHS_LEO_CURSOR_NEW_CHAT_HANDOVER_SYNC.md).  
**Ce n’est pas une phase fonctionnelle.**
