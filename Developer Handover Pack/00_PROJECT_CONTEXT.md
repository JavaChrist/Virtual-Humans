# 00_PROJECT_CONTEXT.md

> Virtual Humans SDK
>
> Official Project Context
>
> Version 1.0
>
> Status: Living Document

---

# 1. Purpose

This document is the official entry point of the Virtual Humans SDK.

Every developer, AI assistant, contributor or automation system should read this document before interacting with the project.

It defines the project's vision, architecture, development philosophy and current state.

This document is considered the primary source of truth for understanding the SDK.

---

# 2. Project Vision

Virtual Humans SDK is a modular framework designed to build persistent AI-driven digital humans.

Unlike a simple avatar system, every virtual human combines multiple independent systems that work together:

- Identity
- Memory
- Personality
- Behaviors
- Prompts
- Visual Assets
- Templates
- Workflow
- Video Production

The objective is to make every character reusable across multiple applications while preserving its identity, personality and long-term memory.

---

# 3. Project Philosophy

The SDK follows several core principles.

## Modular

Every component should remain independent.

Nothing should be hardcoded.

Every module can evolve independently.

---

## Reusable

A character created once should be usable across:

- Mobile Apps
- Websites
- Videos
- Marketing
- Social Media
- Customer Support
- Documentation
- Tutorials
- AI Assistants

---

## Scalable

The architecture must support:

- one character
- ten characters
- hundreds of characters

without architectural changes.

---

## AI First

The SDK is designed around AI workflows.

Humans configure.

AI produces.

---

## Data Driven

Behavior comes from data.

Not from code.

The SDK loads data and generates behavior dynamically.

---

# 4. Project Goals

The SDK aims to provide a complete ecosystem for creating professional AI presenters.

Each character should be capable of:

- speaking
- presenting products
- creating videos
- writing documentation
- answering users
- generating marketing content
- remembering context
- maintaining a consistent personality

---

# 5. Non Goals

The SDK is not intended to become:

- a game engine
- a 3D engine
- an animation software
- a video editor
- a speech synthesis engine

Instead, it orchestrates specialized external AI services.

---

# 6. SDK Overview

The SDK is organized around several independent systems.

```
Virtual Humans SDK

├── Core
├── Schema
├── Characters
├── Assets
├── Memory
├── Prompts
├── Behaviors
├── Templates
├── Videos
└── Documentation
```

Each system has a single responsibility.

---

# 7. Core Architecture

The SDK follows a layered architecture.

```
Developer

↓

Character

↓

Memory

↓

Behavior

↓

Prompt

↓

Template

↓

Generation

↓

Output
```

Every request passes through these layers before producing content.

---

# 8. Main Engines

## Identity Engine

Responsible for defining who the character is.

Contains:

- biography
- role
- personality
- communication style
- objectives

Identity never changes during execution.

---

## Memory Engine

Responsible for persistent knowledge.

Stores:

- products
- projects
- marketing
- language
- social media
- relationships
- videos
- runtime memory

Memory provides long-term consistency.

---

## Prompt Engine

Responsible for prompt composition.

Instead of using one large prompt, the SDK dynamically assembles prompts from multiple modules.

Examples:

System Prompt

+

Behavior Prompt

+

Context Prompt

+

Task Prompt

+

Output Rules

↓

Final Prompt

---

## Behavior Engine

Responsible for selecting behaviors dynamically.

A request may activate multiple behaviors simultaneously.

Example:

Professional

+

Marketing

+

Presentation

↓

Final Behavior

Behavior modules remain independent.

---

## Template Engine

Responsible for structured output generation.

Templates define production standards for:

- documentation
- marketing
- social media
- videos
- images
- tutorials
- sales
- prompts

Templates never contain business logic.

---

## Asset Engine

Responsible for visual consistency.

Includes:

- portraits
- outfits
- poses
- expressions
- branding
- identity assets
- videos

Every visual asset belongs to a character.

---

# 9. Character Architecture

Every character follows exactly the same architecture.

Example:

```
Character

Identity

Memory

Assets

Behaviors

Prompts

Templates

Videos
```

No character requires custom architecture.

Only data changes.

---

# 10. Mei

Mei is the reference implementation.

Every architectural decision has been validated using Mei.

Future characters such as:

- Tom
- Emma
- Lucas

must reuse the exact same architecture.

---

# 11. Development Workflow

Every production follows the same pipeline.

```
Request

↓

Identity

↓

Memory

↓

Behavior

↓

Prompt Assembly

↓

Template Selection

↓

AI Generation

↓

Validation

↓

Final Output
```

This workflow is considered stable.

---

# 12. Repository Philosophy

The repository is the project's official source of truth.

Documentation defines architecture.

Code implements documentation.

Never the opposite.

---

# 13. Documentation Philosophy

Documentation is part of the product.

It is not an afterthought.

Every important architectural decision must be documented.

Future AI systems should understand the project by reading documentation alone.

---

# 14. Frozen Architectural Decisions

The following decisions are considered final.

- Global architecture
- Folder organization
- Memory system
- Prompt architecture
- Character model
- SDK philosophy
- Mei reference implementation

These elements must not be redesigned without explicit validation.

---

# 15. Current Project Status

Current maturity:

Architecture
✅ Complete

Memory System
✅ Complete

Prompt Architecture
✅ Complete

Assets Structure
✅ Complete

Template Structure
✅ Complete

Behavior Concept
✅ Validated

Documentation
🟡 In Progress

Behavior Modules
🔲 Planned

Production Templates
🔲 Planned

Video Pipeline
🔲 Planned

Automation
🔲 Planned

---

# 16. Remaining Work

The project now focuses primarily on documentation.

The current objective is to produce a complete Developer Handover Pack.

After documentation is completed, development will continue with:

- Behavior Modules
- Production Templates
- Video Workflows
- Automation
- SDK Tooling

---

# 17. Long-Term Roadmap

Future versions may include:

- Character Marketplace
- SDK CLI
- Visual Builder
- AI Workflow Designer
- Plugin System
- API
- Cloud Synchronization
- Team Collaboration
- Versioned Characters

These features will extend the SDK without changing its architecture.

---

# 18. Development Principles

Every contribution should respect the following principles.

- Simplicity over complexity.
- Reusability over duplication.
- Documentation before implementation.
- Data over hardcoded logic.
- Modular architecture.
- AI-first design.
- Stable public architecture.
- Backward compatibility whenever possible.

---

# 19. Repository Rule

Git is the official source of truth.

Documentation reflects the repository.

Conversations never redefine the architecture.

If a conflict exists between a conversation and the repository, the repository always wins.

---

# 20. Conclusion

Virtual Humans SDK is no longer in the architectural exploration phase.

Its architecture is considered stable.

The project now enters its documentation and production phase.

The objective is to create a professional SDK that any developer or AI assistant can understand, maintain and extend without requiring access to previous conversations.

This document serves as the official starting point for every future development session.