/**
 * Worker errors — never include lease tokens, prompts, or signed URLs.
 */

export type WorkerErrorCode =
  | "worker_disabled"
  | "paid_generation_disabled"
  | "policy_invalid"
  | "claim_failed"
  | "lease_lost"
  | "lease_invalid"
  | "job_processing_failed"
  | "budget_exhausted"
  | "timeout"
  | "dry_run_not_ready"
  | "worker_id_empty"
  | "worker_id_invalid"
  | "version_invalid"
  | "claim_limit_out_of_bounds"
  | "lease_out_of_bounds"
  | "heartbeat_out_of_bounds"
  | "max_jobs_out_of_bounds"
  | "max_provider_out_of_bounds"
  | "max_duration_out_of_bounds"
  | "polling_delay_out_of_bounds"
  | "claim_exceeds_max_jobs"
  | "heartbeat_not_below_lease"
  | "unknown";

export class WorkerError extends Error {
  readonly code: WorkerErrorCode;
  readonly publicMessage: string;

  constructor(code: WorkerErrorCode, publicMessage: string) {
    super(publicMessage);
    this.name = "WorkerError";
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

export class WorkerPolicyError extends WorkerError {
  constructor(code: WorkerErrorCode, publicMessage: string) {
    super(code, publicMessage);
    this.name = "WorkerPolicyError";
  }
}

export class LeaseLostError extends WorkerError {
  constructor(publicMessage = "Lease perdu — traitement arrêté.") {
    super("lease_lost", publicMessage);
    this.name = "LeaseLostError";
  }
}

/** Strip secrets from any string before logging/errors. */
export function redactSecrets(text: string): string {
  return text
    .replace(/lease[_-]?token["']?\s*[:=]\s*["']?[^\s"',}]+/gi, "lease_token=[REDACTED]")
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/https?:\/\/[^\s"']+/gi, "[REDACTED_URL]");
}
