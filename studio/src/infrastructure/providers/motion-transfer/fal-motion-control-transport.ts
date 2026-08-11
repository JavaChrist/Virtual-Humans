/**
 * Fal motion-control transport boundary (MT-007B).
 * Injectable — Fake for tests; real factory exists but must not run while flags OFF.
 * Module import does NOT read FAL_KEY or initialize @fal-ai/client.
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

export type FalMotionControlStatusResponse = {
  status: FalMotionControlQueueStatus;
  requestId: string;
  /** Present only when status is COMPLETED — adapter must redact before public surfaces. */
  result?: {
    videoUrl?: string;
    contentType?: string;
    fileSize?: number;
    fileName?: string;
    width?: number;
    height?: number;
    durationSeconds?: number;
    fps?: number;
  };
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
  /** Status (+ result fetch when COMPLETED). Never resubmits. */
  getStatus(input: {
    endpointId: string;
    requestId: string;
  }): Promise<FalMotionControlStatusResponse>;
  /** Observable submit count — not a Production exactly-once guarantee. */
  readonly submitCount: number;
  readonly statusCount: number;
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
  /** Raw CDN URL returned on COMPLETED — adapter must never expose it publicly. */
  completedVideoUrl?: string;
  requestIdFactory?: () => string;
};

type FakeJob = {
  endpointId: string;
  requestId: string;
  statusIndex: number;
  input: Record<string, unknown>;
};

/**
 * TEST_ONLY fake transport — zero network.
 */
export function createFakeFalMotionControlTransport(
  options: FakeFalMotionControlTransportOptions = {},
): FalMotionControlTransport & {
  readonly jobs: ReadonlyMap<string, FakeJob>;
  readonly lastSubmitInput: Record<string, unknown> | undefined;
} {
  let submitCount = 0;
  let statusCount = 0;
  let lastSubmitInput: Record<string, unknown> | undefined;
  const jobs = new Map<string, FakeJob>();
  const sequence = options.statusSequence ?? [
    "IN_QUEUE",
    "IN_PROGRESS",
    "COMPLETED",
  ];
  let autoId = 0;

  const transport: FalMotionControlTransport & {
    readonly jobs: ReadonlyMap<string, FakeJob>;
    readonly lastSubmitInput: Record<string, unknown> | undefined;
  } = {
    kind: "fake",
    get submitCount() {
      return submitCount;
    },
    get statusCount() {
      return statusCount;
    },
    get jobs() {
      return jobs;
    },
    get lastSubmitInput() {
      return lastSubmitInput;
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
      statusCount += 1;
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
        statusCount >= (options.failStatus.afterCalls ?? 1)
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
        statusCount >= options.unknownStatusAfterCalls
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
        return {
          status,
          requestId: input.requestId,
          result: {
            videoUrl:
              options.completedVideoUrl ??
              `https://v3b.fal.media/files/fake/${input.requestId}.mp4`,
            contentType: "video/mp4",
            fileSize: 1_024_000,
            durationSeconds: 8,
          },
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
  };

  return transport;
}
