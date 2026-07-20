# Scripts

## Purpose

Repository utilities for validation, character SDK creation and index generation.

## Can contain

- TypeScript utility scripts (skeletons for now).

## Must not contain

- Destructive operations by default.
- Credentials or secrets.

## Rules

- Scripts must never overwrite or delete existing files by default.
- Full implementations may remain marked as `TODO`, but their contracts must be documented.

## Relationships

- Operate on `templates/`, `characters/`, `schema/` and `generated/`.
