# 08_PROMPTS

> Virtual Humans SDK  
> Character SDK: Tom  
> SDK Version: 1.0.0  
> Prompt Engine Version: 1.0.0  
> Status: Official Prompt Specification  
> Classification: Prompt Generation Contract

---

# 1. Purpose

This document defines the official Prompt Engine used to generate every visual, audio and video asset involving Tom.

Its purpose is to transform structured production requests into deterministic prompts while preserving the official character identity defined by the SDK.

This specification is provider-agnostic.

It does not target a specific AI model.

---

# 2. Objectives

The Prompt Engine must guarantee:

- Character consistency
- Visual consistency
- Behavioral consistency
- Brand consistency
- Camera consistency
- Production consistency
- Cross-provider compatibility
- Future extensibility

---

# 3. Scope

This document applies to:

- Images
- Videos
- Talking avatars
- Commercials
- Tutorials
- Social media
- Product demonstrations
- AI presenters
- Interactive avatars
- Future media formats

---

# 4. Non-Goals

This specification does not define:

- Character appearance
- Voice
- Camera language
- Wardrobe
- Personality
- Behavior

Those are defined by their dedicated SDK documents.

---

# 5. Prompt Philosophy

The Prompt Engine never invents Tom.

It assembles Tom.

Every prompt is built from validated SDK components.

Nothing should redefine the character.

---

# 6. Design Principles

The Prompt Engine follows six principles.

1. Deterministic
2. Modular
3. Reusable
4. Provider Independent
5. Extensible
6. Traceable

---

# 7. Deterministic Generation

The same structured request must always generate the same logical prompt.

Provider-specific syntax may differ.

Character identity may not.

---

# 8. Prompt Assembly

Prompts are never handwritten.

They are assembled.

---

# 9. Prompt Pipeline

```
User Request
        │
Scene Builder
        │
Prompt Builder
        │
Provider Adapter
        │
Generated Prompt
        │
AI Provider
```

---

# 10. Prompt Engine Responsibilities

The Prompt Engine is responsible for:

- loading SDK components
- resolving context
- selecting templates
- injecting variables
- assembling prompts
- validating prompts
- exporting provider-ready prompts

---

# 11. Source of Truth

The Prompt Engine uses only approved SDK documents.

No external prompt should override an official SDK rule.

---

# 12. Prompt Hierarchy

Priority order:

1. Character Identity
2. Appearance
3. Personality
4. Behavior
5. Camera
6. Brand
7. Scene
8. User Request
9. Provider Adaptation

---

# 13. Prompt Language

The Prompt Engine operates on structured objects.

Natural language is generated only at the final stage.

---

# 14. Prompt DSL

The official Prompt DSL is the canonical representation of every generation request.

Example:

```yaml
character: tom
camera: medium-close
scene: office
behavior: tutorial
voice: standard
language: english
platform: youtube
provider: auto
```

---

# 15. Prompt Objects

A prompt consists of multiple objects.

Objects remain independent.

Objects may be reused.

Objects are versioned.

---

# 16. Prompt Components

Official components include:

- Character
- Camera
- Wardrobe
- Behavior
- Environment
- Lighting
- Props
- Voice
- Brand
- Scene
- Goal

---

# 17. Character Object

The Character Object references the approved SDK.

It never contains duplicated character definitions.

---

# 18. Character Injection

Character data is injected automatically.

The prompt must never redefine Tom manually.

---

# 19. SDK Injection

The Prompt Builder automatically imports:

01_APPEARANCE

02_PERSONALITY

03_WARDROBE

04_VOICE

05_CAMERA

06_BRAND

07_BEHAVIOR

---

# 20. Identity Lock

Identity information cannot be overridden by scene instructions.

Character identity is immutable.

---

# 21. Context Resolution

Context determines:

- scene
- environment
- objective
- audience
- language
- platform
- media type

---

# 22. Scene Builder

The Scene Builder transforms a production request into structured data.

It never generates prompts directly.

---

# 23. Scene Object

Example:

```yaml
scene:
    location: office
    weather: sunny
    lighting: soft daylight
    activity: presenting
```

---

# 24. Goal Object

Example:

```yaml
goal:
    explain_feature
```

---

# 25. Audience Object

Example

```yaml
audience:
    beginner
```

---

# 26. Platform Object

Possible values include:

- YouTube
- Instagram
- TikTok
- Website
- Documentation
- Mobile App

---

# 27. Media Type

Supported values:

- Image
- Video
- Reel
- Story
- Avatar
- Interactive Session

---

# 28. Provider Object

Supported values:

- GPT Image
- Veo
- Runway
- Kling
- Flux
- Hailuo
- Midjourney
- Auto

---

# 29. Provider Independence

Providers interpret prompts differently.

The Prompt Engine hides those differences.

---

# 30. Provider Adapter

Each provider has an adapter.

Adapters translate.

Adapters never redefine.

---

# 31. Prompt Variables

Variables are dynamic values injected during generation.

---

# 32. Variable Syntax

Example

```text
{{character}}

{{camera}}

{{scene}}

{{goal}}
```

---

# 33. Reserved Variables

Reserved variables include:

{{appearance}}

{{behavior}}

{{voice}}

{{brand}}

{{camera}}

{{lighting}}

{{environment}}

---

# 34. Variable Resolution

Variables are resolved before provider adaptation.

---

# 35. Variable Validation

Undefined variables are errors.

---

# 36. Prompt Macros

Macros group reusable prompt blocks.

---

# 37. Example Macro

```yaml
macro:
    presenter_default
```

---

# 38. Macro Composition

Macros may contain other macros.

Recursive loops are prohibited.

---

# 39. Prompt Tokens

Tokens are atomic prompt units.

They should remain provider-neutral.

---

# 40. Token Categories

Examples:

- Style
- Camera
- Emotion
- Lighting
- Composition
- Action

---

# 41. Prompt Templates

Templates describe prompt structure.

They do not contain production data.

---

# 42. Template Types

Official templates include:

- Image
- Video
- Avatar
- Commercial
- Tutorial
- Product Demo

---

# 43. Positive Prompt Layer

Positive prompts describe what should exist.

---

# 44. Negative Prompt Layer

Negative prompts describe what must never appear.

---

# 45. Constraint Layer

Constraints override aesthetic preferences.

---

# 46. Priority Layer

Every instruction has a priority level.

Higher priorities always win.

---

# 47. Prompt Validation

Every prompt must pass validation before generation.

---

# 48. Validation Rules

Validation checks:

- variables
- macros
- hierarchy
- conflicts
- provider compatibility

---

# 49. Metadata

Every prompt carries metadata.

Metadata is never sent to the AI provider.

---

# 50. Metadata Example

```yaml
prompt_version: 1.0.0

sdk_version: 1.0.0

provider: auto

scene_id: OFFICE_001

template: tutorial

language: english
```

---

End of Part 1

---

# 51. Image Template

The Image Template defines the canonical structure used for static image generation.

It contains:

- Character
- Scene
- Camera
- Lighting
- Composition
- Style
- Quality
- Constraints
- Negative Prompt

---

# 52. Canonical Image Pipeline

```
Character
      │
Scene
      │
Camera
      │
Lighting
      │
Composition
      │
Environment
      │
Quality
      │
Constraints
      │
Negative Prompt
```

---

# 53. Image Prompt Order

The official order is:

1. Character
2. Activity
3. Environment
4. Camera
5. Lighting
6. Composition
7. Style
8. Technical Quality
9. Constraints
10. Negative Prompt

---

# 54. Character Section

The Character section is always generated automatically.

It references the SDK.

It must never be manually rewritten.

---

# 55. Environment Section

The Environment section defines:

- location
- architecture
- weather
- season
- props
- background
- atmosphere

---

# 56. Camera Section

The Camera section is imported from
05_CAMERA.md.

No camera instructions should be duplicated.

---

# 57. Lighting Section

Lighting defines:

- direction
- softness
- temperature
- intensity
- shadows
- reflections

Lighting must remain physically plausible.

---

# 58. Composition Section

Composition controls:

- framing
- rule of thirds
- negative space
- subject placement
- foreground
- background

---

# 59. Style Section

Style describes rendering intent.

Examples:

- photorealistic
- cinematic
- documentary
- premium commercial
- editorial

---

# 60. Quality Section

Quality describes technical objectives.

Examples:

- ultra detailed
- realistic skin
- natural lighting
- sharp focus
- high dynamic range

---

# 61. Constraint Section

Constraints define mandatory requirements.

Example:

- preserve identity
- preserve proportions
- preserve age
- preserve wardrobe

---

# 62. Negative Prompt Section

Negative prompts are appended last.

They never replace positive instructions.

---

# 63. Video Template

The Video Template extends the Image Template.

Additional sections include:

- motion
- acting
- speech
- timing
- transitions

---

# 64. Video Prompt Structure

```
Character
Scene
Behavior
Camera
Lighting
Motion
Speech
Timing
Quality
Constraints
Negative Prompt
```

---

# 65. Motion Layer

Motion defines:

- body movement
- gesture
- walking
- head movement
- gaze
- interaction

Motion must follow
07_BEHAVIOR.md.

---

# 66. Speech Layer

Speech references:

04_VOICE.md

The Prompt Engine never embeds voice definitions manually.

---

# 67. Timing Layer

Timing defines:

- duration
- rhythm
- pauses
- transitions
- pacing

---

# 68. Transition Layer

Transitions define continuity between shots.

Supported transitions include:

- cut
- dissolve
- fade
- whip
- match cut

---

# 69. Avatar Template

Avatar Templates are optimized for talking-head generation.

Priority becomes:

- identity
- lip sync
- gaze
- speech
- behavior

---

# 70. Avatar Idle State

The default idle state is:

- relaxed posture
- neutral warm expression
- natural blinking
- eye contact
- subtle breathing

---

# 71. Avatar Speaking State

Speaking state synchronizes:

- lips
- jaw
- expression
- gaze
- gestures

---

# 72. Avatar Listening State

Listening includes:

- eye contact
- attention
- subtle nodding
- breathing
- no speech animation

---

# 73. Commercial Template

Commercial prompts prioritize:

- product
- clarity
- credibility
- premium perception
- branding

---

# 74. Commercial Objective

The objective is never to "sell aggressively".

The objective is to build trust.

---

# 75. Tutorial Template

Tutorial prompts prioritize:

- explanation
- clarity
- pedagogy
- pacing
- comprehension

---

# 76. Tutorial Sequence

Typical sequence:

Introduction

Explanation

Demonstration

Summary

CTA

---

# 77. Product Demonstration Template

The product remains the primary visual focus.

Tom guides the audience.

He never overshadows the product.

---

# 78. Product Interaction

Interactions include:

- pointing
- holding
- demonstrating
- manipulating
- presenting

All interactions follow
07_BEHAVIOR.md.

---

# 79. Social Media Template

Social media prompts optimize for:

- first impression
- rhythm
- vertical framing
- clarity

---

# 80. Reel Template

Reels prioritize:

- hook
- pacing
- movement
- visual clarity

---

# 81. Story Template

Stories prioritize:

- intimacy
- simplicity
- vertical composition

---

# 82. YouTube Template

YouTube prioritizes:

- educational clarity
- longer pacing
- stable framing
- visual comfort

---

# 83. Website Template

Website assets prioritize:

- readability
- branding
- clean composition

---

# 84. Mobile App Template

Mobile assets prioritize:

- vertical readability
- simplicity
- contrast

---

# 85. Thumbnail Template

Thumbnail prompts emphasize:

- face readability
- eye contact
- clean background
- high contrast
- immediate recognition

---

# 86. Banner Template

Banner prompts prioritize:

- negative space
- balanced composition
- logo visibility
- subject placement

---

# 87. Portrait Template

Portrait prompts focus on:

- identity
- expression
- lighting
- realism

---

# 88. Full Body Template

Full-body prompts preserve:

- proportions
- posture
- wardrobe
- body language

---

# 89. Multi-Character Template

One SDK character always remains the primary subject.

Secondary characters never redefine Tom.

---

# 90. Interaction Template

Interaction prompts define:

- distance
- eye contact
- conversation
- gestures
- object ownership

---

# 91. Vehicle Template

Vehicle prompts specify:

- interaction
- driving
- standing
- presenting

Vehicle identity is independent of Tom.

---

# 92. Office Template

Office scenes prioritize:

- professionalism
- clean environments
- premium workspace

---

# 93. Outdoor Template

Outdoor prompts define:

- weather
- season
- terrain
- ambient lighting

---

# 94. Retail Template

Retail prompts emphasize:

- products
- customer interaction
- brand visibility

---

# 95. Event Template

Events define:

- audience
- stage
- presentation
- interaction

---

# 96. Action Template

Actions are always imported from
07_BEHAVIOR.md.

Actions are never rewritten.

---

# 97. Prompt Composition Rule

Every generated prompt must remain modular.

No duplicated SDK knowledge is permitted.

---

# 98. Prompt Reusability Rule

Every prompt block should be reusable across providers.

---

# 99. Prompt Optimization Rule

Optimization must never sacrifice character fidelity.

Identity always has priority over aesthetics.

---

# 100. End of Prompt Template Layer

The Prompt Engine now contains reusable production templates for every supported media type.

The following sections define Provider Adaptation.

---

# 101. Provider Adaptation

The Prompt Engine is provider-agnostic.

Provider adapters translate the canonical Prompt DSL into the syntax expected by each AI model without modifying Tom's identity.

---

# 102. Provider Independence

Every provider receives the same semantic request.

Only the syntax changes.

The requested scene never changes.

---

# 103. Adapter Responsibilities

A Provider Adapter must:

- translate syntax
- preserve priorities
- preserve constraints
- preserve character identity
- preserve metadata
- preserve version compatibility

---

# 104. Adapter Restrictions

A Provider Adapter must never:

- redefine Tom
- invent wardrobe
- invent personality
- replace camera language
- ignore constraints
- ignore negative prompts

---

# 105. Canonical Prompt

The canonical prompt is always generated first.

Provider-specific prompts are derived from it.

The canonical prompt is the source of truth.

---

# 106. Provider Capabilities

Each provider exposes different capabilities.

Examples include:

- image generation
- video generation
- speech animation
- image editing
- inpainting
- outpainting
- motion transfer
- avatar animation

---

# 107. Capability Detection

Before prompt generation the Prompt Engine determines:

- supported media
- supported resolution
- supported duration
- supported aspect ratios
- supported reference images
- supported negative prompts
- supported weighting syntax

---

# 108. Capability Matrix

Each adapter maintains a capability matrix.

Example:

```yaml
supports_video: true
supports_audio: false
supports_reference_images: true
supports_negative_prompt: true
supports_weighting: false
```

---

# 109. Unsupported Features

Unsupported features are gracefully degraded.

They are never silently ignored.

---

# 110. Graceful Degradation

Example:

If a provider does not support negative prompts:

- preserve constraints
- strengthen positive instructions
- record limitation in metadata

---

# 111. GPT Image Adapter

The GPT Image Adapter prioritizes:

- natural language
- structured context
- identity consistency
- realistic rendering
- instruction clarity

---

# 112. GPT Image Optimization

Preferred characteristics:

- concise
- explicit
- logically ordered
- deterministic

Avoid redundant descriptions.

---

# 113. GPT Image Restrictions

Avoid:

- contradictory instructions
- duplicate identity descriptions
- conflicting camera instructions
- repeated quality modifiers

---

# 114. Veo Adapter

The Veo Adapter prioritizes:

- motion
- continuity
- cinematic language
- timing
- scene progression

---

# 115. Veo Motion Layer

Motion instructions include:

- walking
- gestures
- gaze
- body movement
- camera movement

Motion must reference 07_BEHAVIOR.md.

---

# 116. Veo Continuity

The adapter preserves:

- shot continuity
- lighting continuity
- facial consistency
- wardrobe continuity

---

# 117. Runway Adapter

Runway emphasizes:

- animation
- image-to-video
- camera movement
- smooth transitions

---

# 118. Runway Image Reference

Reference images become primary identity anchors.

The adapter must preserve:

- face
- clothing
- proportions
- expression
- hairstyle

---

# 119. Kling Adapter

The Kling Adapter focuses on:

- realistic motion
- body dynamics
- environmental interaction
- cinematic pacing

---

# 120. Kling Motion Constraints

Movement must remain physically plausible.

Avoid exaggerated acceleration.

Avoid unrealistic inertia.

---

# 121. Flux Adapter

Flux prioritizes:

- photorealism
- composition
- lighting
- texture quality

---

# 122. Flux Identity Preservation

The adapter reinforces:

- facial identity
- skin texture
- proportions
- realism

---

# 123. Hailuo Adapter

The Hailuo Adapter prioritizes:

- expressive animation
- smooth transitions
- speech synchronization

---

# 124. Midjourney Adapter

Midjourney emphasizes:

- artistic interpretation
- composition
- lighting
- aesthetics

The adapter therefore strengthens identity constraints.

---

# 125. Future Providers

Every future provider must implement:

- capability detection
- canonical prompt translation
- metadata support
- validation compatibility

---

# 126. Prompt Translation

Translation changes syntax only.

Meaning must remain identical.

---

# 127. Prompt Compression

Some providers require shorter prompts.

Compression removes redundancy.

Compression never removes mandatory constraints.

---

# 128. Prompt Expansion

Some providers benefit from expanded prompts.

Expansion increases clarity.

Expansion never invents information.

---

# 129. Prompt Weighting

If supported, weighting follows:

Critical Identity

↓

Behavior

↓

Camera

↓

Scene

↓

Style

↓

Quality

---

# 130. Weight Translation

Weight values are provider-specific.

Semantic priority remains identical.

---

# 131. Negative Prompt Translation

If supported:

Negative prompts are translated.

If unsupported:

Constraints are merged into the positive prompt.

---

# 132. Reference Images

Reference images are always preferred over textual identity descriptions.

The adapter detects support automatically.

---

# 133. Multi-Reference Strategy

Reference priority:

1. Approved Character Reference
2. Approved Outfit Reference
3. Approved Environment Reference
4. Production Assets

---

# 134. Aspect Ratio Adaptation

Supported examples:

1:1

9:16

16:9

4:5

21:9

Adapters translate only the syntax.

---

# 135. Resolution Adaptation

The Prompt Engine requests:

- target resolution
- minimum resolution
- provider maximum

---

# 136. Duration Adaptation

Video adapters map duration into provider-specific syntax.

---

# 137. Frame Rate

Frame rate remains metadata.

Providers that support FPS receive explicit values.

---

# 138. Camera Mapping

Canonical camera definitions are translated into provider syntax.

Camera semantics never change.

---

# 139. Lighting Mapping

Lighting descriptors are preserved.

Provider keywords may differ.

---

# 140. Style Mapping

Canonical styles map to provider terminology.

Example:

"Cinematic"

may become

"film look"

depending on provider syntax.

---

# 141. Motion Mapping

Motion is translated using provider-supported vocabulary.

Behavior remains unchanged.

---

# 142. Environment Mapping

Environment descriptors remain canonical.

Only syntax changes.

---

# 143. Speech Mapping

Speech metadata is translated only for providers supporting speech.

---

# 144. Lip Sync Mapping

Lip-sync instructions are generated only when supported.

Otherwise metadata records the limitation.

---

# 145. Constraint Mapping

Mandatory constraints are always translated first.

---

# 146. Validation After Translation

Translated prompts must be validated again.

Translation may not introduce conflicts.

---

# 147. Adapter Testing

Every adapter must pass:

- identity tests
- behavior tests
- camera tests
- lighting tests
- quality tests

---

# 148. Adapter Versioning

Every adapter has its own version.

Example:

```yaml
adapter:
    provider: GPT Image
    version: 1.2.0
```

---

# 149. Compatibility Matrix

Each Prompt Engine release specifies supported adapter versions.

Incompatible adapters must be rejected.

---

# 150. End of Provider Layer

Provider adaptation completes the canonical prompt pipeline.

The remaining sections define validation, quality assurance, versioning and AI Command Center OS integration.