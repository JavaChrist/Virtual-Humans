/**
 * Server-side observability foundation (VHS-005).
 * Infrastructure layer — no React, no domain business rules, no providers.
 */

export {
  CORRELATION_HEADER,
  createLogContext,
  generateCorrelationId,
  isValidCorrelationId,
  resolveCorrelationId,
  type LogContext,
} from "./correlation";

export { REDACTED, redact, type RedactOptions } from "./redact";

export {
  createLogger,
  formatLogEntry,
  formatLogLine,
  logger,
  type LogEntry,
  type LogLevel,
  type Logger,
  type LoggerSink,
} from "./logger";

export {
  idsFromBody,
  startObservedRoute,
  type ObservedRoute,
  type StartObservedRouteOptions,
} from "./http";
