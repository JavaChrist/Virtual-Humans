/**
 * create-character-sdk.ts
 *
 * Contract (not implemented yet):
 * - Accept a `character-id` argument.
 * - Accept a `character-name` argument.
 * - Copy the template from `templates/character-sdk/` into a new directory
 *   under `characters/`.
 * - Refuse to run if the destination already exists.
 * - Never delete any file.
 * - Never overwrite any file.
 *
 * The full implementation is intentionally left as a TODO.
 */

export interface CreateCharacterSdkOptions {
  characterId: string;
  characterName: string;
}

export function createCharacterSdk(_options: CreateCharacterSdkOptions): void {
  // TODO: implement safe, non-destructive character SDK creation.
  throw new Error("create-character-sdk is not implemented yet.");
}
