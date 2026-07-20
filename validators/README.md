# Validators

## Purpose

Standalone TypeScript project providing automated validation tools for the Virtual Humans SDK.

## Can contain

- Typed validation functions (`src/`).
- Test fixtures (`tests/`).

## Must not contain

- Provider credentials or network calls.
- Generated artifacts.

## Notes

- These validators are skeletons: they are typed and compilable but do not yet implement real validation logic.
- Do not run `npm install` automatically.

## Scripts

- `build`: type-check the project (`tsc --noEmit`).
- `validate`: run `src/index.ts` (`tsx`).
- `test`: run tests (`tsx --test`).

## Relationships

- Validates data structures defined in `schema/`.
- Enforces the standards defined in `core/`.
