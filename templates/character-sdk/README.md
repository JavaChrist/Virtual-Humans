# Character SDK Template

## Purpose

Blank, reusable skeleton for a new official character SDK. Copy this directory to create a new character under `characters/`.

## Can contain

- Template Markdown documents (identity, appearance, personality, etc.).
- A `character.manifest.json` describing the character entry.

## Must not contain

- Personal information copied from an existing character.
- Assets or generated artifacts.

## Usage

- Do not edit this template with character-specific data.
- Use `scripts/create-character-sdk.ts` to instantiate a new character SDK.
- Every instantiated character must comply with the standards in `core/`.
