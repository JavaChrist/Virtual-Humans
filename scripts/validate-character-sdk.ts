/**
 * validate-character-sdk.ts
 *
 * Contract (not implemented yet):
 * - Accept the path to a Character SDK directory.
 * - Check the presence of the expected documents and manifest.
 * - Validate the manifest and referenced files against `schema/`.
 * - Report issues without modifying any file.
 *
 * The full implementation is intentionally left as a TODO.
 */

export interface CharacterSdkValidation {
  sdkPath: string;
  ok: boolean;
  details: string;
}

export function validateCharacterSdk(sdkPath: string): CharacterSdkValidation {
  // TODO: implement character SDK validation.
  return {
    sdkPath,
    ok: false,
    details: "Character SDK validation is not implemented yet.",
  };
}
