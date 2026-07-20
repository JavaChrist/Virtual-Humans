# Core

## Purpose

Holds the global, character-agnostic standards of the Virtual Humans SDK. These standards are the source of truth every character SDK, provider and workflow must comply with.

## Can contain

- Cross-cutting standard documents (character, legal, photo, prompt, quality, social, video).

## Must not contain

- Character-specific data or assets.
- Provider implementations or credentials.
- Generated artifacts.

## Relationships

- `schema/` encodes machine-readable rules derived from these standards.
- `characters/` must comply with every standard defined here.
- `validators/` and `workflows/` enforce these standards.
