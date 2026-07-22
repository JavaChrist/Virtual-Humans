/**
 * Runtime error hierarchy for the Virtual Humans character runtime.
 *
 * These errors are intentionally explicit so that missing or malformed
 * character data surfaces as a visible failure instead of a silent fallback,
 * per the SDK working rules.
 */

export type RuntimeErrorCode =
  | "CHARACTER_NOT_FOUND"
  | "CHARACTER_PACKAGE_INVALID"
  | "CHARACTER_DOCUMENT_MISSING"
  | "IDENTITY_ASSET_MISSING"
  | "PERSONALITY_PARSE_ERROR"
  | "DUPLICATE_CHARACTER_ID"
  | "DUPLICATE_CHARACTER_CODE";

/** Identifying details of a package involved in a registry uniqueness conflict. */
export interface ConflictingPackageRef {
  directoryName: string;
  version: string | null;
  characterId: string;
  characterCode: string | null;
}

/** Base class for every character runtime error. */
export class CharacterRuntimeError extends Error {
  readonly code: RuntimeErrorCode;
  /** Machine-readable details (validation issues, missing paths, …). */
  readonly details?: unknown;

  constructor(code: RuntimeErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
    // Restore prototype chain for instanceof checks after transpilation.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** No character SDK matches the requested id / directory / declared id. */
export class CharacterNotFoundError extends CharacterRuntimeError {
  constructor(requestedId: string, available: string[]) {
    super(
      "CHARACTER_NOT_FOUND",
      `No character found for "${requestedId}". Available: ${available.join(", ") || "<none>"}.`,
      { requestedId, available }
    );
  }
}

/** The character package failed schema validation and cannot be trusted. */
export class CharacterPackageInvalidError extends CharacterRuntimeError {
  constructor(characterId: string, issues: unknown) {
    super(
      "CHARACTER_PACKAGE_INVALID",
      `Character package "${characterId}" is invalid.`,
      { characterId, issues }
    );
  }
}

/** A required SDK document (e.g. identity, personality) is missing. */
export class CharacterDocumentMissingError extends CharacterRuntimeError {
  constructor(characterId: string, document: string) {
    super(
      "CHARACTER_DOCUMENT_MISSING",
      `Required document "${document}" is missing for character "${characterId}".`,
      { characterId, document }
    );
  }
}

/** A referenced identity/reference image asset could not be found on disk. */
export class IdentityAssetMissingError extends CharacterRuntimeError {
  constructor(characterId: string, relPath: string) {
    super(
      "IDENTITY_ASSET_MISSING",
      `Identity asset "${relPath}" is missing for character "${characterId}".`,
      { characterId, relPath }
    );
  }
}

/** The personality document could not be parsed into a structured profile. */
export class PersonalityParseError extends CharacterRuntimeError {
  constructor(characterId: string, reason: string) {
    super(
      "PERSONALITY_PARSE_ERROR",
      `Failed to parse personality for character "${characterId}": ${reason}`,
      { characterId, reason }
    );
  }
}

/**
 * Two or more distinct packages declare the same canonical `characterId`.
 * The registry refuses to resolve the id to an arbitrary package.
 */
export class DuplicateCharacterIdError extends CharacterRuntimeError {
  constructor(characterId: string, packages: ConflictingPackageRef[]) {
    super(
      "DUPLICATE_CHARACTER_ID",
      `Ambiguous characterId "${characterId}" is declared by ${packages.length} packages: ${packages
        .map((p) => `${p.directoryName} (${p.characterCode ?? "no code"})`)
        .join(", ")}.`,
      { characterId, packages }
    );
  }
}

/**
 * Two or more distinct packages share the same business `characterCode`.
 * Codes must be unique across the registry.
 */
export class DuplicateCharacterCodeError extends CharacterRuntimeError {
  constructor(characterCode: string, packages: ConflictingPackageRef[]) {
    super(
      "DUPLICATE_CHARACTER_CODE",
      `Ambiguous characterCode "${characterCode}" is shared by ${packages.length} packages: ${packages
        .map((p) => `${p.directoryName} (${p.characterId})`)
        .join(", ")}.`,
      { characterCode, packages }
    );
  }
}
