# VIRTUAL HUMANS SDK — CURSOR IMPLEMENTATION BRIEF

**Document type:** Product + Runtime + Integration Specification  
**Target:** Cursor / Senior Full-Stack AI Engineer  
**Project:** Virtual Humans SDK  
**Primary character:** Mei  
**Integration target:** AI Command Center OS  
**Status:** Implementation directive  
**Language of implementation:** English  
**Business explanations:** French comments allowed when useful  
**Architecture status:** Existing architecture must be preserved unless a blocking contradiction is proven.

---

# 1. Mission

The current Virtual Humans SDK is functional, but it does not yet use all available character data reliably.

The main issue is not the absence of information. The repository already contains identity assets, outfits, personality documents, memories, schemas, prompts, workflow rules and video instructions.

The issue is that the runtime does not consistently:

1. discover the available data;
2. resolve the correct data for the requested use case;
3. merge the data with explicit priorities;
4. inject the resolved data into prompts and production jobs;
5. validate that the generated result respects the character;
6. expose this capability cleanly to AI Command Center OS and Léo.

The implementation must transform the repository from a passive documentation library into an executable character system.

The expected result is that a request such as:

> “Create a 30-second Instagram video with Mei to present RideCloud.”

automatically uses:

- Mei’s visual identity;
- Mei’s personality and tone;
- Mei’s approved opening sentence;
- Mei’s approved closing sentence;
- the appropriate outfit;
- the product memory for RideCloud;
- the correct social format;
- the correct video workflow;
- the appropriate provider adapter;
- identity-preservation rules;
- output validation;
- approval rules before publishing.

Cursor must not invent these elements when they already exist in the SDK.

---

# 2. Product Vision

Virtual Humans SDK is a provider-agnostic system for creating, controlling and reusing persistent virtual characters.

A virtual human is not only an image or a prompt.

A virtual human is a versioned package containing:

- identity;
- appearance;
- personality;
- voice;
- behavior;
- wardrobe;
- expressions;
- poses;
- relationships;
- brand rules;
- product knowledge;
- marketing knowledge;
- social rules;
- video rules;
- reusable phrases;
- capabilities;
- limitations;
- memories;
- assets;
- workflows;
- provider-specific adaptations;
- validation rules.

The first official character is Mei.

Tom and future characters must use the same architecture without hard-coding Mei-specific logic into the generic runtime.

The SDK must remain:

- provider agnostic;
- character agnostic;
- workflow driven;
- capability driven;
- validation first;
- identity preserving;
- versioned;
- deterministic where possible;
- inspectable by humans;
- machine-readable at runtime.

Markdown remains the human source of truth. JSON or TypeScript manifests may be generated or cached for runtime use, but they must not silently replace the source documents.

---

# 3. Business Roles

## 3.1 Christian

Christian is the owner and final decision-maker.

He can:

- request a campaign;
- select or approve a character;
- choose a product;
- review scripts;
- review images;
- review videos;
- approve publishing;
- override non-critical automatic choices.

## 3.2 Léo

Léo is the only AI interface visible inside AI Command Center OS.

Léo:

- understands Christian’s business request;
- selects the correct business workflow;
- delegates virtual-human production to the SDK;
- presents choices and previews;
- asks for approval only when necessary;
- receives structured production results;
- never exposes internal agents as separate assistants.

Léo does not manually rebuild Mei’s prompt.

Léo calls the Virtual Humans SDK with a structured request.

## 3.3 AI Command Center OS

AI Command Center OS is the orchestrator.

It owns:

- user conversation;
- product selection;
- campaign context;
- approvals;
- publishing permissions;
- business history;
- global task tracking;
- provider credentials or provider gateway configuration.

It must not own Mei’s identity definition.

## 3.4 Virtual Humans SDK

The SDK owns:

- character packages;
- identity;
- wardrobe;
- personality;
- recurring phrases;
- character behavior;
- character-level memories;
- prompt assembly;
- media job preparation;
- character validation;
- provider adaptation;
- character output metadata.

## 3.5 Providers

Providers execute generation tasks.

Examples:

- image generation;
- video generation;
- text generation;
- voice generation;
- lip-sync;
- background removal;
- subtitle generation.

Providers must never become the source of truth for character identity.

---

# 4. Required User Interface

The current version may already have a functional UI. Do not replace it blindly.

Audit the existing UI and align it with the following product model.

## 4.1 Main navigation

The application should expose these areas:

1. Dashboard
2. Characters
3. Productions
4. Library
5. Workflows
6. Providers
7. Validation
8. Settings
9. Integration

## 4.2 Dashboard

The dashboard answers:

- Which characters are available?
- What productions are in progress?
- What requires approval?
- Which provider jobs failed?
- Which assets are missing?
- Is AI Command Center OS connected?

Recommended cards:

- Active Characters
- Draft Productions
- Waiting for Approval
- Failed Jobs
- Recent Outputs
- Provider Status
- SDK Health
- AI Command Center OS Connection

## 4.3 Characters screen

Display all versioned characters.

Example:

- Mei — v1.0.0 — Active
- Tom — not yet packaged
- Future characters

Each character card must show:

- reference portrait;
- name;
- version;
- status;
- enabled capabilities;
- number of outfits;
- number of poses;
- number of expressions;
- voice status;
- last validation date.

## 4.4 Character detail screen

The character detail page must make the data visible and usable.

Tabs:

- Overview
- Identity
- Appearance
- Personality
- Voice
- Wardrobe
- Poses
- Expressions
- Behavior
- Phrases
- Memories
- Capabilities
- Limitations
- Relationships
- Assets
- Validation
- Versions

The purpose is not only documentation display.

Each tab must expose runtime-ready information and validation status.

## 4.5 Wardrobe screen

The wardrobe library must load all outfit manifests from:

`characters/<character-package>/assets/outfits/**/look.json`

For each outfit, display:

- outfit ID;
- thumbnail;
- full reference image;
- label;
- description;
- category;
- colors;
- compatible formats;
- compatible scenes;
- compatible products;
- forbidden contexts;
- provider notes;
- status;
- version.

The UI must never rely only on the folder name.

The `look.json` manifest is the machine-readable entry point.

The corresponding `look.md` supplies human explanation and creative context.

The runtime must support:

- automatic outfit selection;
- manual outfit selection;
- outfit exclusion;
- outfit compatibility validation;
- fallback outfit selection.

## 4.6 Phrases screen

Create a dedicated reusable phrases registry.

Phrases must not remain hidden inside long Markdown documents.

At minimum, Mei must support:

- default opening phrase;
- default closing phrase;
- social opening phrase;
- social closing phrase;
- product-presentation opening;
- product-presentation closing;
- tutorial opening;
- tutorial closing;
- fallback neutral opening;
- fallback neutral closing.

Each phrase must have:

- ID;
- exact text;
- language;
- purpose;
- tone;
- allowed channels;
- allowed products;
- priority;
- active status;
- optional variations;
- locked or editable status.

The beginning and ending phrases must be injected automatically when the selected workflow requires them.

They must not be added when the format explicitly forbids them.

## 4.7 Production wizard

The production wizard should guide the user through:

1. Objective
2. Character
3. Product or subject
4. Channel
5. Format
6. Duration
7. Scene
8. Outfit
9. Voice
10. Script
11. Provider
12. Validation
13. Approval
14. Export or publish

Automatic choices must be visible.

Example:

- “Outfit automatically selected: LOOK_004 because this is a professional RideCloud product presentation.”
- “Opening phrase loaded from Mei phrase registry.”
- “9:16 format selected for Instagram Reel.”
- “Identity reference images attached: 3.”
- “Provider adapter: Runway.”

The user may override a choice unless it violates a locked identity or legal rule.

## 4.8 Library

The Library is the visible asset system.

Categories:

- Identity references
- Outfits
- Poses
- Expressions
- Backgrounds
- Product screenshots
- Product logos
- Audio
- Voices
- Generated images
- Draft videos
- Approved videos
- Social exports
- Presentation exports

Every asset must have metadata, not only a filesystem path.

## 4.9 Validation screen

The validation screen must report:

- identity consistency;
- outfit compliance;
- phrase compliance;
- personality compliance;
- script compliance;
- duration compliance;
- format compliance;
- provider constraints;
- product facts;
- legal or publishing restrictions;
- missing assets;
- blocking errors;
- warnings;
- automatic fixes.

Validation results must be structured and persisted.

---

# 5. Runtime Architecture

Implement the runtime as explicit services.

Suggested modules:

```text
src/
├── application/
│   ├── create-production/
│   ├── resolve-character/
│   ├── resolve-workflow/
│   ├── validate-production/
│   └── execute-production/
├── domain/
│   ├── character/
│   ├── outfit/
│   ├── phrase/
│   ├── memory/
│   ├── workflow/
│   ├── capability/
│   ├── limitation/
│   ├── production/
│   ├── provider/
│   └── validation/
├── infrastructure/
│   ├── filesystem/
│   ├── markdown/
│   ├── manifests/
│   ├── providers/
│   ├── persistence/
│   └── ai-command-center/
└── interface/
    ├── api/
    ├── ui/
    └── cli/
```

Do not force this exact physical structure if the project already has a clean equivalent.

The required logical responsibilities are non-negotiable.

## 5.1 CharacterRegistry

Responsibilities:

- discover character packages;
- read package metadata;
- expose available versions;
- return active version;
- reject invalid packages;
- cache parsed character manifests;
- invalidate cache when source files change.

Example methods:

```ts
interface CharacterRegistry {
  listCharacters(): Promise<CharacterSummary[]>;
  getCharacter(characterId: string, version?: string): Promise<CharacterPackage>;
  getActiveCharacterVersion(characterId: string): Promise<string>;
  validatePackage(characterId: string, version: string): Promise<ValidationReport>;
}
```

## 5.2 CharacterPackageLoader

Responsibilities:

- load all character documents;
- load JSON manifests;
- load phrase registry;
- load outfits;
- load poses;
- load expressions;
- load memory files;
- load prompt templates;
- load provider notes;
- normalize paths;
- produce one typed `CharacterPackage`.

It must fail visibly when required data is unavailable.

It must not silently continue with an empty personality, empty wardrobe or missing identity.

## 5.3 DataResolver

The DataResolver converts a production request into a resolved production context.

Input:

```ts
type ProductionRequest = {
  requestedBy: "christian" | "leo" | "system";
  characterId: string;
  characterVersion?: string;
  objective: string;
  productId?: string;
  channel?: string;
  format?: string;
  durationSeconds?: number;
  language?: string;
  sceneId?: string;
  outfitId?: string;
  poseId?: string;
  expressionId?: string;
  providerPreference?: string;
  includeOpening?: boolean;
  includeClosing?: boolean;
  publishingIntent?: "draft" | "review" | "publish";
  userInstructions?: string;
};
```

Output:

```ts
type ResolvedProductionContext = {
  request: ProductionRequest;
  character: ResolvedCharacterContext;
  product?: ResolvedProductContext;
  workflow: ResolvedWorkflow;
  channel?: ResolvedChannelRules;
  outfit: ResolvedOutfit;
  phrases: {
    opening?: ResolvedPhrase;
    closing?: ResolvedPhrase;
  };
  identityReferences: AssetReference[];
  poseReferences: AssetReference[];
  expressionReferences: AssetReference[];
  sceneReferences: AssetReference[];
  promptBlocks: PromptBlock[];
  providerPlan: ProviderExecutionPlan;
  validations: ValidationReport[];
  decisions: ResolutionDecision[];
};
```

Every automatic decision must be recorded in `decisions`.

## 5.4 PromptAssembler

The PromptAssembler must build prompts from ordered blocks.

It must not concatenate random documents.

Required block order:

1. System production objective
2. Provider constraints
3. Character identity lock
4. Appearance
5. Personality
6. Behavior
7. Voice
8. Product facts
9. Brand rules
10. Channel rules
11. Workflow rules
12. Scene
13. Outfit
14. Pose
15. Expression
16. Opening phrase
17. Core script
18. Closing phrase
19. Negative constraints
20. Output format
21. Validation checklist

Each block must have:

- source ID;
- source path;
- priority;
- locked status;
- content;
- token or length estimate;
- inclusion reason.

The final production record must retain prompt provenance.

## 5.5 WorkflowEngine

The WorkflowEngine selects and executes the appropriate workflow.

Examples:

- product presentation;
- Instagram Reel;
- TikTok;
- LinkedIn short video;
- YouTube presentation;
- green-screen presenter;
- tutorial;
- commercial ad;
- image portrait;
- walking scene;
- interview;
- micro-trottoir;
- selfie;
- voice-only narration.

A workflow defines:

- required inputs;
- optional inputs;
- default duration;
- default aspect ratio;
- required phrases;
- outfit selection strategy;
- script structure;
- provider capabilities;
- validation gates;
- approval gates;
- output destinations.

## 5.6 CapabilityResolver

The CapabilityResolver verifies that:

- the character supports the requested action;
- the workflow supports the requested format;
- the selected provider can execute the required job;
- required assets exist;
- fallback paths are available.

It must never invent a capability.

## 5.7 LimitationEngine

The LimitationEngine evaluates:

- character limitations;
- provider limitations;
- channel limitations;
- legal limitations;
- quality limitations;
- publishing limitations;
- missing-consent rules;
- external-action restrictions.

A blocking limitation stops execution.

A warning requires explicit review or automatic adaptation.

## 5.8 ValidationEngine

Validation occurs at several stages:

### Pre-generation

- package valid;
- identity references present;
- outfit exists;
- phrases resolved;
- product facts loaded;
- workflow supported;
- provider supported;
- target format valid.

### Post-script

- opening phrase respected;
- closing phrase respected;
- personality respected;
- facts supported;
- call to action valid;
- duration estimate valid.

### Post-image

- face identity consistency;
- age consistency;
- hairstyle consistency;
- body proportion consistency;
- outfit match;
- forbidden colors or objects;
- background compliance;
- pose compliance.

### Post-video

- identity drift;
- lip-sync quality;
- voice match;
- opening and closing presence;
- duration;
- frame ratio;
- subtitle safety;
- visual artifacts;
- branding;
- output quality.

### Pre-publishing

- Christian approval;
- channel metadata;
- caption;
- thumbnail;
- copyright or consent;
- final file location;
- publishing permission.

---

# 6. Data Priority Rules

Cursor must implement explicit precedence.

Highest priority first:

1. Christian’s explicit request
2. Locked character identity rules
3. Character lock file
4. Legal and safety constraints
5. Workflow requirements
6. Character package structured manifests
7. Character Markdown source documents
8. Product and brand memory
9. Channel-specific rules
10. Provider adapter constraints
11. Automatic defaults
12. Provider creative interpretation

Important exception:

Christian’s request cannot override locked identity, legal, safety or explicit publishing restrictions without a deliberate administrative override mechanism.

Provider defaults are always lowest priority.

If two sources conflict, the runtime must:

- detect the conflict;
- record both sources;
- apply precedence;
- expose the decision;
- never silently merge contradictory values.

---

# 7. Mei Character Requirements

## 7.1 Identity preservation

Mei is a persistent commercial presenter.

Her identity must remain stable across:

- images;
- videos;
- product presentations;
- social posts;
- green-screen clips;
- professional scenes;
- casual scenes;
- future providers.

The runtime must always attach approved identity references when the provider supports image references.

Text description alone is insufficient when visual reference assets are available.

Identity consistency has higher priority than:

- outfit creativity;
- background creativity;
- camera creativity;
- pose creativity;
- provider style.

## 7.2 Personality usage

Mei’s personality must influence:

- vocabulary;
- sentence rhythm;
- warmth;
- confidence;
- humor level;
- commercial pressure;
- body language;
- facial expression;
- call to action;
- opening phrase;
- closing phrase.

Do not treat personality as a page displayed in the UI only.

Convert it into runtime instructions.

Create a structured personality model if one does not already exist.

Example:

```ts
type PersonalityProfile = {
  warmth: number;
  energy: number;
  confidence: number;
  formality: number;
  humor: number;
  commercialPressure: number;
  pedagogicalStyle: string[];
  forbiddenTraits: string[];
  preferredVocabulary: string[];
  avoidedVocabulary: string[];
  sentenceStyle: string[];
};
```

The Markdown document remains the source of truth. The structured representation may be generated and validated from it.

## 7.3 Opening and closing phrases

The runtime must locate Mei’s approved recurring sentences.

Do not duplicate phrase text in multiple components.

Create a canonical phrase registry.

Suggested file:

`characters/Mei SDK v1.0.0/data/phrases.json`

or an equivalent existing location.

Example:

```json
{
  "schemaVersion": "1.0.0",
  "characterId": "mei",
  "phrases": [
    {
      "id": "mei.opening.default.fr",
      "type": "opening",
      "language": "fr",
      "text": "[USE THE EXACT APPROVED SENTENCE FROM THE EXISTING SDK]",
      "contexts": ["product-presentation", "social-video"],
      "channels": ["instagram", "tiktok", "linkedin", "youtube"],
      "priority": 100,
      "locked": true,
      "active": true
    },
    {
      "id": "mei.closing.default.fr",
      "type": "closing",
      "language": "fr",
      "text": "[USE THE EXACT APPROVED SENTENCE FROM THE EXISTING SDK]",
      "contexts": ["product-presentation", "social-video"],
      "channels": ["instagram", "tiktok", "linkedin", "youtube"],
      "priority": 100,
      "locked": true,
      "active": true
    }
  ]
}
```

Cursor must extract the exact approved sentences from the existing repository.

Do not invent replacements.

If no exact canonical version can be found:

- raise a visible data-quality issue;
- show all candidate phrases and source paths;
- do not silently choose a new sentence.

## 7.4 Wardrobe usage

The ten existing looks must become selectable runtime resources.

The automatic outfit resolver should consider:

- product;
- audience;
- channel;
- scene;
- tone;
- duration;
- season if relevant;
- background compatibility;
- green-screen restrictions;
- brand colors;
- previous recent usage;
- provider constraints.

Example scoring:

```ts
score =
  contextMatch * 30 +
  channelMatch * 20 +
  productMatch * 20 +
  sceneMatch * 15 +
  brandMatch * 10 +
  recencyDiversity * 5 -
  conflictPenalty;
```

The selected outfit must be accompanied by:

- outfit ID;
- reference image path;
- thumbnail path;
- reason for selection;
- conflicts;
- fallback outfit.

Manual selection always overrides automatic scoring unless invalid.

## 7.5 Green-screen rule

When producing a green-screen presenter:

- background must be uniform `#00FF00`;
- clothing must not contain green likely to interfere with chroma key;
- green accessories must be rejected;
- green reflections must be minimized;
- full body and phone position must follow the selected workflow;
- identity references remain mandatory;
- shadows must follow the existing green-screen standard.

## 7.6 Product presentation behavior

For a commercial application presentation, Mei must:

- open using the correct approved phrase;
- identify the user problem;
- introduce the product;
- demonstrate one or more concrete benefits;
- avoid unsupported claims;
- keep the tone warm and credible;
- use the product’s real terminology;
- provide a clear call to action;
- finish using the correct approved closing phrase.

She must not sound like a generic advertising avatar.

---

# 8. Library System

The library must be implemented as a first-class service.

## 8.1 Asset indexing

At application start or explicit rescan:

- scan character asset directories;
- validate filenames and manifests;
- compute stable asset IDs;
- read dimensions and file type;
- associate metadata;
- record character and version;
- detect duplicates;
- detect missing manifest references;
- detect orphan files;
- update the asset index.

Suggested interface:

```ts
interface AssetLibrary {
  scan(): Promise<AssetScanReport>;
  list(query: AssetQuery): Promise<AssetRecord[]>;
  get(assetId: string): Promise<AssetRecord>;
  resolveReferences(ids: string[]): Promise<ResolvedAssetReference[]>;
}
```

## 8.2 Asset record

```ts
type AssetRecord = {
  id: string;
  characterId?: string;
  characterVersion?: string;
  type:
    | "identity"
    | "outfit"
    | "pose"
    | "expression"
    | "background"
    | "product"
    | "voice"
    | "audio"
    | "video"
    | "thumbnail";
  path: string;
  mimeType: string;
  width?: number;
  height?: number;
  checksum: string;
  tags: string[];
  status: "draft" | "approved" | "deprecated" | "blocked";
  metadata: Record<string, unknown>;
};
```

## 8.3 Approved assets only

Production workflows must use approved assets by default.

Draft assets may be used only:

- in a draft workflow;
- with an explicit option;
- with a warning.

Blocked assets must never be used.

## 8.4 Relative paths

No production logic should depend on machine-specific absolute paths.

Store normalized paths relative to the SDK root.

Use one path resolver service.

---

# 9. Production Pipeline

The real pipeline must follow this sequence.

## Step 1 — Receive request

Source:

- UI;
- API;
- CLI;
- AI Command Center OS.

## Step 2 — Normalize request

Convert natural-language or UI input into a typed `ProductionRequest`.

Do not lose the original request.

## Step 3 — Resolve product context

Load:

- product memory;
- product features;
- target audience;
- branding;
- approved claims;
- forbidden claims;
- call to action;
- screenshots;
- logos.

## Step 4 — Resolve character

Load the requested character and active version.

## Step 5 — Resolve workflow

Choose the workflow according to:

- objective;
- channel;
- format;
- duration;
- requested media type.

## Step 6 — Resolve assets

Select:

- identity references;
- outfit;
- pose;
- expression;
- scene;
- product visual assets.

## Step 7 — Resolve phrases

Select opening and closing according to:

- language;
- workflow;
- product;
- channel;
- explicit inclusion flags.

## Step 8 — Build script

The script generation receives:

- product facts;
- Mei personality;
- phrase requirements;
- duration;
- channel;
- CTA;
- limitations.

## Step 9 — Validate script

Reject or fix:

- missing phrase;
- unsupported claim;
- wrong tone;
- excessive length;
- wrong product name;
- invented feature;
- invalid CTA.

## Step 10 — Build provider plan

A production may require multiple providers:

- LLM for script;
- voice provider;
- image provider;
- video provider;
- lip-sync provider;
- subtitle renderer;
- transcoder.

Store the complete DAG or ordered job plan.

## Step 11 — Generate draft assets

All generated outputs first enter draft status.

## Step 12 — Validate outputs

Run automated and manual validation.

## Step 13 — Present preview

Show:

- script;
- chosen outfit;
- opening and closing phrases;
- identity references;
- provider;
- generated preview;
- warnings;
- cost estimate if available.

## Step 14 — Approval

No external publication without Christian’s explicit approval.

## Step 15 — Export or publish

Save outputs into the correct asset directories and return structured metadata to AI Command Center OS.

---

# 10. AI Command Center OS Integration

## 10.1 Integration principle

AI Command Center OS orchestrates.

Virtual Humans SDK executes character production.

The integration must be through a stable contract, not direct filesystem guessing from AI Command Center OS.

Preferred options:

1. Internal HTTP API
2. Local SDK package
3. Local command interface as fallback

The HTTP API is the clearest separation if the systems run as separate applications.

## 10.2 Required API endpoints

Suggested API contract:

### List characters

`GET /api/v1/characters`

### Character details

`GET /api/v1/characters/:characterId`

### List outfits

`GET /api/v1/characters/:characterId/outfits`

### Resolve production request without generating

`POST /api/v1/productions/resolve`

### Create production

`POST /api/v1/productions`

### Get production

`GET /api/v1/productions/:productionId`

### Validate production

`POST /api/v1/productions/:productionId/validate`

### Approve production

`POST /api/v1/productions/:productionId/approve`

### Execute next job

`POST /api/v1/productions/:productionId/execute`

### Export production

`POST /api/v1/productions/:productionId/export`

### SDK health

`GET /api/v1/health`

## 10.3 Request from Léo

Example:

```json
{
  "requestedBy": "leo",
  "requestId": "accos_req_123",
  "characterId": "mei",
  "objective": "Present RideCloud in a short social video",
  "productId": "ridecloud",
  "channel": "instagram",
  "format": "reel",
  "durationSeconds": 30,
  "language": "fr",
  "publishingIntent": "review",
  "userInstructions": "Highlight maintenance reminders and document storage."
}
```

## 10.4 Response to Léo

```json
{
  "productionId": "vh_prod_456",
  "status": "resolved",
  "summary": "Instagram Reel production prepared with Mei.",
  "character": {
    "id": "mei",
    "version": "1.0.0"
  },
  "selectedOutfit": {
    "id": "LOOK_004",
    "reason": "Professional product presentation compatible with RideCloud branding."
  },
  "phrases": {
    "opening": {
      "id": "mei.opening.default.fr",
      "text": "..."
    },
    "closing": {
      "id": "mei.closing.default.fr",
      "text": "..."
    }
  },
  "scriptStatus": "draft",
  "validation": {
    "blockingErrors": [],
    "warnings": []
  },
  "requiresApproval": true,
  "nextActions": [
    "review_script",
    "generate_preview",
    "change_outfit"
  ]
}
```

## 10.5 Léo behavior

Léo should be able to say:

> “J’ai préparé la vidéo RideCloud avec Mei. J’ai sélectionné LOOK_004, ajouté sa phrase d’ouverture et sa phrase de fin, et construit un script de 30 secondes. Il me reste à générer l’aperçu.”

Léo must not claim that assets were used unless the SDK response confirms them.

## 10.6 Authentication

Use a server-to-server secret or signed local token.

Do not expose provider keys to the browser.

## 10.7 Idempotency

Requests from AI Command Center OS must support an idempotency key.

Repeated calls with the same request ID must not create duplicate productions unintentionally.

## 10.8 Event model

The SDK should emit events such as:

- production.created;
- production.resolved;
- script.generated;
- script.validated;
- asset.generated;
- asset.validation_failed;
- production.waiting_for_approval;
- production.approved;
- production.exported;
- production.failed.

AI Command Center OS can consume these events through:

- polling initially;
- webhook later;
- internal event bus if both systems share a runtime.

Do not make webhook infrastructure a blocker for V1.

---

# 11. Provider Abstraction

## 11.1 Generic adapter

```ts
interface MediaProviderAdapter {
  id: string;
  capabilities(): ProviderCapabilities;
  validateJob(job: ProviderJob): Promise<ValidationReport>;
  estimate?(job: ProviderJob): Promise<ProviderEstimate>;
  execute(job: ProviderJob): Promise<ProviderJobResult>;
  getStatus(jobId: string): Promise<ProviderJobStatus>;
}
```

## 11.2 Provider-specific mapping

Provider documents may define:

- prompt syntax;
- image reference limits;
- supported aspect ratios;
- duration limits;
- negative prompt support;
- seed support;
- character reference support;
- motion controls;
- camera controls;
- pricing metadata;
- timeout behavior;
- retry policy.

These constraints must be mapped by adapters.

They must not leak into core character identity.

## 11.3 Provider selection

Provider selection can consider:

- required capability;
- identity consistency;
- video duration;
- format;
- cost;
- speed;
- user preference;
- provider availability;
- prior validation success;
- quality tier.

Store the reason for provider selection.

## 11.4 Fallback

A fallback provider can be selected only if:

- it supports all required capabilities;
- it does not weaken locked identity constraints;
- cost or quality changes are disclosed;
- no unsupported automatic publication occurs.

---

# 12. Persistence Model

At minimum, persist:

- productions;
- production requests;
- resolution decisions;
- generated scripts;
- selected assets;
- provider jobs;
- validation reports;
- approvals;
- exports;
- failures;
- character package versions used.

A production must be reproducible.

Store a snapshot or content hashes of all critical resolved sources.

Do not rely only on “current Mei version” after production.

Example entities:

```text
CharacterPackage
CharacterVersion
Asset
Outfit
Phrase
Workflow
Production
ProductionDecision
ProductionAsset
ProviderJob
ValidationReport
Approval
Export
```

For a local-first V1, SQLite or the project’s existing database is acceptable.

If the current stack already uses Supabase/PostgreSQL, reuse it rather than introducing another database without reason.

---

# 13. Errors and Observability

## 13.1 Required error classes

- CharacterNotFoundError
- CharacterPackageInvalidError
- IdentityAssetMissingError
- OutfitNotFoundError
- PhraseNotFoundError
- WorkflowNotSupportedError
- CapabilityNotSupportedError
- ProviderNotAvailableError
- ValidationBlockedError
- ApprovalRequiredError
- ProductContextMissingError
- AssetPathInvalidError

## 13.2 No silent fallback

Forbidden behavior:

- empty personality replaced with a generic assistant tone;
- missing phrase replaced by an invented phrase;
- missing outfit replaced by provider-selected clothes;
- missing identity image replaced by text-only generation;
- unavailable product facts replaced by model knowledge;
- provider failure hidden as success.

## 13.3 Logs

Each production must have traceable logs:

- request received;
- source documents loaded;
- automatic decisions;
- prompt blocks included;
- provider calls;
- generated asset paths;
- validation results;
- approval;
- export.

Never log secrets or full provider credentials.

---

# 14. Tests

## 14.1 Unit tests

Required:

- character package loading;
- Markdown parsing;
- outfit manifest parsing;
- phrase resolution;
- priority conflict resolution;
- workflow selection;
- capability resolution;
- limitation blocking;
- provider selection;
- path normalization;
- prompt block ordering.

## 14.2 Integration tests

Required scenario:

### Scenario A — RideCloud Instagram Reel

Given:

- character Mei;
- product RideCloud;
- channel Instagram;
- 30 seconds;
- French;
- review intent.

Expected:

- Mei v1.0.0 loaded;
- identity references attached;
- compatible outfit selected;
- exact approved opening loaded;
- exact approved closing loaded;
- RideCloud facts loaded;
- Instagram 9:16 workflow selected;
- script generated;
- script validated;
- publication blocked until approval.

### Scenario B — Manual outfit

Given a valid `outfitId`, the runtime must use it and record manual override.

### Scenario C — Invalid outfit

Given an outfit incompatible with green screen, validation must block or request another outfit.

### Scenario D — Missing phrase

When a required canonical phrase is missing, resolution must fail visibly.

### Scenario E — Provider fallback

When preferred provider is unavailable, the runtime must present the fallback and impact before execution.

### Scenario F — Identity assets missing

Generation must not proceed silently.

## 14.3 End-to-end test

From AI Command Center OS:

1. Léo sends structured production request.
2. SDK resolves the request.
3. SDK returns outfit and phrases.
4. User reviews.
5. Draft generation starts.
6. Validation runs.
7. User approves.
8. Export is created.
9. AI Command Center OS receives final result.

---

# 15. Acceptance Criteria

The implementation is not complete until all of the following are true.

## Character data

- Mei’s package is loaded from the repository.
- Identity assets are attached automatically.
- Personality affects script and behavior prompts.
- All ten outfits are visible and selectable.
- Automatic outfit selection explains its decision.
- Opening and closing phrases are loaded from one canonical registry.
- Missing canonical phrases create a blocking data-quality error.

## Library

- Assets are indexed.
- Assets have stable IDs.
- Approved and draft assets are distinguished.
- Orphan or missing files are reported.
- Relative paths work across machines.

## Production

- A typed production request is created.
- The workflow is resolved.
- Prompt provenance is stored.
- Provider jobs are explicit.
- Validation occurs before and after generation.
- Publishing requires approval.

## AI Command Center OS

- Léo can list characters.
- Léo can request a resolved production.
- Léo receives structured decisions.
- Léo can ask for a draft.
- Léo can present approval actions.
- Duplicate requests are prevented.
- Provider secrets remain server-side.

## Quality

- No generic fallback replaces Mei silently.
- No provider invents wardrobe when an approved outfit is required.
- No unsupported product claim is accepted.
- No output is published without Christian’s approval.
- Tests cover the primary production flow.

---

# 16. Required Implementation Order

Cursor must not attempt to implement everything in one uncontrolled change.

Use vertical slices.

## Phase 0 — Repository audit

Deliver:

- actual tree;
- current runtime entry points;
- current UI routes;
- current data-loading logic;
- current provider adapters;
- current persistence;
- discrepancies between documentation and code;
- exact location of Mei’s phrases;
- exact reason outfits are currently ignored.

No redesign yet.

## Phase 1 — Character Package Runtime

Implement:

- CharacterRegistry;
- CharacterPackageLoader;
- typed package;
- package validation;
- active-version resolution.

Demonstrate by loading Mei and displaying a complete diagnostic.

## Phase 2 — Library and outfits

Implement:

- asset scan;
- outfit loading;
- outfit UI;
- outfit resolver;
- reference-path resolution;
- tests.

Demonstrate all ten outfits.

## Phase 3 — Phrase registry

Implement:

- canonical phrase extraction;
- phrase schema;
- phrase resolver;
- opening/closing injection;
- missing phrase errors;
- UI display;
- tests.

Do not invent new phrase text.

## Phase 4 — Production resolution

Implement:

- typed request;
- product context;
- workflow resolution;
- outfit resolution;
- phrase resolution;
- decisions;
- preview before generation.

## Phase 5 — Prompt assembly and validation

Implement:

- ordered prompt blocks;
- provenance;
- script validation;
- identity validation contract;
- provider validation.

## Phase 6 — Provider execution

Connect the currently supported providers through adapters.

Do not hard-code business rules inside adapters.

## Phase 7 — AI Command Center OS bridge

Implement:

- API endpoints;
- authentication;
- idempotency;
- status;
- approvals;
- structured response for Léo.

## Phase 8 — Full end-to-end flow

Run RideCloud Instagram Reel scenario.

Document:

- request;
- resolved data;
- outfit;
- phrases;
- prompt sources;
- provider plan;
- validation;
- output;
- approval.

---

# 17. Cursor Working Rules

Cursor must follow these rules.

1. Read the repository before proposing architecture.
2. Do not recreate files that already exist.
3. Do not overwrite completed documentation without a proven need.
4. Documentation is the source of truth, but report contradictions.
5. Prefer extending current modules over duplicating them.
6. Keep business logic outside UI components.
7. Use TypeScript strict mode.
8. Avoid `any`.
9. Validate external and filesystem data with Zod or the existing validation library.
10. Use stable IDs, not display labels, as runtime keys.
11. Never hard-code Mei into generic services.
12. Never hard-code phrase text in UI components.
13. Never hard-code outfit paths in workflow code.
14. Never let a provider adapter define character identity.
15. One vertical slice per commit.
16. Add tests with every runtime capability.
17. Update documentation with actual implemented behavior.
18. Stop and report when exact canonical data cannot be found.
19. Do not publish anything externally without explicit approval.
20. Build a usable product, not only more documentation.

---

# 18. First Task for Cursor

Execute only this first task before coding the full solution.

## Task: Runtime Data Usage Audit

Produce:

`docs/runtime/RUNTIME_DATA_USAGE_AUDIT.md`

The audit must answer:

1. What code currently handles a production request?
2. What code loads Mei’s identity?
3. What code loads `02_PERSONALITY.md`?
4. What code loads outfits and `look.json` files?
5. What code selects an outfit?
6. What code loads Mei’s opening phrase?
7. What code loads Mei’s closing phrase?
8. What code assembles the final prompt?
9. What code calls image or video providers?
10. What code validates output identity?
11. What code persists productions?
12. What code connects to AI Command Center OS?
13. Which existing data files are currently unused?
14. Which data are duplicated?
15. Which data are contradictory?
16. Which runtime fallbacks hide missing data?
17. What is the smallest vertical slice that proves correct data usage?

The audit must include:

- exact file paths;
- function and class names;
- current data flow diagram;
- broken data flow diagram;
- proposed corrected data flow;
- no speculative claims;
- no code changes during the audit.

After the audit, propose the first implementation ticket:

`FEATURE-VH-001 — Load and Resolve Mei Character Package`

The feature is accepted only when a test or diagnostic screen proves that the runtime can load:

- Mei identity;
- personality;
- all outfits;
- all phrases;
- memories;
- capabilities;
- limitations;
- required asset references.

---

# 19. Final Expected Experience

Christian should be able to say to Léo:

> “Prépare une vidéo Instagram de 30 secondes avec Mei pour présenter RideCloud.”

Léo sends the request to Virtual Humans SDK.

The SDK responds:

- Mei loaded;
- correct version loaded;
- product memory loaded;
- professional outfit selected;
- opening phrase selected;
- closing phrase selected;
- Instagram workflow selected;
- identity references attached;
- script prepared;
- validation passed;
- preview ready;
- approval required.

Christian should not have to remind Cursor or Léo that Mei has:

- a defined personality;
- existing outfits;
- a recurring opening phrase;
- a recurring closing phrase;
- identity reference images;
- product and brand memories;
- provider and workflow rules.

That information already belongs to the character system.

The runtime must use it automatically, visibly and reliably.


---

# 20. Existing Implemented Capabilities — Preserve and Integrate

Important clarification from the project owner:

The project already contains functional or partially functional production features.

Known existing capabilities include at least:

- street-interview / micro-trottoir workflow;
- interview between Mei and another person;
- dialogue-oriented scene generation;
- lip-sync synchronization;
- video generation pipeline elements;
- character-based production logic already present in the application.

These features must be treated as existing assets.

Cursor must not:

- recreate them from scratch;
- replace them with simplified mock implementations;
- move them without a proven architectural reason;
- remove provider integrations that already work;
- break their current user interface;
- duplicate their business logic in a new module.

The first responsibility is to locate, document and connect them to the unified runtime.

## 20.1 Micro-trottoir workflow

The micro-trottoir workflow must be identified in the existing codebase.

The audit must document:

- UI route;
- API route;
- workflow entry point;
- scene configuration;
- interviewer character;
- interviewed person configuration;
- dialogue generation;
- voice generation;
- video generation;
- lip-sync stage;
- background or environment selection;
- camera and shot rules;
- generated asset storage;
- validation;
- error handling;
- provider dependencies.

The unified workflow must support:

```ts
type StreetInterviewRequest = {
  interviewerCharacterId: string;
  interviewee: {
    type: "generated-person" | "existing-character" | "user-provided";
    characterId?: string;
    description?: string;
    referenceAssetIds?: string[];
  };
  topic: string;
  productId?: string;
  language: string;
  durationSeconds: number;
  scene?: string;
  channel?: string;
  format?: string;
  dialogueMode: "question-answer" | "conversation" | "testimonial";
  publishingIntent: "draft" | "review" | "publish";
};
```

The runtime must distinguish clearly between:

- Mei’s persistent identity;
- a reusable second character;
- a one-time generated interviewee;
- a real person supplied by the user.

A temporary interviewee must never be silently added to the persistent character registry.

## 20.2 Interview workflow

The interview workflow must resolve:

- interviewer identity;
- interviewee identity or description;
- question list;
- answer structure;
- speaking order;
- shot plan;
- voice assignments;
- lip-sync assignments;
- transitions;
- subtitles;
- duration distribution;
- final call to action when applicable.

Example timeline:

```text
00:00–00:03  Mei opening phrase
00:03–00:07  Mei asks question 1
00:07–00:13  Interviewee answers
00:13–00:17  Mei asks question 2
00:17–00:24  Interviewee answers
00:24–00:28  Mei summary or product link
00:28–00:30  Mei closing phrase
```

This timeline is only an example.

The real runtime must derive timing from:

- total duration;
- speech length;
- number of speakers;
- provider constraints;
- user request;
- channel format.

## 20.3 Lip-sync capability

Lip-sync is an existing production capability and must become an explicit provider-independent stage.

Required logical contract:

```ts
interface LipSyncAdapter {
  id: string;
  capabilities(): LipSyncCapabilities;
  validate(input: LipSyncInput): Promise<ValidationReport>;
  execute(input: LipSyncInput): Promise<LipSyncResult>;
  getStatus(jobId: string): Promise<ProviderJobStatus>;
}
```

Input should include:

```ts
type LipSyncInput = {
  sourceVideoAssetId: string;
  voiceAudioAssetId: string;
  characterId?: string;
  speakerId: string;
  language: string;
  expectedDurationMs: number;
  providerOptions?: Record<string, unknown>;
};
```

Output should include:

```ts
type LipSyncResult = {
  jobId: string;
  outputVideoAssetId: string;
  durationMs: number;
  status: "completed" | "failed";
  validation: {
    audioVideoDriftMs?: number;
    mouthSyncScore?: number;
    identityDriftDetected?: boolean;
    artifacts?: string[];
  };
};
```

The existing implementation may use different names and structures.

Do not rewrite it solely to match these examples.

Map the current implementation to the required logical responsibilities.

## 20.4 Multi-speaker synchronization

For interview workflows, each speaker must have:

- a stable speaker ID;
- a voice assignment;
- a dialogue segment list;
- its own generated audio;
- its own lip-sync job when required;
- timestamps;
- shot association;
- subtitle association.

The runtime must prevent:

- Mei speaking with the interviewee’s voice;
- dialogue segments being applied to the wrong face;
- overlapping audio unless explicitly requested;
- duplicated segments;
- missing pauses;
- lip-sync on a non-speaking shot;
- loss of Mei’s identity after lip-sync.

## 20.5 Dialogue model

Suggested structure:

```ts
type DialogueSegment = {
  id: string;
  speakerId: string;
  text: string;
  startMs?: number;
  endMs?: number;
  emotion?: string;
  expressionId?: string;
  poseId?: string;
  shotId?: string;
  requiresLipSync: boolean;
};
```

The script engine must output structured dialogue before generating audio or video.

A single unstructured text block is insufficient for a two-person interview.

## 20.6 Shot plan

The interview pipeline must have an explicit shot plan.

Examples:

- establishing shot;
- Mei medium shot;
- interviewee medium shot;
- over-the-shoulder shot;
- two-shot;
- close-up reaction;
- product insert;
- closing shot.

Each shot should record:

```ts
type Shot = {
  id: string;
  type: string;
  activeSpeakerId?: string;
  visibleSpeakerIds: string[];
  durationMs: number;
  sceneId?: string;
  cameraInstruction?: string;
  dialogueSegmentIds: string[];
  assetDependencies: string[];
};
```

If the existing implementation already has an equivalent structure, preserve it.

## 20.7 Required audit additions

The Phase 0 audit must now also answer:

18. Where is the micro-trottoir feature implemented?
19. Is it a complete workflow or UI-specific orchestration?
20. How are the interviewer and interviewee represented?
21. How is dialogue split between speakers?
22. How are voices assigned?
23. Where is lip-sync executed?
24. Which provider performs lip-sync?
25. How are lip-sync jobs persisted?
26. How are final clips assembled?
27. How are errors and retries handled?
28. How is identity preserved after lip-sync?
29. Which parts of this pipeline already work end to end?
30. Which parts bypass the documented character data?
31. Can the workflow currently load Mei’s outfit and personality?
32. Can it inject Mei’s canonical opening and closing phrases?
33. Can AI Command Center OS trigger this existing workflow?
34. Which code must be reused in the unified production pipeline?

## 20.8 Revised implementation principle

The project is not a blank SDK.

It is an existing functional application with incomplete runtime unification.

The implementation strategy must therefore be:

1. inspect;
2. map;
3. preserve;
4. connect;
5. normalize;
6. validate;
7. expose to AI Command Center OS;
8. improve only where necessary.

The goal is not to rebuild existing capabilities.

The goal is to ensure that every existing capability uses the full character package correctly.

## 20.9 Additional acceptance scenario

### Scenario G — Mei micro-trottoir interview

Given:

- Mei as interviewer;
- one generated interviewee;
- a RideCloud topic;
- French language;
- vertical social format;
- lip-sync enabled;
- review intent.

Expected:

- existing micro-trottoir workflow reused;
- Mei identity loaded;
- Mei personality applied to questions and reactions;
- compatible outfit selected;
- opening phrase inserted if the workflow requires it;
- closing phrase inserted if the workflow requires it;
- interviewee treated as temporary unless explicitly saved;
- separate voices assigned;
- structured dialogue generated;
- separate speaker audio produced;
- lip-sync executed on correct speaker shots;
- identity checked after lip-sync;
- final clip assembled;
- validation report produced;
- publication blocked until Christian’s approval.

---

# 21. AUTHORITATIVE PRODUCT BOUNDARIES — FINAL ARCHITECTURE

This section is authoritative. If any earlier section conflicts with it, this section takes precedence.

## 21.1 Product map

```text
JavaChrist
├── AI Command Center OS
│   ├── Léo
│   ├── JavaChrist product management
│   ├── marketing strategy
│   ├── prompt and script creation
│   ├── Studio V2
│   ├── media ingestion
│   ├── editorial calendar
│   ├── publication scheduling
│   └── performance monitoring
│
└── Virtual Humans SDK
    ├── independent application
    ├── virtual influencer creation
    ├── persistent character management
    ├── character images and videos
    ├── interviews and micro-trottoirs
    ├── voice and lip-sync
    ├── character libraries
    └── production export API
```

AI Command Center OS and Virtual Humans SDK are separate products.

Studio V2 is an internal feature of AI Command Center OS.

Virtual Humans SDK is an independent application that can also be used by Léo through an API.

## 21.2 AI Command Center OS owns

- JavaChrist applications and product knowledge;
- marketing objectives;
- campaign strategy;
- prompts and scripts created by Léo;
- captions and hashtags;
- Studio V2;
- media ingestion;
- campaign series;
- editorial calendar;
- publication scheduling;
- social account management;
- publication tracking;
- performance analysis.

Léo belongs only to AI Command Center OS.

## 21.3 Léo owns the orchestration

Léo:

- identifies which JavaChrist application must be promoted;
- creates the marketing brief;
- creates or supervises the script;
- creates generation prompts;
- chooses the campaign format;
- sends structured production requests to Virtual Humans SDK;
- receives generated videos manually or through the API;
- associates each video with the correct product and campaign;
- schedules one video per day or a campaign series;
- prepares and manages publication;
- tracks results.

Léo is not implemented inside Virtual Humans SDK.

## 21.4 Studio V2 boundary

Studio V2 is already integrated into AI Command Center OS.

It produces application demonstration videos:

- screenshots inside a modern smartphone;
- scrollable application screens;
- automatic scrolling;
- taps and swipes;
- zooms;
- interface highlights;
- transitions;
- feature demonstrations;
- short app-presentation videos.

Do not move or duplicate Studio V2 inside Virtual Humans SDK.

## 21.5 Virtual Humans SDK owns

- influencer creation;
- persistent characters;
- character identity and versioning;
- appearance;
- personality;
- character memory;
- recurring opening and closing phrases;
- voice;
- outfits;
- poses;
- expressions;
- relationships;
- image generation;
- video generation;
- interviews;
- micro-trottoirs;
- multi-speaker dialogue;
- lip-sync;
- media validation;
- media storage;
- export;
- secure media-delivery API.

Virtual Humans SDK must remain usable:

- manually by Christian;
- independently of AI Command Center OS;
- through its own UI;
- through its own API;
- by future authorized clients.

## 21.6 Virtual Humans SDK must not own

- JavaChrist product management;
- global marketing strategy;
- campaign planning;
- editorial calendars;
- social publication scheduling;
- publication analytics;
- Studio V2;
- smartphone app mockups;
- scrollable app-demo videos;
- JavaChrist-specific business rules.

Product and campaign data received from AI Command Center OS are request context and production snapshots, not a competing source of truth.

## 21.7 Real operating flow

```text
1. AI Command Center OS identifies a promotional need.

2. Léo creates:
   - the marketing brief;
   - the script;
   - the generation prompt;
   - the target format;
   - the campaign metadata.

3. AI Command Center OS sends a structured request
   to Virtual Humans SDK.

4. Virtual Humans SDK resolves:
   - the character;
   - identity;
   - personality;
   - outfit;
   - voice;
   - poses;
   - expressions;
   - opening phrase;
   - closing phrase;
   - video workflow;
   - provider workflow;
   - lip-sync.

5. Virtual Humans SDK generates and validates the video.

6. Christian reviews and approves the result.

7. Virtual Humans SDK transfers the video to AI Command Center OS:
   - manually;
   - or automatically through the API.

8. AI Command Center OS ingests and stores the video.

9. Léo associates it with:
   - a product;
   - a campaign;
   - a channel;
   - a publication date;
   - a series when applicable.

10. AI Command Center OS schedules and manages publication.
```

Transfer and social publication are separate actions.

# 22. API-FIRST VIDEO TRANSFER

The API transfer must be planned and implemented now, not postponed.

Manual download/upload remains available as a fallback.

## 22.1 Required integration capabilities

- production request submission;
- production status tracking;
- human approval;
- secure video delivery;
- metadata delivery;
- idempotency;
- retry;
- checksum verification;
- acknowledgement from AI Command Center OS;
- manual fallback.

## 22.2 Production request contract

Suggested endpoint:

`POST /api/v1/production-requests`

Example:

```json
{
  "externalRequestId": "accos-ridecloud-2026-07-21-001",
  "requestedBy": "leo",
  "characterId": "mei",
  "characterVersion": "1.0.0",
  "mediaType": "video",
  "workflow": "product-presentation",
  "language": "fr",
  "format": {
    "aspectRatio": "9:16",
    "durationSeconds": 30,
    "resolution": "1080x1920"
  },
  "script": {
    "source": "ai-command-center-os",
    "text": "SCRIPT PROVIDED BY LÉO",
    "locked": false
  },
  "campaignContext": {
    "externalProductId": "ridecloud",
    "externalCampaignId": "ridecloud-instagram-launch",
    "objective": "Promote maintenance reminders and document storage",
    "targetAudience": "Vehicle owners"
  },
  "characterInstructions": {
    "useCanonicalOpening": true,
    "useCanonicalClosing": true,
    "outfitId": null,
    "toneOverride": null
  },
  "delivery": {
    "mode": "push",
    "targetSystem": "ai-command-center-os",
    "includePreview": true
  }
}
```

The script comes from Léo when available.

Virtual Humans SDK may adapt timing, pauses and delivery, but must not silently replace the marketing message.

Any material script modification must be returned in production metadata.

## 22.3 Status endpoint

`GET /api/v1/productions/:productionId`

Supported statuses:

```text
accepted
resolving
waiting-for-input
script-ready
generating-image
generating-audio
generating-video
lip-syncing
assembling
validating
waiting-for-approval
approved
delivering
delivered
failed
cancelled
```

## 22.4 Approval endpoint

`POST /api/v1/productions/:productionId/approve`

Store:

- approver;
- timestamp;
- production version;
- approved asset checksum;
- optional comment.

## 22.5 AI Command Center OS receiving endpoint

Suggested endpoint:

`POST /api/integrations/virtual-humans/v1/media`

Virtual Humans SDK sends:

- delivery ID;
- production ID;
- external request ID;
- external product ID;
- external campaign ID;
- video file or secure download reference;
- MIME type;
- size;
- SHA-256 checksum;
- duration;
- dimensions;
- character ID and version;
- outfit ID;
- opening phrase ID;
- closing phrase ID;
- script version;
- validation result.

Example acknowledgement:

```json
{
  "deliveryId": "vh-delivery-789",
  "status": "ingested",
  "aiCommandCenterAssetId": "media-123",
  "receivedChecksumSha256": "SHA256_VALUE",
  "receivedAt": "2026-07-21T14:00:00Z"
}
```

The video is not considered delivered until AI Command Center OS returns a persisted media asset ID.

## 22.6 Transfer strategies

Support at least one secure strategy now:

1. multipart push;
2. short-lived signed download URL;
3. shared controlled object storage.

Use an adapter:

```ts
interface MediaDeliveryAdapter {
  deliver(input: MediaDeliveryInput): Promise<MediaDeliveryResult>;
  retry(deliveryId: string): Promise<MediaDeliveryResult>;
  getStatus(deliveryId: string): Promise<MediaDeliveryStatus>;
}
```

Do not hard-code AI Command Center OS transport logic inside the production domain.

## 22.7 Delivery guarantees

Implement:

- idempotency key;
- delivery ID;
- SHA-256 checksum;
- duplicate detection;
- retry count;
- exponential backoff;
- timeout;
- persisted delivery status;
- acknowledgement;
- failure log;
- manual retry;
- manual download fallback.

## 22.8 Security

Implement from the start:

- server-to-server authentication;
- HMAC signature or signed JWT;
- timestamp;
- replay protection;
- secret rotation capability;
- no credentials in browser code;
- no provider keys in payloads;
- MIME validation;
- file-size limit;
- filename sanitization;
- checksum verification.

## 22.9 Manual and automatic modes

Manual mode:

- download the final video;
- import it into AI Command Center OS;
- optionally include a JSON metadata sidecar.

Automatic mode:

- select “Send to AI Command Center OS”;
- or enable delivery after approval;
- display delivery status;
- display the AI Command Center OS media asset ID.

Automatic transfer must never trigger automatic social publication.

# 23. REQUIRED IMPLEMENTATION ORDER

## Phase 0 — Repository audit

Identify all existing code for:

- functional UI;
- image generation;
- video generation;
- micro-trottoir;
- interview workflow;
- lip-sync;
- character loading;
- outfit loading;
- phrase loading;
- personality loading;
- persistence;
- export;
- API integration.

Do not rewrite code during the audit.

## Phase 1 — Correct character runtime

Make the current runtime use:

- identity;
- personality;
- outfits;
- phrases;
- voice;
- poses;
- expressions;
- capabilities;
- limitations;
- memory;
- approved assets.

## Phase 2 — Preserve existing workflows

Connect the existing:

- presenter videos;
- micro-trottoirs;
- interviews;
- multi-speaker dialogue;
- lip-sync;
- video assembly;

to the corrected character runtime.

Do not rebuild working capabilities.

## Phase 3 — Versioned production contract

Implement the production API contract for:

- the Virtual Humans UI;
- AI Command Center OS;
- future clients.

## Phase 4 — Media delivery foundation

Implement now:

- delivery records;
- checksums;
- delivery adapter;
- authentication;
- idempotency;
- delivery status;
- retry;
- manual fallback.

## Phase 5 — AI Command Center OS bridge

If both repositories are available, implement both sides.

If only Virtual Humans SDK is available, implement:

- Virtual Humans endpoints;
- OpenAPI specification;
- mock AI Command Center OS receiver;
- integration tests;
- exact implementation ticket for the AI Command Center OS side.

## Phase 6 — End-to-end scenario

```text
AI Command Center OS
→ Léo script and request
→ Virtual Humans SDK
→ Mei resolution
→ outfit and phrases
→ generation
→ lip-sync
→ validation
→ approval
→ API delivery
→ AI Command Center OS ingestion acknowledgement
```

# 24. FINAL ACCEPTANCE TEST

Christian asks Léo:

> “Prépare une série de vidéos pour promouvoir RideCloud.”

AI Command Center OS and Léo:

1. define the campaign;
2. create scripts and prompts;
3. select Mei;
4. submit production requests.

Virtual Humans SDK:

1. loads Mei correctly;
2. uses her personality;
3. selects or applies the correct outfit;
4. inserts approved opening and closing phrases;
5. reuses the existing video workflow;
6. performs lip-sync;
7. validates the output;
8. waits for approval;
9. sends the approved video through the API.

AI Command Center OS:

1. verifies and ingests the video;
2. associates it with RideCloud;
3. exposes it to Léo;
4. adds it to the campaign;
5. schedules one video per day or a defined series;
6. handles publication separately.

The implementation is rejected if:

- Studio V2 is moved into Virtual Humans SDK;
- Virtual Humans SDK depends on AI Command Center OS to function;
- Léo is implemented inside Virtual Humans SDK;
- Virtual Humans SDK manages the editorial calendar;
- videos can only be transferred manually;
- automatic transfer lacks authentication or checksum verification;
- existing micro-trottoir or lip-sync code is unnecessarily rebuilt;
- Mei’s existing data remains unused;
- provider defaults override the character package;
- a video is considered delivered before ingestion acknowledgement.

# 25. APPLICATION SCREENSHOTS AND PRODUCT VISUAL ASSETS

## 25.1 Ownership

Application screenshots belong to AI Command Center OS when they are part of a JavaChrist product campaign.

Léo may select and transmit them to Virtual Humans SDK with the production request.

Virtual Humans SDK must not become the permanent source of truth for JavaChrist application screenshots.

It stores them as:

- request assets;
- production assets;
- campaign-correlated media;
- temporary or cached references;
- production snapshots.

## 25.2 What Virtual Humans SDK may do with screenshots

Virtual Humans SDK may use transmitted screenshots to:

- display an application screen on a phone held by Mei or Tom;
- place a screenshot on a screen, tablet, monitor or display;
- show an application interface beside the influencer;
- use the screenshot as an insert shot;
- use the screenshot as a background visual;
- overlay the screenshot during a presentation;
- create a split-screen composition;
- support a spoken product demonstration;
- reference a specific feature during an interview or promotional video.

Virtual Humans SDK may animate these screenshots only when such animation already belongs to an existing Virtual Humans workflow.

It must not recreate Studio V2 features such as:

- full smartphone demo generation;
- long scrollable app walkthroughs;
- tap and swipe simulation systems;
- dedicated app-demo timelines;
- Studio V2 mockup rendering logic.

## 25.3 Screenshot transmission by Léo

The production request API must support screenshot assets.

Example:

```json
{
  "externalRequestId": "accos-ridecloud-2026-07-21-002",
  "characterId": "mei",
  "workflow": "product-presentation",
  "script": {
    "source": "ai-command-center-os",
    "text": "SCRIPT PROVIDED BY LÉO"
  },
  "productAssets": [
    {
      "externalAssetId": "accos-asset-ridecloud-dashboard",
      "type": "app-screenshot",
      "label": "RideCloud dashboard",
      "deliveryMode": "signed-url",
      "url": "SHORT_LIVED_SIGNED_URL",
      "mimeType": "image/png",
      "checksumSha256": "SHA256_VALUE",
      "width": 1290,
      "height": 2796,
      "usage": [
        "phone-screen",
        "insert-shot"
      ],
      "featureId": "dashboard"
    },
    {
      "externalAssetId": "accos-asset-ridecloud-maintenance",
      "type": "app-screenshot",
      "label": "Maintenance reminders",
      "deliveryMode": "signed-url",
      "url": "SHORT_LIVED_SIGNED_URL",
      "mimeType": "image/png",
      "checksumSha256": "SHA256_VALUE",
      "width": 1290,
      "height": 2796,
      "usage": [
        "phone-screen",
        "overlay"
      ],
      "featureId": "maintenance-reminders"
    }
  ]
}
```

Supported delivery modes:

- multipart upload;
- short-lived signed URL;
- existing shared asset reference;
- manual upload through the Virtual Humans UI.

## 25.4 Screenshot asset model

```ts
type ProductVisualAsset = {
  externalAssetId: string;
  externalProductId?: string;
  externalCampaignId?: string;
  type:
    | "app-screenshot"
    | "logo"
    | "product-image"
    | "ui-export"
    | "background"
    | "reference-video";
  label: string;
  mimeType: string;
  checksumSha256: string;
  width?: number;
  height?: number;
  featureId?: string;
  usage: Array<
    | "phone-screen"
    | "tablet-screen"
    | "monitor-screen"
    | "overlay"
    | "background"
    | "insert-shot"
    | "split-screen"
    | "reference"
  >;
  source: "ai-command-center-os" | "manual" | "other-client";
  sourceReference?: string;
};
```

## 25.5 Screenshot validation

Before use, Virtual Humans SDK must validate:

- file type;
- MIME type;
- checksum;
- dimensions;
- orientation;
- readability;
- crop safety;
- whether sensitive or private information is visible;
- whether the screenshot matches the requested product or feature;
- whether the requested usage is compatible with the selected workflow.

The runtime must reject or warn about:

- unreadable screenshots;
- screenshots with personal data;
- screenshots from the wrong product;
- missing checksum;
- broken signed URLs;
- unsupported aspect ratios;
- screenshots too small for the target composition.

## 25.6 Screenshot resolution by workflow

A workflow may request a screenshot by:

- exact external asset ID;
- product feature ID;
- semantic role;
- manual selection;
- automatic selection from the transmitted asset list.

Example:

```ts
type ProductAssetRequirement = {
  role: "main-screen" | "feature-screen" | "closing-screen";
  type: "app-screenshot";
  featureId?: string;
  required: boolean;
  usage: "phone-screen" | "overlay" | "insert-shot";
};
```

The runtime must record:

- which screenshot was selected;
- why it was selected;
- where it appears in the video;
- which dialogue segment refers to it;
- whether the screenshot was cropped or transformed.

## 25.7 Phone held by a virtual human

When Mei or Tom presents a phone:

- the phone screen asset must be explicitly linked to the shot;
- the screen orientation must match the phone orientation;
- the screenshot must be perspective-fitted to the display area;
- rounded corners and safe areas must be respected;
- the screenshot must not overflow the display;
- the hand must not cover critical information;
- the phone must not display an invented application interface;
- the selected screenshot must remain readable enough for the target format.

## 25.8 Production response metadata

Virtual Humans SDK must return screenshot usage metadata.

Example:

```json
{
  "usedProductAssets": [
    {
      "externalAssetId": "accos-asset-ridecloud-dashboard",
      "featureId": "dashboard",
      "usage": "phone-screen",
      "shotId": "shot-03",
      "startMs": 6200,
      "endMs": 10400,
      "transformations": [
        "perspective-fit",
        "crop-safe-area"
      ]
    }
  ]
}
```

This allows Léo to know exactly which product screenshots were used.

## 25.9 Manual use

When Virtual Humans SDK is used independently, Christian may upload screenshots manually.

The same validation and metadata rules apply.

## 25.10 Acceptance scenario

Given:

- a production request from Léo;
- Mei as presenter;
- a RideCloud script;
- two RideCloud screenshots;
- one screenshot for the dashboard;
- one screenshot for maintenance reminders.

Expected:

- screenshots are securely received;
- checksums are verified;
- screenshots are linked to the correct production;
- Mei uses the requested screenshot on the phone or as an insert;
- no fake UI is generated;
- screenshot usage is returned in metadata;
- screenshots remain campaign assets, not permanent character assets;
- Studio V2 code is not duplicated;
- the final video is delivered back to AI Command Center OS with screenshot provenance.
