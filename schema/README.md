# Schema

## Purpose

Machine-readable JSON Schemas (Draft 2020-12) describing the data structures used across the Virtual Humans SDK.

## Can contain

- JSON Schema files (`*.schema.json`).
- A short index of available schemas.

## Must not contain

- Character data or examples (see `examples/`).
- Executable code (see `validators/`).

## Relationships

- Encodes the rules defined in `core/`.
- Used by `validators/` to check `characters/`, `examples/` and generated artifacts.

## Notes

Some historical schemas (`expression`, `memory`, `outfit`, `pose`, `scene`) predate this architecture and are kept for backward compatibility.
