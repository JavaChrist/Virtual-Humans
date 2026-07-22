import {
  CharacterNotFoundError,
  CharacterRuntimeError,
  DuplicateCharacterCodeError,
  DuplicateCharacterIdError,
} from "../errors";
import type { CharacterRegistry } from "./registry";

export interface HttpResult {
  status: number;
  body: unknown;
}

/**
 * Pure mapping from a character-detail lookup to an HTTP status + body.
 * Extracted from the route handler so it can be unit-tested against any
 * registry instance (fixtures included).
 */
export function characterDetailResponse(registry: CharacterRegistry, id: string): HttpResult {
  try {
    const character = registry.getCharacter(id);
    const validation = registry.validate(id);
    return { status: 200, body: { character, validation } };
  } catch (err) {
    if (err instanceof CharacterNotFoundError) {
      return { status: 404, body: errBody(err) };
    }
    if (err instanceof DuplicateCharacterIdError || err instanceof DuplicateCharacterCodeError) {
      return { status: 409, body: errBody(err) };
    }
    if (err instanceof CharacterRuntimeError) {
      return { status: 422, body: errBody(err) };
    }
    return {
      status: 500,
      body: { error: { code: "INTERNAL", message: "Unexpected error loading character." } },
    };
  }
}

function errBody(err: CharacterRuntimeError): { error: { code: string; message: string; details?: unknown } } {
  return { error: { code: err.code, message: err.message, details: err.details } };
}
