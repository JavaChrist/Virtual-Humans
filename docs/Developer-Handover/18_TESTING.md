# 18 — Stratégie de tests

**Classe :** `CURRENT` (stratégie + baselines chronologiques)

## Baselines vérifiées (ne pas confondre)

| Moment | Migrations | pgTAP | Intégration DB | Unitaires | E2E |
|---|---|---|---|---|---|
| Phase 9 / audit `20_` | 16–17 | 276–286 | 30–31 | 785–802 | 15×2 |
| Post 10A–10B | **29** | **378** | **33** | **1016** | — |
| Phase 11A PREP (`58_`) | 29 | 378 | 33 | **1122** | — |

Smokes provider texte (10B–10F) = hors CI ; preuves dans rapports `27`–`57`.
Média réel : **0** (11A prep seulement).
Voice/TTS 11C (`140_`–`148_`) : wiring + binding + catalogue + grants + seed/consent preflight (`phase-11c-voice-identity-seed-preflight.test.ts`) ; migrations-static **32/32** ; **0** ElevenLabs / persist / flags. VoiceId jamais dans les assertions. DB locale N/A le 16 août.
Motion Transfer : tests cibles MT-001…011 (domain/…/worker/QC/review/obs fake) ; suite E2E synthétique MT-012 puis benchmark Auth MT-013 — voir `59_` / `72_`.
Motion QC (MT-009) : `src/application/motion/__tests__/mt009-motion-qc.test.ts` — fake measurement only ; pas d’appel CV/provider.
Motion Review (MT-010) : `src/application/motion/__tests__/mt010-motion-review.test.ts` — décisions append-only ; retry = **0** job/ledger/provider.
Motion Observability/Security (MT-011) : `src/application/motion/__tests__/mt011-motion-observability.test.ts` — sanitizer hostile + gates + privacy ; **0** clé fal réelle.
Motion Full Dry-Run (MT-012) : `src/application/motion/__tests__/mt012-motion-e2e.test.ts` — harness A–L · dry-run public · **0** provider réel / Production writes.
Motion MV-001 readiness (MT-013A) : audit documentaire `73_` — **aucun** test provider ; validations non payantes seulement ; `MV001_NOT_EXECUTED`.
`NO PAID BENCHMARK_YET`.

## Pyramide

- nombreux tests unitaires du domaine et des schemas ;
- tests d'intégration pour workflow, repository, queue et Supabase local ;
- tests de contrat uniformes pour providers ;
- E2E ciblés sur parcours critiques ;
- tests manuels exploratoires pour qualité audiovisuelle.

## E2E locaux `/director` (Phase 8)

- **Outil :** Playwright (Chromium / Chrome système sur Windows).
- **Commandes :** `npm run build` puis `npm run test:e2e` (ou `test:e2e:headed` / `test:e2e:checkpoint`).
- **Prérequis :** Supabase local Docker ; build Next préalable ; Playwright démarre `next start` sur **3100** (parcours) et **3110** (Director off) — évite le verrou `next dev` unique.
- **Mode fake :** `DIRECTOR_V2_E2E_FAKE_MODE=1` (fail-closed : localhost Supabase, non-production, aucune clé provider).
- **Barrière réseau :** interception navigateur — refuse hosts hors localhost et domaines OpenAI/fal/ElevenLabs/AICCOS.
- **Données :** workspace `e2e-<uuid>` ; cleanup borné au marqueur `e2e-` uniquement.
- **Captures :** screenshots/traces uniquement à l’échec ; jamais de mot de passe/cookie/secret.
- **Couverture navigateurs :** Chromium only (Firefox/WebKit omis pour stabilité du checkpoint).
- **Viewports :** desktop + mobile 390×844.
- Relancer la suite E2E **deux fois** après le premier succès pour détecter flakiness.
- **Résultat Phase 8 (2026-08-03) :** 15/15 × 2 runs verts ; flakiness non constatée ; bruit log non bloquant `vh_spend` / `vh_products` (tables legacy absentes du schéma V2 local).
- **Résultat Phase 9 (2026-08-03) :** deux **cycles complets** indépendants verts (`db reset` → … → E2E) — unitaires **785**, E2E **15/15** × 2 ; aucune flakiness ; gate fake-merge + tests `redactSources` / data URL.

## Gates CI

Format, lint, TypeScript strict, tests unitaires/intégration, migrations, build, scan secrets/dépendances et tests E2E critiques. Aucun appel payant en CI.

## Fixtures canoniques

Application mobile, restaurant, photographe, service B2B, commerce et association ; formats 15/20/30/60 s ; plateformes supportées ; personnages génériques solo/duo ; médias présents/absents ; plusieurs langues.

## Tests par couche

Directeurs : invariants, traçabilité aux entrées, validation et absence de responsabilité interdite.
Router : matrice de capacités figée, scoring, budget, explication et déterminisme.
Production : machine d'état, idempotence, concurrence, retry/fallback, reprise et annulation.
Engine : contrats, webhooks, erreurs, timeout et redaction.
UI : accessibilité, autosave, conflits, erreurs et reprise.
Data : RLS, migrations, contraintes, purge et URLs signées.

## IA non déterministe

Tester d'abord schémas et invariants, pas une formulation exacte. Enregistrer des réponses synthétiques représentatives. Pour les évaluations qualitatives, utiliser un jeu versionné, une grille explicite et une revue humaine sur les changements majeurs.

## Résilience

Injecter : timeout, 429, 5xx, callback tardif/dupliqué, sortie invalide, stockage indisponible, worker interrompu, concurrence, dépassement de budget et annulation pendant un appel.

## Performance

Mesurer temps d'interaction UI, temps de planification, débit workers, délai de reprise, charge de polling/webhook et mémoire du merge. Définir les seuils après baseline, puis empêcher toute régression significative.

## Critères release

Zéro test critique rouge ou flaky connu ; couverture des invariants à 100 % ; E2E principal et rollback démontrés ; suite RLS complète ; dry-run de bout en bout ; test payant contrôlé en préproduction si autorisé.

