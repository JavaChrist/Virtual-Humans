import { createLogContext, type LogContext } from "./correlation";
import { redact, REDACTED } from "./redact";

export type LogLevel = "info" | "warn" | "error";

export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  event: string;
  correlationId: string;
  route?: string;
  operation?: string;
  projectId?: string;
  sceneId?: string;
  stepId?: string;
  /** Safe, user-facing summary when logging an error. */
  publicMessage?: string;
  /** Redacted structured payload (never secrets / full prompts). */
  data?: unknown;
  /** Redacted error diagnostic (name/message/stack). */
  diagnostic?: unknown;
};

export type LoggerSink = (line: string) => void;

export type Logger = {
  info(event: string, context: LogContext, data?: unknown): void;
  warn(event: string, context: LogContext, data?: unknown): void;
  error(event: string, context: LogContext, error?: unknown, data?: unknown): void;
};

function defaultSink(line: string): void {
  // Structured JSON on a single line for log aggregators.
  console.log(line);
}

function publicErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Never echo raw provider/auth messages that may embed keys.
    const msg = error.message || error.name || "Error";
    if (/api[_-]?key|token|password|secret|bearer\s/i.test(msg)) {
      return "An internal error occurred";
    }
    // Bound length
    return msg.length > 200 ? `${msg.slice(0, 200)}…` : msg;
  }
  return "An internal error occurred";
}

function buildEntry(
  level: LogLevel,
  event: string,
  context: LogContext,
  data?: unknown,
  error?: unknown,
): LogEntry {
  const ctx = createLogContext(context.correlationId, context);
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    correlationId: ctx.correlationId,
  };
  if (ctx.route) entry.route = ctx.route;
  if (ctx.operation) entry.operation = ctx.operation;
  if (ctx.projectId) entry.projectId = ctx.projectId;
  if (ctx.sceneId) entry.sceneId = ctx.sceneId;
  if (ctx.stepId) entry.stepId = ctx.stepId;

  if (data !== undefined) {
    entry.data = redact(data);
  }

  if (error !== undefined) {
    entry.publicMessage = publicErrorMessage(error);
    entry.diagnostic = redact(
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { value: error },
    );
  }

  return entry;
}

function serialize(entry: LogEntry): string {
  // Ensure the serialized line never contains a known leaked secret marker bypass:
  // redact already applied; JSON.stringify on redacted tree.
  try {
    return JSON.stringify(entry);
  } catch {
    return JSON.stringify({
      timestamp: entry.timestamp,
      level: entry.level,
      event: entry.event,
      correlationId: entry.correlationId,
      publicMessage: "Log serialization failed",
      data: REDACTED,
    });
  }
}

/** Create a logger with an optional injectable sink (tests). */
export function createLogger(sink: LoggerSink = defaultSink): Logger {
  return {
    info(event, context, data) {
      sink(serialize(buildEntry("info", event, context, data)));
    },
    warn(event, context, data) {
      sink(serialize(buildEntry("warn", event, context, data)));
    },
    error(event, context, error, data) {
      sink(serialize(buildEntry("error", event, context, data, error)));
    },
  };
}

/** Process-wide default logger (server-side only). */
export const logger: Logger = createLogger();

/** Build + serialize a log entry without writing (for tests). */
export function formatLogEntry(
  level: LogLevel,
  event: string,
  context: LogContext,
  data?: unknown,
  error?: unknown,
): LogEntry {
  return buildEntry(level, event, context, data, error);
}

export function formatLogLine(
  level: LogLevel,
  event: string,
  context: LogContext,
  data?: unknown,
  error?: unknown,
): string {
  return serialize(buildEntry(level, event, context, data, error));
}
