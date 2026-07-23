# 09_WORKFLOWS

Virtual Humans SDK
Character SDK: Tom
SDK Version: 1.0.0
Workflow Engine Version: 1.0.0
Status: Official Workflow Specification
Classification: Production Pipeline Contract

---

# 1. Purpose

This document defines the official production workflows used by the Virtual Humans SDK.

It specifies how every request is transformed into a validated production asset while preserving character identity, technical quality and provider independence.

The workflow engine orchestrates every production stage from the initial request to the final approved asset.

---

# 2. Objectives

The Workflow Engine guarantees:

- deterministic production
- reproducible outputs
- provider independence
- quality assurance
- traceability
- scalability
- automation
- maintainability

---

# 3. Scope

This specification applies to:

- Images
- Videos
- Talking Avatars
- Commercials
- Tutorials
- Social Media
- Product Demonstrations
- Marketing Assets
- Future Production Types

---

# 4. Workflow Philosophy

The Workflow Engine never generates media directly.

It orchestrates specialized components.

Each component performs one responsibility.

No component owns the entire production process.

---

# 5. Workflow Architecture

Production follows a layered pipeline.

```
Production Request
        │
Scene Builder
        │
Prompt Builder
        │
Workflow Engine
        │
Provider Adapter
        │
AI Provider
        │
Validation
        │
Quality Assurance
        │
Publishing
```

---

# 6. Core Principles

Every workflow must be:

- deterministic
- modular
- observable
- testable
- recoverable
- provider independent

---

# 7. Source of Truth

Workflow decisions use:

1. SDK documents
2. Workflow configuration
3. Production request
4. Provider capabilities

Provider defaults never override SDK rules.

---

# 8. Workflow Hierarchy

Priority:

1. Character Identity
2. SDK Rules
3. Workflow Rules
4. Production Request
5. Provider Optimization

---

# 9. Production Request

Every workflow begins with a structured request.

Free-text requests are normalized before processing.

---

# 10. Request Normalization

The request is transformed into structured production data.

No provider receives raw user input.

```

---

# 11. Normalized Request Object

Every normalized production request is represented as a structured object.

Example:

```yaml
request:
  id: "production-request-id"
  character: "tom"
  asset_type: "video"
  production_goal: "commercial"
  platform: "instagram_reel"
  language: "en"
  duration_seconds: 15
  aspect_ratio: "9:16"
  provider_preference: "automatic"
  validation_level: "production"
```

The normalized request becomes immutable after workflow execution begins.

---

# 12. Request Identifier

Every production request receives a unique identifier.

The identifier is used for:

* execution tracking
* logs
* generated assets
* validation reports
* retry operations
* publishing history

---

# 13. Request Validation

Before processing begins, the request is checked for:

* required fields
* supported asset type
* supported platform
* valid duration
* valid language
* compatible output format
* available character SDK

Invalid requests are rejected before provider selection.

---

# 14. Request Completion

Missing non-critical values may be completed using SDK defaults.

Examples:

* default character
* default language
* default aspect ratio
* default quality level
* default validation policy

Critical information must never be invented.

---

# 15. Request Constraints

Constraints define non-negotiable production requirements.

Examples:

```yaml
constraints:
  preserve_identity: true
  wardrobe_id: "business_modern_001"
  product_visibility: "mandatory"
  background_text: false
  maximum_duration_seconds: 20
```

---

# 16. Request Preferences

Preferences influence production but do not override constraints.

Examples:

* preferred provider
* preferred camera framing
* preferred location
* preferred pacing
* preferred visual style

---

# 17. Request Priority

Each request receives a priority level.

Supported levels:

* low
* normal
* high
* critical

Priority affects scheduling only.

It does not affect quality requirements.

---

# 18. Request Classification

The Workflow Engine classifies the request according to:

* media type
* communication objective
* distribution platform
* audience
* complexity
* interaction requirements

---

# 19. Asset Type Detection

The engine detects the required asset type.

Supported primary asset types:

* image
* video
* avatar
* audio
* animation
* composite
* campaign package

---

# 20. Production Goal Detection

The production goal defines why the asset is created.

Supported goals include:

* commercial
* educational
* informational
* demonstrational
* promotional
* conversational
* entertainment
* support
* onboarding

---

# 21. Platform Detection

The target platform determines technical and editorial constraints.

Examples:

* Instagram
* TikTok
* YouTube
* LinkedIn
* Website
* Mobile Application
* Advertising Network
* Internal Presentation

---

# 22. Audience Detection

The audience profile may include:

* language
* age range
* professional level
* technical knowledge
* market
* cultural context
* accessibility requirements

Audience adaptation must preserve Tom’s identity.

---

# 23. Communication Intent

Communication intent defines the expected audience response.

Examples:

* understand
* trust
* discover
* learn
* compare
* subscribe
* purchase
* download
* contact
* remember

---

# 24. Complexity Analysis

The engine evaluates production complexity.

Complexity levels:

* simple
* standard
* advanced
* composite

Complexity depends on:

* number of scenes
* number of characters
* object interactions
* provider requirements
* synchronization requirements
* output variants

---

# 25. Workflow Resolver

The Workflow Resolver maps the normalized request to an official workflow.

Example:

```text
video + commercial + Instagram Reel
→ Social.Commercial.Reel
```

---

# 26. Workflow Resolution Rules

Workflow resolution uses:

1. asset type
2. production goal
3. platform
4. required interactions
5. provider capabilities
6. validation requirements

---

# 27. Workflow Fallback

When no exact workflow exists, the engine selects the closest compatible generic workflow.

Example:

```text
Social.ProductLaunch.Reel
not available

Fallback:
Social.Commercial.Reel
```

Fallback selection must be logged.

---

# 28. Workflow Composition

Complex productions may combine several workflows.

Example:

```text
Campaign Workflow
├── Product Image Workflow
├── Commercial Video Workflow
├── Social Reel Workflow
├── Thumbnail Workflow
└── Publishing Workflow
```

---

# 29. Scene Builder

The Scene Builder converts the normalized request into one or more structured scenes.

It does not generate provider prompts.

---

# 30. Scene Object

Each scene is represented as a structured object.

Example:

```yaml
scene:
  id: "scene-001"
  objective: "introduce_product"
  character: "tom"
  environment: "modern_showroom"
  wardrobe: "business_modern_001"
  behavior: "professional_presentation"
  camera: "medium_shot"
  duration_seconds: 5
```

---

# 31. Scene Objective

Every scene must have one primary objective.

Examples:

* introduce Tom
* present a product
* demonstrate a feature
* explain a concept
* deliver a call to action
* conclude a presentation

Scenes without a defined objective are invalid.

---

# 32. Scene Sequence

Multi-scene productions follow a logical sequence.

Typical structure:

```text
Opening
↓
Context
↓
Demonstration
↓
Benefit
↓
Call to Action
↓
Closing
```

---

# 33. Scene Dependency

A scene may depend on information or continuity from a previous scene.

Dependencies include:

* wardrobe continuity
* product position
* camera direction
* character location
* object state
* spoken context

---

# 34. Scene Duration

Scene duration is determined by:

* spoken content
* action complexity
* camera movement
* platform constraints
* audience comprehension

Duration must remain physically plausible.

---

# 35. Scene Environment

The environment is selected according to:

* production goal
* brand context
* product
* platform
* realism
* provider capabilities

---

# 36. Scene Character State

The Scene Builder defines Tom’s state at the beginning of every scene.

State includes:

* position
* orientation
* posture
* gaze
* hand state
* held objects
* emotional state
* wardrobe
* continuity references

---

# 37. Scene End State

Every scene defines its expected end state.

The end state becomes the continuity input for the next scene.

---

# 38. Scene Transition

Transitions may be:

* continuous
* cut
* dissolve
* match cut
* camera transition
* environment transition
* narrative transition

Transitions must not create unexplained continuity errors.

---

# 39. Continuity Context

The Workflow Engine maintains a continuity context across the production.

Example:

```yaml
continuity:
  wardrobe_id: "business_modern_001"
  hairstyle_state: "approved_default"
  product_hand: "right"
  screen_orientation: "toward_camera"
  lighting_direction: "camera_left"
```

---

# 40. Scene Validation

Before prompt construction, each scene is checked for:

* objective
* required character state
* environment compatibility
* wardrobe compatibility
* behavior compatibility
* camera compatibility
* physical plausibility
* continuity

---

# 41. Prompt Builder Invocation

After scene validation, the workflow invokes the Prompt Builder defined by `08_PROMPTS.md`.

The Workflow Engine sends structured scene data.

It never sends unprocessed user text directly to a provider.

---

# 42. Prompt Compilation

The Prompt Builder compiles:

* character identity
* appearance
* personality
* wardrobe
* voice
* camera
* brand
* behavior
* scene objective
* technical constraints

---

# 43. Prompt Validation Gate

Compiled prompts must pass prompt validation before provider execution.

Validation verifies:

* required SDK layers
* contradictions
* missing variables
* forbidden instructions
* provider compatibility
* output constraints

---

# 44. Provider Selection

Provider selection occurs only after prompt validation.

Selection criteria include:

* asset type
* required capabilities
* quality history
* cost
* generation time
* availability
* supported resolution
* supported duration
* reference support

---

# 45. Automatic Provider Selection

In automatic mode, the Workflow Engine ranks compatible providers.

Example scoring factors:

```yaml
provider_score:
  identity_preservation: 30
  output_quality: 25
  required_capabilities: 20
  reliability: 10
  generation_speed: 10
  cost_efficiency: 5
```

---

# 46. Manual Provider Selection

A user may request a specific provider.

The engine must still verify compatibility.

An incompatible provider request is rejected or redirected to an approved fallback.

---

# 47. Provider Capability Check

Before execution, the adapter verifies support for:

* media type
* reference images
* negative prompts
* aspect ratio
* duration
* audio
* lip synchronization
* camera controls
* seed control
* resolution

---

# 48. Provider Adapter Invocation

The provider-independent prompt is sent to the appropriate Provider Adapter.

The adapter translates it into provider-specific parameters.

---

# 49. Generation Job

Each provider execution creates a Generation Job.

A job contains:

* job ID
* request ID
* workflow ID
* scene ID
* provider
* adapter version
* prompt version
* parameters
* execution status

---

# 50. Generation Status

Supported statuses:

* queued
* preparing
* generating
* completed
* validating
* approved
* rejected
* retrying
* failed
* cancelled

---

# 51. Image Workflow

The Image Workflow generates static visual assets while preserving Tom’s approved identity.

Pipeline:

```text
Request
→ Scene
→ Prompt
→ Provider
→ Image Generation
→ Identity Validation
→ Visual QA
→ Approval
```

---

# 52. Image Workflow Inputs

Required inputs include:

* character
* scene objective
* framing
* environment
* wardrobe
* output dimensions

Optional inputs include:

* pose
* product
* reference image
* lighting
* visual style

---

# 53. Image Reference Strategy

Approved reference images are selected according to:

* required angle
* wardrobe
* framing
* hairstyle
* expression
* provider support

Unapproved references must not enter production workflows.

---

# 54. Image Variation Workflow

Variation generation creates multiple candidates from the same validated scene.

Variations may change:

* composition
* camera distance
* secondary pose
* background details
* controlled lighting

Locked identity attributes remain unchanged.

---

# 55. Image Selection

Generated candidates are ranked according to:

* identity
* anatomy
* composition
* camera compliance
* brand compliance
* scene objective
* technical quality

---

# 56. Portrait Workflow

The Portrait Workflow prioritizes:

* facial identity
* skin consistency
* hair consistency
* eye accuracy
* natural expression
* camera proximity

Identity score must equal 100%.

---

# 57. Full-Body Workflow

The Full-Body Workflow additionally validates:

* body proportions
* hands
* feet
* posture
* wardrobe geometry
* ground contact
* environmental scale

---

# 58. Product Image Workflow

Product images must preserve:

* product geometry
* logo accuracy
* packaging
* color
* text readability
* interaction plausibility

The product and Tom are validated independently.

---

# 59. Background Replacement Workflow

Background replacement must preserve:

* character edges
* hair details
* lighting coherence
* contact shadows
* perspective
* body proportions

---

# 60. Image Export Workflow

Approved images are exported with:

* final image
* source metadata
* SDK version
* prompt version
* provider information
* validation report
* usage classification

---

# 61. Video Workflow

The Video Workflow generates moving visual content.

Pipeline:

```text
Request
→ Script
→ Scenes
→ Storyboard
→ Prompts
→ Provider Jobs
→ Assembly
→ Synchronization
→ Validation
→ Approval
```

---

# 62. Video Planning

Video planning defines:

* total duration
* scene count
* narrative structure
* dialogue
* actions
* camera progression
* transitions
* sound requirements

---

# 63. Storyboard Workflow

Each video scene receives a storyboard representation.

Storyboard data includes:

* start frame
* end frame
* character state
* camera state
* action
* dialogue
* transition
* continuity data

---

# 64. Video Scene Generation

Video scenes may be generated:

* independently
* sequentially
* from reference frames
* through image-to-video
* through text-to-video
* through avatar rendering

The workflow selects the most stable method.

---

# 65. Start Frame Workflow

A validated start frame may be generated before video execution.

This improves:

* identity preservation
* wardrobe stability
* composition
* product placement
* environmental continuity

---

# 66. End Frame Workflow

An end frame may be defined when:

* continuity is critical
* a transition is planned
* the character must reach a precise position
* product placement must remain stable

---

# 67. Motion Workflow

Motion instructions are imported from `07_BEHAVIOR.md`.

The Workflow Engine must define:

* initial pose
* action
* action timing
* gesture timing
* gaze
* final pose
* recovery

---

# 68. Camera Motion Workflow

Camera movement is imported from `05_CAMERA.md`.

Supported motion may include:

* static
* pan
* tilt
* dolly
* tracking
* orbit
* controlled handheld
* zoom

Provider capabilities determine implementation.

---

# 69. Video Continuity Workflow

Continuity validation checks:

* face
* body
* wardrobe
* product
* environment
* camera direction
* lighting
* object state
* movement direction

---

# 70. Video Assembly

Approved scenes are assembled according to the production timeline.

Assembly includes:

* ordering
* trimming
* transitions
* timing
* audio placement
* subtitle placement
* graphical overlays

---

# 71. Voice Workflow

The Voice Workflow uses `04_VOICE.md` as its source of truth.

It defines:

* language
* voice identity
* pacing
* pronunciation
* emotional delivery
* pauses
* output format

---

# 72. Speech Generation

Speech is generated from an approved script.

The script must pass:

* language validation
* personality validation
* brand validation
* duration estimation
* pronunciation validation

---

# 73. Lip-Sync Workflow

Lip synchronization aligns:

* phonemes
* mouth movement
* facial motion
* head motion
* body emphasis
* audio timing

Lip-sync generation must not change Tom’s facial identity.

---

# 74. Subtitle Workflow

Subtitles are generated from the approved spoken script.

They must preserve:

* wording
* timing
* punctuation
* language
* line-length limits
* platform-safe positioning

---

# 75. Avatar Workflow

The Avatar Workflow generates pre-rendered or real-time interactive representations.

It prioritizes:

* identity stability
* low latency
* voice synchronization
* behavior consistency
* session continuity

---

# 76. Real-Time Avatar Workflow

Real-time execution follows:

```text
User Input
→ Intent Detection
→ Response Generation
→ Voice Generation
→ Behavior Planning
→ Avatar Rendering
→ Output
```

---

# 77. Commercial Workflow

The Commercial Workflow coordinates:

* marketing objective
* product benefits
* visual demonstration
* brand rules
* call to action
* platform requirements

Persuasion must remain credible.

---

# 78. Tutorial Workflow

The Tutorial Workflow prioritizes:

* instructional order
* clarity
* screen visibility
* demonstration timing
* repetition
* user comprehension

---

# 79. Social Media Workflow

The Social Media Workflow adapts content for:

* aspect ratio
* duration
* opening hook
* retention
* subtitles
* safe areas
* call to action

SDK identity rules remain unchanged.

---

# 80. Campaign Workflow

A Campaign Workflow creates a coordinated group of assets.

Campaign outputs may include:

* hero image
* commercial video
* social clips
* stories
* thumbnails
* banners
* localized variants
* publishing metadata

---

# 81. Validation Engine

The Validation Engine evaluates every generated asset before approval.

Validation is mandatory.

No production asset may bypass validation.

---

# 82. Validation Philosophy

Validation protects:

* character identity
* SDK consistency
* technical quality
* brand integrity
* physical plausibility
* production reliability

Validation is performed against explicit rules.

It must never rely only on subjective preference.

---

# 83. Validation Layers

Validation is organized into independent layers:

1. Request Validation
2. Scene Validation
3. Prompt Validation
4. Provider Validation
5. Asset Validation
6. Identity Validation
7. Technical Validation
8. Brand Validation
9. Workflow Validation
10. Final QA

---

# 84. Validation Sequence

The standard validation sequence is:

```text
Generated Asset
      │
Technical Validation
      │
Identity Validation
      │
SDK Compliance Validation
      │
Scene Objective Validation
      │
Brand Validation
      │
Final QA
      │
Approval or Rejection
```

---

# 85. Validation Result

Every validation operation returns a structured result.

Example:

```yaml
validation:
  status: "approved"
  score: 97
  blocking_errors: 0
  critical_errors: 0
  major_errors: 1
  minor_errors: 2
  validator_version: "1.0.0"
```

---

# 86. Validation Status

Supported statuses:

* pending
* running
* approved
* approved_with_warnings
* rejected
* blocked
* manual_review_required

---

# 87. Validation Severity

Validation defects are classified as:

* blocking
* critical
* major
* minor
* informational

---

# 88. Blocking Defects

Blocking defects prevent workflow continuation.

Examples:

* missing output
* corrupted file
* unsupported format
* missing character
* failed provider response
* invalid SDK version
* unreadable asset

---

# 89. Critical Defects

Critical defects invalidate the production.

Examples:

* wrong character identity
* severe facial change
* incorrect product
* forbidden brand usage
* impossible anatomy
* explicit workflow rule violation
* unsafe or prohibited content

---

# 90. Major Defects

Major defects strongly reduce production quality.

Examples:

* incorrect wardrobe
* inconsistent behavior
* poor lip synchronization
* visible hand deformation
* strong continuity break
* camera rule violation
* unreadable product information

---

# 91. Minor Defects

Minor defects do not invalidate the asset but may require correction.

Examples:

* small background inconsistency
* secondary lighting mismatch
* subtle framing issue
* minor subtitle timing offset
* non-critical visual artifact

---

# 92. Informational Findings

Informational findings are recorded for monitoring.

They do not affect approval.

Examples:

* provider-specific limitations
* non-critical compression
* acceptable scene variation
* optional optimization opportunity

---

# 93. Identity Validation

Identity Validation confirms that Tom remains visually and behaviorally recognizable.

Identity checks include:

* face
* eyes
* nose
* mouth
* jawline
* skin tone
* hair
* body proportions
* age perception
* personality expression
* behavioral presence

---

# 94. Identity Validation Priority

Identity Validation has the highest production priority.

A visually attractive asset with incorrect identity must be rejected.

---

# 95. Facial Identity Validation

Facial validation compares the generated face with approved character references.

The following must remain stable:

* facial proportions
* eye shape
* eyebrow structure
* nose shape
* lip shape
* face contour
* skin characteristics

---

# 96. Body Identity Validation

Body validation confirms:

* approved proportions
* height perception
* shoulder width
* limb proportions
* posture
* silhouette consistency

---

# 97. Hair Validation

Hair validation checks:

* color
* cut
* length
* volume
* texture
* hairline
* approved styling

Provider artifacts must not redefine Tom’s hairstyle.

---

# 98. Age Validation

Tom must remain within the approved perceived age range.

The following are prohibited:

* unintended aging
* unintended rejuvenation
* childlike appearance
* inconsistent age between scenes

---

# 99. Personality Validation

Personality Validation confirms alignment with `02_PERSONALITY.md`.

The asset must communicate the expected:

* confidence
* calmness
* professionalism
* warmth
* credibility
* emotional restraint

---

# 100. Wardrobe Validation

Wardrobe Validation uses `03_WARDROBE.md`.

Checks include:

* approved outfit
* color compliance
* garment geometry
* fit
* occasion compatibility
* brand compatibility
* continuity
* physical plausibility

---

# 101. Voice Validation

Voice Validation uses `04_VOICE.md`.

Checks include:

* voice identity
* language
* pronunciation
* pacing
* emotional delivery
* clarity
* natural pauses
* audio quality

---

# 102. Camera Validation

Camera Validation uses `05_CAMERA.md`.

Checks include:

* framing
* angle
* perspective
* camera height
* lens behavior
* movement
* safe areas
* subject visibility
* product visibility

---

# 103. Brand Validation

Brand Validation uses `06_BRAND.md`.

Checks include:

* visual identity
* tone
* logo usage
* color usage
* product representation
* message consistency
* platform consistency
* prohibited associations

---

# 104. Behavior Validation

Behavior Validation uses `07_BEHAVIOR.md`.

Checks include:

* posture
* gaze
* gestures
* timing
* object interaction
* physical plausibility
* emotional coherence
* action continuity

---

# 105. Prompt Validation

Prompt Validation uses `08_PROMPTS.md`.

Checks include:

* required layers
* correct variables
* complete context
* absence of contradictions
* provider compatibility
* negative instructions
* output constraints
* locked rules

---

# 106. Workflow Validation

Workflow Validation confirms that the official execution sequence was respected.

Checks include:

* selected workflow
* required stages
* validation gates
* provider adapter usage
* retry policy
* metadata generation
* approval policy

---

# 107. Technical Image Validation

Image validation checks:

* dimensions
* aspect ratio
* resolution
* file format
* compression
* transparency
* color profile
* corruption
* unwanted borders

---

# 108. Technical Video Validation

Video validation checks:

* duration
* resolution
* aspect ratio
* frame rate
* codec
* bitrate
* audio track
* synchronization
* frame corruption
* export compatibility

---

# 109. Audio Validation

Audio validation checks:

* sample rate
* channels
* loudness
* clipping
* noise
* silence
* distortion
* synchronization
* format compatibility

---

# 110. Subtitle Validation

Subtitle validation checks:

* script accuracy
* language
* timing
* reading speed
* line length
* punctuation
* safe placement
* platform compatibility

---

# 111. Anatomy Validation

Anatomy Validation checks:

* hands
* fingers
* arms
* legs
* feet
* joints
* body proportions
* body-object contact
* body-environment contact

---

# 112. Object Validation

Object Validation checks:

* geometry
* scale
* orientation
* grip
* interaction
* continuity
* branding
* physical plausibility

---

# 113. Product Validation

Product Validation is mandatory for commercial productions.

Checks include:

* product identity
* model
* shape
* proportions
* logo
* color
* interface
* packaging
* text
* visibility

---

# 114. Environment Validation

Environment Validation checks:

* perspective
* scale
* lighting
* shadows
* geometry
* scene relevance
* environmental continuity
* object placement
* brand suitability

---

# 115. Lighting Validation

Lighting Validation checks:

* subject visibility
* skin rendering
* shadow direction
* environment consistency
* product readability
* continuity
* absence of unwanted color cast

---

# 116. Continuity Validation

Continuity Validation compares consecutive scenes.

Checks include:

* identity
* wardrobe
* hairstyle
* accessories
* product state
* object position
* camera direction
* lighting
* movement direction
* environment

---

# 117. Scene Objective Validation

Every asset must fulfill its declared scene objective.

Examples:

* the product is introduced
* the feature is demonstrated
* the message is understandable
* the call to action is visible
* the expected emotion is communicated

---

# 118. Platform Validation

Platform Validation verifies:

* aspect ratio
* duration
* safe zones
* subtitle position
* thumbnail requirements
* file limits
* content constraints
* publishing metadata

---

# 119. Accessibility Validation

Accessibility checks include:

* subtitle availability
* transcript availability
* readable pacing
* sufficient contrast
* alternative text
* understandable narration

---

# 120. Final Quality Assurance

Final QA combines automated validation and optional human review.

The final result must include:

* global score
* identity score
* technical score
* SDK compliance score
* workflow score
* list of defects
* approval decision

---

# 121. Quality Scoring

Every production receives a quality score from 0 to 100.

Example weighting:

```yaml
quality_score:
  identity: 30
  technical_quality: 15
  sdk_compliance: 15
  behavior: 10
  camera: 10
  brand: 10
  scene_objective: 5
  platform_compliance: 5
```

---

# 122. Approval Threshold

Default production approval threshold:

```text
Global Score ≥ 95
Identity Score = 100
Blocking Defects = 0
Critical Defects = 0
```

Workflow-specific thresholds may be stricter.

---

# 123. Conditional Approval

Conditional approval may be used only when:

* no blocking defect exists
* no critical defect exists
* identity is fully preserved
* remaining defects are minor
* the asset is not final publication material

Conditional approval must be logged.

---

# 124. Manual Review

Manual review is required when:

* automated validation confidence is low
* identity comparison is ambiguous
* brand usage is sensitive
* legal review is required
* the product contains important text
* the workflow explicitly requires human approval

---

# 125. Human Approval Gate

The Human Approval Gate may:

* approve
* reject
* request correction
* select a candidate
* authorize publication
* escalate the asset

---

# 126. Rejection Workflow

Rejected assets enter a structured rejection workflow.

The rejection report includes:

* failed validation rules
* severity
* affected scene
* affected SDK document
* recommended correction
* retry eligibility

---

# 127. Retry Eligibility

A rejected production is eligible for automatic retry when the defect can reasonably be corrected through:

* prompt modification
* parameter modification
* seed modification
* reference adjustment
* provider change
* workflow fallback

---

# 128. Retry Strategy

Retry follows this order:

1. Correct prompt parameters
2. Regenerate with the same provider
3. Modify controlled generation settings
4. Use an alternative adapter configuration
5. Use an alternative provider
6. Request manual review

---

# 129. Retry Limit

Each workflow defines a maximum retry count.

Example:

```yaml
retry_policy:
  maximum_attempts: 3
  same_provider_attempts: 2
  provider_fallback: true
  manual_review_after_failure: true
```

Unlimited retries are prohibited.

---

# 130. Retry Context

Every retry receives the previous validation report.

The engine must correct identified defects instead of repeating the original request unchanged.

---

# 131. Provider Fallback

Provider fallback is used when:

* the provider is unavailable
* the provider fails repeatedly
* required capabilities are missing
* quality remains below threshold
* the provider introduces recurring identity defects

---

# 132. Workflow Fallback

Workflow fallback is used when the original workflow cannot complete reliably.

The fallback must preserve the production objective.

Example:

```text
Text-to-Video Workflow
        ↓ failure
Image-to-Video Workflow
        ↓ failure
Avatar Composite Workflow
```

---

# 133. Partial Recovery

Multi-scene productions may regenerate only failed scenes.

Approved scenes should not be regenerated without reason.

---

# 134. Asset Candidate Pool

Generation workflows may produce several candidates.

The candidate pool stores:

* candidate ID
* provider
* seed
* prompt
* scores
* defects
* approval status
* selection status

---

# 135. Candidate Ranking

Candidates are ranked by:

1. identity
2. critical defect count
3. global quality score
4. scene objective
5. brand compliance
6. technical quality
7. cost and execution time

---

# 136. Candidate Selection

Candidate selection may be:

* automatic
* human-assisted
* fully manual

Automatic selection is allowed only when validation confidence is sufficient.

---

# 137. Workflow Queue

The Workflow Queue manages pending production jobs.

Queue data includes:

* job ID
* request ID
* workflow
* priority
* creation time
* dependencies
* resource requirements
* status

---

# 138. Queue Priority

Queue order is influenced by:

* request priority
* deadline
* dependency
* workflow type
* provider availability
* business importance

Priority must not bypass validation.

---

# 139. Dependency Management

A job may depend on:

* approved script
* approved image
* approved voice
* approved start frame
* completed scene
* human validation
* legal approval

Dependent jobs must not start prematurely.

---

# 140. Parallel Execution

Independent tasks may run in parallel.

Examples:

* several image variants
* localized voice tracks
* platform exports
* independent scenes
* thumbnails
* metadata generation

Parallel execution must preserve traceability.

---

# 141. Sequential Execution

Sequential execution is required when:

* continuity depends on a previous scene
* an approved frame becomes the next reference
* lip-sync requires final audio
* publishing requires final validation
* packaging requires all assets

---

# 142. Workflow State Machine

Every workflow is represented by a state machine.

Example:

```text
Created
→ Normalized
→ Planned
→ Generating
→ Validating
→ Approved
→ Packaged
→ Published
```

Failure states include:

```text
Rejected
Retrying
Blocked
Cancelled
Failed
```

---

# 143. State Persistence

Workflow state must be persisted after every important transition.

A system restart must not erase production progress.

---

# 144. Idempotency

Workflow operations should be idempotent whenever possible.

Repeating an operation must not create duplicate assets or duplicate publications.

---

# 145. Cancellation

A workflow may be cancelled before final publication.

Cancellation must:

* stop pending jobs
* preserve completed logs
* preserve approved intermediate assets
* release resources
* record the cancellation reason

---

# 146. Timeout Management

Every provider job and workflow stage defines a timeout.

Timeouts prevent blocked executions.

Timeout events trigger:

* retry
* provider fallback
* workflow fallback
* manual review

---

# 147. Rate Limit Management

The engine manages provider rate limits through:

* queueing
* throttling
* retry delays
* provider distribution
* batch scheduling

---

# 148. Cost Management

Workflow execution records estimated and actual cost.

Cost data may include:

* provider generation cost
* retry cost
* storage cost
* processing cost
* publishing cost

Cost optimization must never override identity requirements.

---

# 149. Budget Constraints

A request may define a maximum budget.

When the budget cannot support the required quality level, the workflow must:

* stop
* request approval
* propose a compatible alternative

It must not silently reduce mandatory quality.

---

# 150. Caching

The Workflow Engine may cache:

* SDK documents
* provider capabilities
* validated prompts
* approved reference assets
* generated metadata
* reusable intermediate assets

---

# 151. Cache Invalidation

Cache is invalidated when:

* SDK version changes
* workflow version changes
* prompt version changes
* provider adapter changes
* reference assets change
* validation rules change

---

# 152. Asset Storage

Generated assets are stored according to lifecycle status.

Storage categories:

* temporary
* candidate
* rejected
* approved
* published
* archived

---

# 153. File Naming

Asset filenames follow a deterministic convention.

Example:

```text
tom_video_commercial_scene-001_v1_2026-07-20.mp4
```

File naming should include:

* character
* asset type
* workflow or purpose
* scene or variant
* version
* date

---

# 154. Metadata Storage

Each asset stores associated metadata.

Required metadata includes:

* production ID
* request ID
* character ID
* workflow ID
* SDK version
* prompt version
* provider
* adapter version
* validation score
* creation date
* approval status

---

# 155. Versioning

The Workflow Engine versions:

* workflow definitions
* prompts
* scenes
* scripts
* provider adapters
* validation rules
* generated assets

---

# 156. Asset Revision

Corrections create a new asset revision.

Previous revisions remain traceable.

Example:

```text
asset-v1 → rejected
asset-v2 → approved
asset-v3 → published
```

---

# 157. Rollback

Rollback restores a previous approved version.

Rollback may apply to:

* workflow configuration
* prompt template
* provider adapter
* generated asset
* publishing package

---

# 158. Audit Log

The audit log records:

* user action
* agent action
* workflow transition
* provider execution
* validation result
* retry
* approval
* rejection
* publication
* rollback

---

# 159. Observability

Workflow observability includes:

* logs
* metrics
* traces
* execution status
* provider health
* validation trends
* cost trends
* failure trends

---

# 160. End of Automation and Infrastructure Layer

The following sections define AI Command Center OS integration, workflow discovery, agent orchestration, final compliance rules and the official workflow contract.

---

# 161. AI Command Center OS Integration

The Workflow Engine is fully integrated with AI Command Center OS.

AI Command Center orchestrates:

- workflow selection
- provider selection
- asset generation
- validation
- publishing
- monitoring

The SDK remains the single source of truth.

---

# 162. Workflow Registry

Each workflow is uniquely identified.

Example:

Image.Standard

Video.Commercial

Video.Tutorial

Avatar.Live

Social.Reel

Social.Story

Campaign.Batch

---

# 163. Workflow Discovery

Available workflows are discovered automatically from the SDK manifest.

No workflow is hardcoded.

---

# 164. Workflow Selection

Workflow selection depends on:

- asset type
- platform
- production goal
- provider capabilities
- user preferences

---

# 165. Workflow Configuration

Every workflow is configurable through structured metadata.

Configuration never modifies SDK rules.

---

# 166. Execution Context

Each execution receives a context object containing:

- Character
- Scene
- Prompt
- Provider
- Platform
- Output
- Metadata
- Constraints

---

# 167. Agent Orchestration

Multiple AI agents may cooperate.

Typical execution:

Scene Builder

↓

Prompt Builder

↓

Workflow Engine

↓

Provider Adapter

↓

Validation Engine

↓

QA Engine

↓

Publishing Engine

---

# 168. Marketing Workflow

Marketing workflows prioritize:

- brand consistency
- conversion
- visual impact
- identity preservation

---

# 169. Educational Workflow

Educational workflows prioritize:

- clarity
- pacing
- demonstration
- accessibility

---

# 170. Commercial Workflow

Commercial production focuses on:

- professionalism
- trust
- product visibility
- persuasive communication

---

# 171. Social Workflow

Social workflows optimize:

- vertical framing
- attention retention
- platform constraints
- engagement

---

# 172. Batch Workflow

Batch generation supports:

- campaigns
- localization
- multiple aspect ratios
- A/B testing
- provider comparison

---

# 173. Publishing Workflow

Publishing includes:

- metadata generation
- thumbnail selection
- asset packaging
- export
- platform delivery

---

# 174. Localization Workflow

Localization changes:

- language
- subtitles
- captions
- voice

Character identity remains unchanged.

---

# 175. Accessibility Workflow

Accessibility supports:

- subtitles
- transcripts
- alternative text
- readable pacing

---

# 176. Monitoring

Every workflow execution is monitored.

Collected metrics include:

- duration
- provider
- quality score
- retry count
- validation score

---

# 177. Analytics

Analytics measure:

- production efficiency
- provider performance
- failure rates
- approval rates

---

# 178. Logging

Workflow logs include:

- timestamps
- workflow ID
- provider
- version
- validation results

---

# 179. Version Compatibility

Each workflow declares:

SDK Version

Workflow Version

Provider Compatibility

---

# 180. Future Compatibility

Unknown providers are supported through the Provider Adapter interface.

The Workflow Engine remains provider-agnostic.

---

# 181. Locked Rules

The following elements are immutable:

- Character Identity
- Appearance
- Personality
- Brand
- Behavior Principles
- Camera Principles
- Voice Principles
- SDK Hierarchy

No workflow may override these rules.

---

# 182. Controlled Rules

The following elements may adapt within defined limits:

- gestures
- pacing
- framing
- transitions
- editing
- duration
- language
- provider optimization

---

# 183. Contextual Rules

The following depend on production context:

- camera movement
- background
- lighting
- wardrobe selection
- product
- environment
- audience

---

# 184. Error Handling

Failures trigger structured recovery.

Typical sequence:

Retry

↓

Alternative Provider

↓

Fallback Workflow

↓

Manual Review

---

# 185. Recovery Strategy

Recovery always preserves:

- character identity
- SDK compliance
- production quality

---

# 186. Validation Contract

An asset is considered valid only if:

Appearance ✓

Personality ✓

Behavior ✓

Camera ✓

Brand ✓

Workflow ✓

Prompt ✓

Provider ✓

---

# 187. Acceptance Criteria

Production is accepted only when:

Validation Score ≥ 95%

Identity Score = 100%

Blocking Errors = 0

Critical Errors = 0

---

# 188. Rejection Criteria

Reject production when:

identity changes

provider artifacts dominate

camera rules are violated

behavior becomes inconsistent

brand guidelines are broken

---

# 189. Asset Approval

Approved assets receive:

Production ID

SDK Version

Workflow Version

Provider Metadata

Generation Timestamp

---

# 190. Asset Packaging

Every approved asset includes:

media

metadata

workflow information

provider information

validation report

SDK version

---

# 191. Traceability

Every generated asset can be traced back to:

workflow

provider

SDK version

prompt version

scene version

---

# 192. Reproducibility

Executing the same workflow with identical inputs should produce equivalent results within provider variability.

---

# 193. Workflow Stability

Workflow definitions are deterministic.

Behavior must remain stable across SDK updates unless intentionally versioned.

---

# 194. Workflow Evolution

New workflows extend the SDK.

Existing workflows remain backward compatible whenever possible.

---

# 195. Provider Independence

No workflow depends on proprietary provider syntax.

Provider-specific instructions exist only inside adapters.

---

# 196. SDK Compliance

Every workflow must comply with:

01_APPEARANCE

02_PERSONALITY

03_WARDROBE

04_VOICE

05_CAMERA

06_BRAND

07_BEHAVIOR

08_PROMPTS

09_WORKFLOWS

---

# 197. Final Workflow Contract

This document is the official production workflow specification of the Tom Character SDK.

All implementations shall conform to this contract.

---

# 198. Version

Workflow Engine Version:

1.0.0

---

# 199. Status

Approved

Production Ready

---

# 200. End of Document

End of 09_WORKFLOWS.md

End of Tom SDK v1.0.0