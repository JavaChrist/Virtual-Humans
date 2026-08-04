# VHS-128 — Retry humain explicite des Director runs

## Différence : retry automatique vs nouvelle tentative humaine

| | Retry automatique | Tentative humaine (VHS-128) |
|---|---|---|
| Déclencheur | Aucun (interdit) | Bouton « Réessayer l’analyse » + confirmation budget |
| Boucle | Interdite | Interdite |
| Clé | Identique → `director_run_terminal_reuse` | Nouvelle clé `<base>:attempt:<N>` |
| Run | Réutilise | Nouveau run ; précédent immuable |

## Chaîne des attempts

1. Attempt 1 : clé historique inchangée (`mkt:…`), `attempt_number=1`, `retry_of_run_id=null`.
2. Attempt N≥2 : créée uniquement via `begin_or_retry_director_run`, clé `base:attempt:N`, `retry_of_run_id` = run précédent, `retry_request_id` = UUID de la demande humaine.
3. Le Marketing Plan éventuel référence le **nouveau** run, jamais le failed précédent.

## Idempotence

- Le navigateur génère un `retryRequestId` UUID à l’ouverture/confirmation de la modale.
- Double-clic / replay API avec le même ID → le même run (pas de second appel provider).
- Après succès ou échec terminal → l’UI invalide l’ID ; une nouvelle demande humaine exige un nouvel ID.
- Après réponse réseau ambiguë → relecture dry-run serveur **avant** une nouvelle tentative ; l’ID n’est pas régénéré automatiquement.

## Concurrence

- Verrou `FOR UPDATE` sur le run précédent.
- Deux `retry_request_id` distincts : au plus un nouveau run autorisable ; l’autre reçoit `already_running` ou `retry_superseded`.
- Le numéro d’attempt n’est **jamais** fourni par le client.

## Budget

- Chaque attempt fait une **nouvelle** réservation (`dir-reserve-<newRunId>`).
- L’ancienne réservation reste released ; ledger historique intact.
- Commit / release uniquement sur la réservation de l’attempt courant.
- Confirmation budgétaire obligatoire avant chaque tentative.

## Erreurs retryables (humaines)

`rate_limited`, `timeout`, `provider_unavailable`.

Non retryables notamment : `quota_exceeded` / `insufficient_quota`, `invalid_candidate`, `unauthorized`.

## Taxonomie 429 (redacted)

- `rate_limit_exceeded` → `rate_limited` (retryable)
- `insufficient_quota` → `quota_exceeded` (non retryable)
- Observabilité : `providerRequestId`, headers rate-limit numériques, `error.code` / `type` sanitizés — jamais body / clé / prompt.

## Procédure Production (Porte 7D)

1. Appliquer la migration VHS-128 **distante** (autorisation séparée).
2. Remplacer `OPENAI_API_KEY` par une clé OpenAI directe (sans afficher).
3. Redeploy.
4. Confirmer crédits OpenAI (délai prudent 10–15 min).
5. Dry-run → bouton « Réessayer l’analyse » visible.
6. **Un seul** retry humain autorisé.
7. Historique du run `ed0b37b9-…` (429) **conservé** — aucune suppression d’audit.

## Intégration

Seul Marketing est branché (API `/marketing/retry` + UI). La RPC `begin_or_retry_director_run` est réutilisable par les autres Directors.
