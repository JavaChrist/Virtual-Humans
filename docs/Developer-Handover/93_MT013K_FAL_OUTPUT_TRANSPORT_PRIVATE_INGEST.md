# MT-013K-OUTPUT-TRANSPORT — Real fal output retrieval & private ingest wiring

**Date :** 2026-08-12  
**Auth :** câbler le transport Production permettant, après succès terminal fal, de récupérer exactement une vidéo et de l’ingérer dans le bucket privé — **sans appeler fal pendant cette Auth**.

---

## Statut

```text
PRODUCTION_FAL_OUTPUT_TRANSPORT_WIRED = YES
REAL_PROVIDER_CALLS = 0
REAL_MEDIA_DOWNLOADS = 0
PRODUCTION_MEDIA_WRITES = 0
FLAGS = OFF
RUNTIME_MOTION = UNAVAILABLE
NEW_DEPLOY_PREFLIGHT_REQUIRED = YES
```

## Chemin canonique

```text
providerJobId durable
→ lecture résultat terminal fal (getResult — jamais resubmit)
→ URL provider mémoire seule
→ téléchargement HTTPS borné (allowlist / SSRF)
→ validation technique
→ checksum
→ upload Storage privé director-final-assets …/motion/output/{assetId}.mp4
→ asset motion_provider_output non actif
→ QC / Human Review (consumer drain existant)
```

Aucune URL fal/CDN n’est persistée ni loguée.  
Si un process frais n’a plus l’URL : `getResult(providerJobId)` uniquement — **pas** de nouvelle génération.

## Consumer

- Uniquement `mode: "drain"` (orchestrateur / queue existants).
- Pas de second consumer, worker, cron ou chemin direct.

## Compteurs provider (distincts)

| Compteur | Signification |
|----------|----------------|
| `submitCount` | Unique submit payant (génération) |
| `pollCount` / `statusCount` | Polls `fal.queue.status` |
| `resultFetchCount` | Récupération résultat terminal (`getResult` / `fal.queue.result`) |
| `mediaDownloadCount` | GET média CDN (port download) |

Limite future « un appel provider » = **un seul submit payant**. Polls + result fetch du même `providerJobId` sont permis.

## Download sécurisé

Module `safe-fal-media-fetch.ts` :

- HTTPS uniquement ; hosts `*.fal.media` / `*.fal.ai`
- refus localhost / loopback / link-local / IP privées
- redirects manuels re-validés, count borné
- timeout + `AbortSignal`
- taille max avant (Content-Length) et après stream
- MIME `video/mp4` uniquement
- refus data URL / base64 / credentials dans l’URL
- aucun header secret vers le host média
- fichier temporaire borné + nettoyage `finally`
- **une seule** tentative réseau par étape (pas de retry caché)

## Gates Production (resolver)

`resolveProductionMotionOutputDownloadPort` / `evaluateMotionOutputTransportGates` — **disabled by default** :

- job MV-001 + `MV001_PROJECT_ID` exact
- `providerJobId` persisté
- terminal provider success
- Privacy Pack 5/5 non expiré
- drain permission (`mode=drain`) pour ce job
- flags fal/result transport ON
- Storage privé validé (`director-final-assets`)
- admission/submit fermés
- fake transport **interdit** sous Vercel/Production
- `FAL_KEY` lu **uniquement** après gates OK (lazy SDK)

Avec FLAGS OFF : fail-closed, **0** lecture `FAL_KEY`, **0** réseau.

## Ingest privé (invariants QC-CONSUMER conservés)

- bucket `director-final-assets`, public=false
- scope workspace/project exact
- chemin `motion/output/{assetId}.mp4`
- aucun overwrite ; fingerprint/checksum idempotent
- asset `motion_provider_output` non actif
- URL Storage jamais persistée
- crash recovery sans second download si objet déjà vérifiable
- pas de double asset / report / review

## Fichiers clés

- `fal-motion-control-transport.ts` — `getResult` + compteurs
- `fal-sdk-motion-control-transport.ts` — status / result séparés
- `fal-terminal-result.ts` — validation COMPLETED + 1 vidéo
- `safe-fal-media-fetch.ts` — SSRF / allowlist / temp cleanup
- `fal-motion-output-download-port.ts` — result → memory URL → bytes
- `gated-motion-output-download.ts` — gates Production
- `motion-output-drain.ts` — contexte drain pour gates
- `production-motion-transfer.ts` — composition DI
- Tests : `mt013k-output-transport.test.ts`

## Migration

**Non requise.**

## Prochaine porte

1. **New deploy-preflight** (wire + durability + QC consumer + output transport) — **ne pas lancer dans cette Auth**.  
2. Puis dry-run live / Auth payante contrôlée (≤1 submit fal).
