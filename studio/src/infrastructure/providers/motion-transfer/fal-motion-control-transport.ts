/**
 * Fal motion-control transport boundary (MT-007B / MT-013K-OUTPUT-TRANSPORT).
 * Injectable — Fake for tests; real factory exists but must not run while flags OFF.
 * Module import does NOT read FAL_KEY or initialize @fal-ai/client.
 *
 * Provider call counters (distinct):
 * - submitCount — paid generation only
 * - pollCount / statusCount — queue status polls
 * - resultFetchCount — terminal result retrieval (never a new generation)
 */

export type FalMotionControlQueueStatus =
  | "IN_QUEUE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | string;

export type FalMotionControlSubmitRequest = {
  endpointId: string;
  input: Record<string, unknown>;
};

export type FalMotionControlSubmitResponse = {
  requestId: string;
};

export type FalMotionControlResultPayload = {
  videoUrl?: string;
  contentType?: string;
  fileSize?: number;
  fileName?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  fps?: number;
  /** Hostile / malformed shapes for fail-closed tests. */
  videos?: unknown;
  outputCount?: number;
};

export type FalMotionControlStatusResponse = {
  status: FalMotionControlQueueStatus;
  requestId: string;
  /** Present only when status is COMPLETED — adapter must redact before public surfaces. */
  result?: FalMotionControlResultPayload;
  error?: {
    httpStatus?: number;
    message?: string;
    providerErrorCode?: string;
    providerErrorType?: string;
  };
};

export type FalMotionControlTransport = {
  readonly kind: "fake" | "fal_sdk";
  submit(
    request: FalMotionControlSubmitRequest,
  ): Promise<FalMotionControlSubmitResponse>;
  /** Status (+ may include result when COMPLETED). Never resubmits. */
  getStatus(input: {
    endpointId: string;
    requestId: string;
  }): Promise<FalMotionControlStatusResponse>;
  /**
   * Terminal result for an existing providerJobId — never submits / never creates
   * a new generation. Used by drain after fresh process (URL memory-only).
   */
  getResult(input: {
    endpointId: string;
    requestId: string;
  }): Promise<FalMotionControlStatusResponse>;
  /** Observable submit count — paid generation only. */
  readonly submitCount: number;
  /** Alias historical — same as pollCount. */
  readonly statusCount: number;
  /** Queue status polls (non-billing). */
  readonly pollCount: number;
  /** Terminal result fetches for an existing requestId (non-billing). */
  readonly resultFetchCount: number;
};

export type FakeFalMotionControlTransportOptions = {
  /** Status sequence returned across successive getStatus calls for a job. */
  statusSequence?: readonly FalMotionControlQueueStatus[];
  /** Inject unknown status after N status calls (1-based). */
  unknownStatusAfterCalls?: number;
  failSubmit?: {
    httpStatus?: number;
    message?: string;
    providerErrorCode?: string;
    providerErrorType?: string;
  };
  failStatus?: {
    afterCalls?: number;
    httpStatus?: number;
    message?: string;
    providerErrorCode?: string;
    providerErrorType?: string;
  };
  failResult?: {
    httpStatus?: number;
    message?: string;
    providerErrorCode?: string;
    providerErrorType?: string;
  };
  /** Raw CDN URL returned on COMPLETED — adapter must never expose it publicly. */
  completedVideoUrl?: string;
  /** Override COMPLETED result payload (multi-output / malformed tests). */
  completedResult?: FalMotionControlResultPayload;
  /** Force getResult status (default COMPLETED when job known/seeded). */
  getResultStatus?: FalMotionControlQueueStatus;
  requestIdFactory?: () => string;
};

type FakeJob = {
  endpointId: string;
  requestId: string;
  statusIndex: number;
  input: Record<string, unknown>;
};

function buildCompletedResult(
  requestId: string,
  options: FakeFalMotionControlTransportOptions,
): FalMotionControlResultPayload {
  if (options.completedResult) {
    return { ...options.completedResult };
  }
  return {
    videoUrl:
      options.completedVideoUrl ??
      `https://v3b.fal.media/files/fake/${requestId}.mp4`,
    contentType: "video/mp4",
    fileSize: 1_024_000,
    durationSeconds: 8,
    width: 1080,
    height: 1920,
    fps: 24,
  };
}

/**
 * TEST_ONLY fake transport — zero network.
 */
export function createFakeFalMotionControlTransport(
  options: FakeFalMotionControlTransportOptions = {},
): FalMotionControlTransport & {
  readonly jobs: ReadonlyMap<string, FakeJob>;
  readonly lastSubmitInput: Record<string, unknown> | undefined;
  /** Seed a terminal job without submit — simulates fresh-process result fetch. */
  seedTerminalCompleted(requestId: string, endpointId?: string): void;
} {
  let submitCount = 0;
  let pollCount = 0;
  let resultFetchCount = 0;
  let lastSubmitInput: Record<string, unknown> | undefined;
  const jobs = new Map<string, FakeJob>();
  const seededTerminal = new Set<string>();
  const sequence = options.statusSequence ?? [
    "IN_QUEUE",
    "IN_PROGRESS",
    "COMPLETED",
  ];
  let autoId = 0;

  const transport: FalMotionControlTransport & {
    readonly jobs: ReadonlyMap<string, FakeJob>;
    readonly lastSubmitInput: Record<string, unknown> | undefined;
    seedTerminalCompleted(requestId: string, endpointId?: string): void;
  } = {
    kind: "fake",
    get submitCount() {
      return submitCount;
    },
    get statusCount() {
      return pollCount;
    },
    get pollCount() {
      return pollCount;
    },
    get resultFetchCount() {
      return resultFetchCount;
    },
    get jobs() {
      return jobs;
    },
    get lastSubmitInput() {
      return lastSubmitInput;
    },

    seedTerminalCompleted(requestId: string, endpointId = "fal-ai/fake") {
      seededTerminal.add(requestId);
      if (!jobs.has(requestId)) {
        jobs.set(requestId, {
          endpointId,
          requestId,
          statusIndex: sequence.length - 1,
          input: {},
        });
      }
    },

    async submit(request) {
      submitCount += 1;
      if (options.failSubmit) {
        const err = new Error(options.failSubmit.message ?? "fal submit failed");
        (err as { falTransportError?: unknown }).falTransportError = {
          stage: "submit",
          ...options.failSubmit,
        };
        throw err;
      }
      const requestId =
        options.requestIdFactory?.() ?? `fake-fal-req-${++autoId}`;
      lastSubmitInput = { ...request.input };
      jobs.set(requestId, {
        endpointId: request.endpointId,
        requestId,
        statusIndex: 0,
        input: { ...request.input },
      });
      return { requestId };
    },

    async getStatus(input) {
      pollCount += 1;
      const job = jobs.get(input.requestId);
      if (!job) {
        const err = new Error("fal job not found");
        (err as { falTransportError?: unknown }).falTransportError = {
          stage: "poll",
          httpStatus: 404,
          message: "Request not found",
          providerErrorCode: "not_found",
        };
        throw err;
      }

      if (
        options.failStatus &&
        pollCount >= (options.failStatus.afterCalls ?? 1)
      ) {
        const err = new Error(options.failStatus.message ?? "fal status failed");
        (err as { falTransportError?: unknown }).falTransportError = {
          stage: "poll",
          ...options.failStatus,
        };
        throw err;
      }

      if (
        options.unknownStatusAfterCalls != null &&
        pollCount >= options.unknownStatusAfterCalls
      ) {
        return {
          status: "WEIRD_PROVIDER_STATE_XYZ",
          requestId: input.requestId,
        };
      }

      const idx = Math.min(job.statusIndex, sequence.length - 1);
      const status = sequence[idx] ?? "IN_QUEUE";
      if (job.statusIndex < sequence.length - 1) {
        job.statusIndex += 1;
      }

      if (status === "COMPLETED") {
        // Convenience payload for tests/adapter — does not count as getResult.
        return {
          status,
          requestId: input.requestId,
          result: buildCompletedResult(input.requestId, options),
        };
      }
      if (status === "FAILED") {
        return {
          status,
          requestId: input.requestId,
          error: {
            httpStatus: 500,
            message: "Provider generation failed",
            providerErrorCode: "generation_failed",
          },
        };
      }
      return { status, requestId: input.requestId };
    },

    async getResult(input) {
      resultFetchCount += 1;
      if (options.failResult) {
        const err = new Error(options.failResult.message ?? "fal result failed");
        (err as { falTransportError?: unknown }).falTransportError = {
          stage: "result",
          ...options.failResult,
        };
        throw err;
      }

      const job = jobs.get(input.requestId);
      const known = Boolean(job) || seededTerminal.has(input.requestId);
      if (!known) {
        const err = new Error("fal job not found");
        (err as { falTransportError?: unknown }).falTransportError = {
          stage: "result",
          httpStatus: 404,
          message: "Request not found",
          providerErrorCode: "not_found",
        };
        throw err;
      }

      const status = options.getResultStatus ?? "COMPLETED";
      if (status !== "COMPLETED") {
        return { status, requestId: input.requestId };
      }
      return {
        status: "COMPLETED",
        requestId: input.requestId,
        result: buildCompletedResult(input.requestId, options),
      };
    },
  };

  return transport;
}
