# 20 — Audit final V2 (Phase 9)

**Date :** 3 août 2026  
**Périmètre :** `studio/` — pipeline `/director` V2 local  
**Décision locale :** `GO WITH EXCEPTIONS` — implémentation locale terminée et validée avec providers fakes ; **pas** production distante validée.

## Décision

| Niveau | Statut |
|---|---|
| Implémentation locale + fakes | **GO** |
| Providers réels / apply distant / deploy | **NO-GO** (autorisation humaine séparée) |

Exceptions acceptées (non bloquantes pour la validation locale) :

| Exception | Risque | Propriétaire |
|---|---|---|
| Tables legacy `vh_spend` / `vh_products` absentes du schéma V2 local | Bruit log E2E nav historique ; V2 n’écrit pas `vh_spend` | Ops + VHS-113 follow-up |
| Warnings lint `react-hooks/set-state-in-effect` (pages historiques + quelques effects Director) | Non bloquant, 0 erreur | Front |
| Warning build NFT Turbopack `registry.ts` | Historique, inchangé | Infra |
| Store mémoire fake-merge | Local/E2E only — gate Phase 9 ; **Porte 1** : remplacé par Storage durable quand persistence ON | Infra |
| Observabilité métriques/traces (VHS-005) | Partiel | Platform |

Aucun P0 ouvert pour la validation **locale**.

## Architecture (vérifié code)

- [x] pipeline et noms conformes au freeze ;
- [x] aucun appel entre Directeurs ;
- [x] objets métier validés et versionnés ;
- [x] aucun provider dans domaine/UI ;
- [x] Production Director seul orchestrateur production ;
- [x] une seule source storyboard V2 (`StoryboardDirector` + page historique `/storyboard` préservée) ;
- [x] pas de `/storyboard-v2`, pas de second Prompt/Model Router/Production/queue/ledger/révisions/approbations ;
- [x] unique source de vérité projet côté V2.

### Chaîne de provenance

```text
Brief → MarketingPlan → CreativeConcept → VideoScript → VisualDirection
→ StoryboardProject → ScenePackageSet → GenerationPlan → ProductionResult
→ QualityReport → MergePlan → ExportPackage
```

Chaque artifact : workspace, project, type, schema version, revision, provenance, correlation, createdAt/createdBy, active revision, optimistic locking si mutable via nouvelle révision.

## Fonctionnel

- [x] brief → export fonctionne (fake local) ;
- [x] approbations et révisions persistent ;
- [x] reprise après interruption (refresh `/director/[id]`) ;
- [x] merge/export et manifeste valides (fake) ;
- [x] studios existants non régressés (routes historiques présentes) ;
- [ ] scène régénérable seule — hors scope validation Phase 9 (non bloquant local).

## Budget et fiabilité

- [x] estimation avant exécution (dry-run) ;
- [x] plafond / réservation atomique (ledger V2) ;
- [x] idempotence + replay `already_done` ;
- [x] retry / fallbacks bornés (fakes) ;
- [x] aucune écriture `vh_spend` dans le pipeline V2 ;
- [ ] coûts réels rapprochés — providers réels non validés.

## Sécurité et données

- [x] auth fail-closed ; secrets serveur ; session HMAC ;
- [x] RLS locale testée ; worker secret-only ;
- [x] rate limits best-effort mémoire ;
- [x] logs redacted (incl. `data:` / `inline_data_url`) ;
- [x] store fake-merge gated (refus Vercel / prod / Supabase distant) ;
- [ ] rétention/purge automatisée — backlog P2 ;
- [ ] scan dépendances CI distant — non exécuté ici.

## Qualité

- [x] deux cycles complets locaux verts (Phase 9) ;
- [x] E2E Playwright `/director` fake + barrière réseau ;
- [x] tests contrats adapters (fakes) ;
- [ ] charge / chaos / observabilité prod — non validés.

## Documentation

- [x] contrats ↔ code (handover mis à jour Phase 9) ;
- [x] migrations locales documentées (`studio/supabase/README.md`) ;
- [x] changelog + backlog + checklist + matrice ;
- [x] flags inventoriés (`.env.example`) ;
- [ ] propriétaires ops production — à assigner avant apply distant.

## Compteurs (Porte 1 — 4 août 2026)

| Gate | Résultat |
|---|---|
| Migrations locales | **17** (VHS-127 Storage) |
| pgTAP | **286/286** |
| Intégration DB | **31/31** |
| Unitaires | **802/802** |
| E2E | **15/15** × **2** cycles (Storage) |
| Typecheck | vert |
| Lint | vert — **0** erreur, **16** warnings |
| Build | vert — 1 warning NFT historique |
| Stockage multi-instance local | **oui** |

## Matrice finale

| Fonction | Implémentée | Testée avec fake | Testée localement | Active par défaut | Validée provider réel | Validée distant |
|---|---:|---:|---:|---:|---:|---:|
| Auth | oui | oui | oui | oui (fail-closed) | n/a | non |
| Brief/révisions | oui | oui | oui | flags Director | n/a | non |
| Marketing | oui | oui | oui | non | non | non |
| Creative | oui | oui | oui | non | non | non |
| Script | oui | oui | oui | non | non | non |
| Art | oui | oui | oui | non | non | non |
| Storyboard | oui | oui | oui | non | non | non |
| Prompt | oui | oui | oui | non | n/a (déterministe) | non |
| Routing | oui | oui | oui | non | n/a | non |
| Approbations | oui | oui | oui | non | n/a | non |
| Production | oui | oui | oui | non | non | non |
| Worker | oui | oui | oui | non | non | non |
| QC/revue | oui | oui | oui | non | n/a | non |
| Merge | oui | oui (fake) | oui | non | non | non |
| Download | oui | oui | oui | non | n/a | non |
| AICCOS | stub | stub | local stub | non | non | non |
| E2E | oui | oui | oui | n/a | n/a | n/a |

### Distinctions strictes

| Affirmation | Statut |
|---|---|
| Implémenté localement | oui |
| Testé unitairement | oui |
| Testé avec fake | oui |
| Testé localement avec Supabase Docker | oui |
| Testé dans un navigateur (Playwright) | oui |
| Testé avec provider réel | **non** |
| Appliqué distant | **non** |
| Déployé | **non** |
| Prêt pour production distante | **non** |

## Corrections Phase 9

1. Gate `local-fake-delivery` — mémoire fake-merge interdite sur Vercel / production / Supabase distant.
2. Redaction logs — clés `dataUrl` / `inlineDataUrl` + détection valeur `data:…`.
3. Tests de régression : `redactSources`, gate delivery, redact data URL.
4. Warnings lint Phase 8 (imports inutilisés) corrigés.
5. `.gitignore` : `supabase/.branches/`, `supabase/.temp/`.

## Opérations non effectuées

Aucune opération distante, aucun provider réel, aucun déploiement, aucun commit/push, aucun cron.

## Conclusion autorisée

```text
Virtual Humans Studio V2 — implémentation locale terminée, validée avec providers fakes, aucune opération distante
```

Ne pas confondre avec : `production distante validée`.
