# Glossaire normatif

**AI Video Director** — nom de l'expérience `/director` et du workflow applicatif ; ce n'est pas un neuvième Directeur métier.  
**Artifact** — sortie immuable, versionnée et persistable d'une étape.  
**Art Director** — produit la mise en scène et `VisualDirection`.  
**Capability Registry** — catalogue versionné des possibilités, limites, prix et disponibilité des modèles.  
**Character** — personnage abstrait fourni par le Runtime SDK ; Tom et Mei ne sont que des instances.  
**Creative Concept** — grande idée, approche narrative et arc émotionnel.  
**Creative Director** — transforme le plan marketing en `CreativeConcept`.  
**Director** — décideur métier pur ; il ne produit aucun média et n'appelle pas un autre Director.  
**Dry-run** — validation complète sans appel externe payant.  
**Fallback** — alternative prévue par le Router et déclenchée par le Production Director après un échec admissible.  
**Generation Engine** — exécuteur technique normalisant les adapters providers.  
**Generation Plan** — DAG ordonné des étapes, modèles, coûts, fallbacks et explications.  
**Idempotence** — propriété garantissant qu'une commande répétée ne duplique ni production ni dépense.  
**Marketing Director** — produit le message stratégique `MarketingPlan`.  
**Model Router** — système expert qui choisit une stratégie de production sous contraintes.  
**Production Director** — unique orchestrateur d'exécution, qualité, reprise, merge et export.  
**Prompt Composer** — rend des blocs structurés dans une syntaxe adaptée à un profil/modèle.  
**Prompt Director** — produit les `ScenePackage`, sans décider du modèle.  
**Provider** — service externe exécutant image, vidéo, voix, lipsync ou autre média.  
**Revision** — nouvelle version append-only d'un artifact ; une révision active est explicitement désignée.  
**Routing Rationale** — explication structurée et traçable d'une décision du Router.  
**Scene Package** — représentation complète d'une scène : intention, sujet, action, environnement, caméra, lumière, références, contraintes et variantes de prompt.  
**Script Writer** — produit `VideoScript`, propriétaire du texte prononcé/affiché.  
**Storyboard Director** — découpe en scènes et produit `StoryboardProject`.  
**Storyboard Project** — contrat de tournage approuvé et immuable pour une révision.  
**Video Project Brief** — intention utilisateur normalisée et validée.  
**Visual Direction** — style global et décisions visuelles par scène.

## Termes proscrits

`Quality Director` comme module V2, `Video Director` comme Directeur métier séparé, appels directs entre Directeurs, provider par défaut caché, personnages codés en dur et retry infini.

