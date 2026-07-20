# Voice Providers

## Purpose

Adapters for voice generation engines.

## Can contain

- One subdirectory per provider (for example `elevenlabs/`), plus a `generic/` fallback adapter.

## Must not contain

- API keys, credentials or network calls.

## Relationships

- Implements the common interface in `providers/provider.interface.ts`.
