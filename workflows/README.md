# Workflows

## Purpose

Declarative generation and publication workflows. Each workflow describes the ordered steps, inputs, outputs and validation gates for a repeatable process.

## Can contain

- One subdirectory per workflow, each with a `workflow.json`, a `README.md` and a `checklist.md`.

## Must not contain

- Provider credentials or network calls.
- Generated artifacts (see `generated/`).

## Relationships

- Use `providers/` to produce assets.
- Enforce `core/` standards and `schema/` structures.
- Are checked by `validators/`.
