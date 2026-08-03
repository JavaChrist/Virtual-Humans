/**
 * Normalize Supabase / Postgres errors for V2 adapters (VHS-113).
 * Never include secrets, signed URLs, or raw payloads in publicMessage.
 */

export type DbErrorCode =
  | "not_found"
  | "conflict"
  | "optimistic_conflict"
  | "insufficient_funds"
  | "lease_invalid"
  | "invalid_input"
  | "unavailable"
  | "unknown";

export class PersistenceError extends Error {
  readonly code: DbErrorCode;
  readonly publicMessage: string;
  readonly retryable: boolean;

  constructor(
    code: DbErrorCode,
    publicMessage: string,
    opts?: { retryable?: boolean; diagnostic?: string }
  ) {
    super(opts?.diagnostic ?? publicMessage);
    this.name = "PersistenceError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.retryable = opts?.retryable ?? false;
  }
}

export function mapSupabaseError(e: unknown): PersistenceError {
  const msg =
    e && typeof e === "object" && "message" in e
      ? String((e as { message: unknown }).message)
      : e instanceof Error
        ? e.message
        : "Persistence error";

  const lower = msg.toLowerCase();
  if (/optimistic_conflict/.test(lower)) {
    return new PersistenceError("optimistic_conflict", "Conflit de révision optimiste.", {
      diagnostic: "optimistic_conflict",
    });
  }
  if (/insufficient_funds/.test(lower)) {
    return new PersistenceError("insufficient_funds", "Budget insuffisant.", {
      diagnostic: "insufficient_funds",
    });
  }
  if (/lease_invalid/.test(lower)) {
    return new PersistenceError("lease_invalid", "Lease de job invalide ou expirée.", {
      diagnostic: "lease_invalid",
    });
  }
  if (/duplicate key|unique constraint|23505/.test(lower)) {
    return new PersistenceError("conflict", "Conflit d'unicité.", {
      diagnostic: "unique_violation",
    });
  }
  if (/not found|pgrst116|0 rows/.test(lower)) {
    return new PersistenceError("not_found", "Ressource introuvable.", {
      diagnostic: "not_found",
    });
  }
  if (/jwt|auth|permission|42501/.test(lower)) {
    return new PersistenceError("unavailable", "Persistance indisponible.", {
      diagnostic: "permission_denied",
      retryable: false,
    });
  }
  if (/network|timeout|503|502/.test(lower)) {
    return new PersistenceError("unavailable", "Persistance indisponible.", {
      diagnostic: "network",
      retryable: true,
    });
  }
  return new PersistenceError("unknown", "Erreur de persistance.", {
    diagnostic: "unknown",
  });
}
