# Characters

## Purpose

Contains the official, versioned Virtual Human SDKs. Each subdirectory is a self-contained character SDK.

## Rules

- Each subdirectory represents a versioned character SDK (for example `Mei SDK v1.0.0`).
- A character SDK must contain a single official identity.
- Major versions must be kept in separate directories.
- Rejected assets must never become references.
- Every character must comply with the standards defined in `core/`.

## Must not contain

- Shared standards or schemas (see `core/` and `schema/`).
- Generated or temporary artifacts (see `generated/`).

## Relationships

- Built from the template in `templates/character-sdk/`.
- Validated against `schema/` and `core/`.
