# Providers

## Purpose

Provider adapters that connect the SDK to external generation engines (image, video, voice) through a common interface.

## Can contain

- The common `ProviderAdapter` interface and shared provider types.
- Category subdirectories (`image/`, `video/`, `voice/`) each holding per-provider adapters.

## Must not contain

- External provider SDKs or installed packages.
- API keys or credentials.
- Network calls or real implementations at this stage.

## Rules

- Each adapter implements the common `ProviderAdapter` interface.
- Unimplemented `generate()` methods must throw `"Provider adapter not implemented."`.

## Relationships

- Consumed by `workflows/` to produce assets for `characters/`.
