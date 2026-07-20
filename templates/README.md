# Templates

## Purpose

Reusable templates used to bootstrap new artifacts, primarily new character SDKs.

## Can contain

- The `character-sdk/` template (a blank, reusable character SDK skeleton).
- Other reusable structural templates.

## Must not contain

- Real character data (no personal information from existing characters).
- Generated artifacts.

## Relationships

- Consumed by `scripts/create-character-sdk.ts` to create new entries under `characters/`.
- Must comply with the standards in `core/` and the structures in `schema/`.
