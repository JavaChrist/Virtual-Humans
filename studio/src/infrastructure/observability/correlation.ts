import { randomUUID } from "node:crypto";
import { DomainIdSchema } from "@/domain/shared";

/** Incoming / outgoing HTTP header for request correlation. */
export const CORRELATION_HEADER = "x-correlation-id";

/**
 * Strict correlation id format:
 * - 8–128 chars
 * - alphanumeric, dot, underscore, hyphen
 * - also satisfies DomainIdSchema (shared domain constraint)
 */
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

export type LogContext = {
  correlationId: string;
  projectId?: string;
  sceneId?: string;
  stepId?: string;
  route?: string;
  operation?: string;
};

/** Returns true when the value is a safe, reusable correlation id. */
export function isValidCorrelationId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!CORRELATION_ID_PATTERN.test(value)) return false;
  return DomainIdSchema.safeParse(value).success;
}

/** Cryptographically strong id (UUID v4). Always valid per {@link isValidCorrelationId}. */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Prefer a valid incoming header value; otherwise generate a new id.
 * Invalid / empty / oversized values are replaced (never trusted blindly).
 */
export function resolveCorrelationId(incoming: string | null | undefined): string {
  const trimmed = typeof incoming === "string" ? incoming.trim() : "";
  if (isValidCorrelationId(trimmed)) return trimmed;
  return generateCorrelationId();
}

/** Build a LogContext from a resolved correlation id and optional fields. */
export function createLogContext(
  correlationId: string,
  extras: Omit<LogContext, "correlationId"> = {},
): LogContext {
  const id = isValidCorrelationId(correlationId) ? correlationId : generateCorrelationId();
  const ctx: LogContext = { correlationId: id };
  if (extras.projectId) ctx.projectId = extras.projectId;
  if (extras.sceneId) ctx.sceneId = extras.sceneId;
  if (extras.stepId) ctx.stepId = extras.stepId;
  if (extras.route) ctx.route = extras.route;
  if (extras.operation) ctx.operation = extras.operation;
  return ctx;
}
