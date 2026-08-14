# 115 — Phase 11A — Text-Free Image Paid Generation

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_TEXT_FREE_IMAGE_RETRY_PAID_AUTH`  
**Nature :** exactement 1 submit OpenAI Image no-text · composition locale · **aucune** décision Human Review  
**Source runtime :** `e4c3de3279aaaefc4db46cbfac00ac9e79d298f8` (`e4c3de3`)  
**HEAD documentaire au départ :** `b58cc7e` — **non** utilisé comme preuve applicative.

```text
VERDICT = COMPOSITOR_FAILED_NO_RETRY
PROVIDER_AUTH_CONSUMED = YES
PROVIDER_SUBMIT_COUNT = 1
NETWORK_ATTEMPTS = 1
WORKER_REPLAY_PROVIDER_CALLS = 0
COMPOSED_ASSET = NONE
HUMAN_REVIEW_DECISION = NONE
RUNTIME_PAID_MEDIA = OFF
OPENAI_IMAGE_REAL_EXECUTION = UNAVAILABLE
DETERMINISTIC_OVERLAY_EXECUTION = UNAVAILABLE
MOTION_RUNTIME = UNAVAILABLE
```

---

## 1. Verdict

**`COMPOSITOR_FAILED_NO_RETRY`**

L’autorisation provider est **consommée**.  
Le chemin Production a produit **exactement une** image provider privée `1024×1024` (`7832765d…`, `pending_review`, `active=false`).  
Le composeur déterministe `phase-11a-bitmap-compositor-1.0.0` a **échoué** : le PNG OpenAI est RGB 8-bit valide, mais `decodeRgbPng` n’accepte que le filtre PNG `0` (`png: unsupported filter`).  
**Aucun** asset composé. **Aucune** seconde génération. **Aucune** décision Human Review.

## 2. Autorisation consommée

| Champ | Valeur |
|---|---|
| Auth | `AUTH_11A_TEXT_FREE_IMAGE_RETRY_PAID_AUTH` |
| Consumed | **YES** au premier submit |
| Worker `providerCalls` | **1** |
| Replay | claimed **0** · providerCalls **0** |
| Retry / fallback / downstream | **0 / 0 / 0** |

## 3. Source / déploiements

| Étape | Host (redacted) | Commit |
|---|---|---|
| Alias avant | `virtual-humans-29wo5l3rt-…` | `b58cc7e` (docs) — **non utilisé** |
| Ready source | `virtual-humans-901mq9vj8-…` | **e4c3de3** |
| Redeploy ON | `virtual-humans-ghu3xq8ul-…` | **e4c3de3** |
| Redeploy OFF (finally) | `virtual-humans-oekc522ox-…` | **e4c3de3** |

Aucun commit documentaire promu. Probe post-fermeture `/prompts` : **404**.

## 4. Dry-run final (avant réserve / provider)

HTTP `/prompts` : executable=true · providerCalled=false.  
HTTP `/routing` : executable=true · providerCalled=false · composition `c532c400334f5b22` · plan live `ccd1160bd5fbee39…` · estimate **1¢** · réserve prévue **2¢** · openai / `gpt-image-1` / low / 1024×1024.  
Rebuild mémoire : prompt hash `d4f69858358805b0…` · overlay FP exact · copy absente · contraste **15.01**.

## 5. Nouvelle idempotency fingerprint

Salt d’exécution **distinct** du preflight (`9a34bc7f01351937`) et du smoke `108_`.  
Empreinte salt : `abdc8b6ef43ab093`.  
Fingerprint formule Auth : `9878d2265952ae43…` (le `8ea99553…` du preflight était lié à **son** salt — divergence **expliquée**).

## 6. Ancien asset rejeté

`5d68ef64…` · checksum `c508e3e54f2ccac7…` · `rejected` · `active=false` · HR REJECT ×1 · **inchangé**.

## 7. ScenePackage / Plan

Package historique `bcec6c03` **leaky** (titre + CTA dans `variant.positive`).  
Nouveau set no-text persisté : `2e8e9e6f…` rev.**2** (Auth §9).  
Plan actif : `a55bd426…` rev.**2** · fingerprint routing `ccd1160bd5fbee39…`.  
Artifacts brief→Storyboard rev.1 **inchangés**.

## 8–9. Prompt policy / preuve copy absente

| Champ | Valeur |
|---|---|
| version | `phase-11a-image-prompt-v2` |
| policy | `no_text` / `no-text-v1` |
| live prompt hash | `d4f69858358805b0…` |
| overlayCopyInVisualVariant | **false** (set `2e8e9e6f`) |
| overlayCopyInProviderPrompt | **false** |
| providerPromptNoText | **true** |
| prompt complet persisté | **non** |

## 10–11. Budget avant / estimate

Avant : hard **274** / committed **248** / reserved **0** / available **26**.  
Estimate **1¢** · réserve worker réelle **1¢** (plafond Auth 2¢). Hard limit **inchangé**.

## 12–16. Run / job / OpenAI / ledger

| | |
|---|---|
| Nouveau run | `39329a01…` · `waitingReason=needs_review` · colonne status encore `running` (P1) |
| Nouveau job | `edc6e84a…` · **completed** · openai / `gpt-image-1` |
| Attempts table | toujours **0** (tentative dans l’état du run, comme `108_`) |
| Submit / network | **1 / 1** |
| OpenAI | **completed** · `needs_review` |
| Coût | **1¢ provisional** · ledger +2 rows (reserve+commit) |
| Après | hard **274** / committed **249** / reserved **0** / available **25** |

## 17–19. Provider output / OCR

| Champ | Valeur |
|---|---|
| asset | `7832765d…` |
| status | `pending_review` |
| active | **false** |
| checksum | `1ac51f484420ef88…` |
| size | 1 131 237 octets |
| path | `{ws}/{project}/media/image/{assetId}.png` (5 segments — runtime e4c3de3) |
| OCR | `unavailable_humanOnly` · 0 OCR payant · pas de faux PASS |

## 20–22. Composition / overlay / composed

Copy exacte inchangée : `fr` · `De l’idée à la structure` (U+2019) · CTA `Découvrir Virtual Humans Studio` · FP `fdfae63fe1c7d003…`.  
Composeur : **échec** `png: unsupported filter`.  
Asset composé : **aucun**. Storage composed : **0**.

## 23–25. QC / Human Review

QC provider technique : PNG · 1024×1024 · checksum · provenance OpenAI. Visuel : `humanOnly`.  
QC typographique : **non produit** (pas d’asset composé).  
Human Review : contexte provider `pending_review` seulement · **décision = none** · comparatif provider/composé **impossible**.

## 26–31. Idempotence / flags / écritures

Replay worker : 0 second submit.  
1 objet Storage provider · 1 insert asset provider · 0 composed.  
Ledger settlement worker : 1¢.  
Flags finaux OFF. Runtime e4c3de3 OFF. Probe **404**.

Écritures : +1 run · +1 job · +1 asset · +1 ScenePackageSet rev.2 · +1 GenerationPlan rev.2 · +2 ledger rows · 0 HR decision · 0 URL/base64 persisté.

## 32–34. Documentation / tests / git

Rapport : ce fichier. Living handover mis à jour **avant** le commit docs.  
Tests unitaires : non relancés (phase ops). Secret scan du diff docs obligatoire.  
Commit documentaire : **ne pas** redéployer.

## 35. P0 / P1

**P0 :** pas de 3ᵉ submit OpenAI ; ne pas réactiver `5d68ef64…` ni `7832765d…` ; ne pas décider HR ici.

**P1 :** décoder les filtres PNG standard dans `decodeRgbPng` puis composer **l’asset existant** (Auth dédiée, 0 OpenAI) ; refermer le run `39329a01` `running`→terminal `needs_review` ; chemin Storage 6-seg `provider/` encore non câblé dans le worker e4c3de3.

## 37. Suivi `116_` (ne réécrit pas ce snapshot)

Le décodeur PNG filtres **0–4** est livré dans [`116_PHASE_11A_PNG_FILTER_DECODER_HARDENING.md`](./116_PHASE_11A_PNG_FILTER_DECODER_HARDENING.md).  
Ce rapport `115_` reste le snapshot **COMPOSITOR_FAILED_NO_RETRY**.  
L’asset `7832765d…` n’a **pas** été relu ni composé. Prochaine Auth : `AUTH_11A_COMPOSE_EXISTING_PROVIDER_PNG_FILTERS`.

## 36. Prochaine décision humaine

1. Examiner l’image provider `7832765d…` (privée, inactive) — **sans** overlay déterministe.  
2. Autoriser une phase **compose-only** après support des filtres PNG, **ou** REJECT/APPROVE provider-only.  
Aucune de ces décisions n’est prise dans ce rapport.
