/**
 * Real @fal-ai/client transport for fal Kling motion-control (MT-007B / MT-013K).
 * Importing this module loads the SDK package but does NOT read FAL_KEY
 * or call fal.config until createFalSdkMotionControlTransport() runs.
 *
 * Resolver must keep this factory unreachable while flags are OFF.
 *
 * Counters:
 * - submitCount — fal.queue.submit (paid)
 * - pollCount — fal.queue.status
 * - resultFetchCount — fal.queue.result (never a new generation)
 */

import { fal } from "@fal-ai/client";
import type { FalMotionControlTransport } from "./fal-motion-control-transport";

export type CreateFalSdkMotionControlTransportOptions = {
  env?: Record<string, string | undefined>;
  /** Override — Production path uses env.FAL_KEY only. */
  credentials?: string;
};

function mapFalResultData(data: unknown): {
  videoUrl?: string;
  contentType?: string;
  fileSize?: number;
  fileName?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  fps?: number;
  videos?: unknown;
  outputCount?: number;
} {
  const root = (data ?? {}) as Record<string, unknown>;
  const video = root.video as
    | {
        url?: string;
        content_type?: string;
        file_size?: number;
        file_name?: string;
        width?: number;
        height?: number;
        fps?: number;
        duration?: number;
      }
    | undefined;
  const videos = root.videos ?? root.outputs;
  let outputCount: number | undefined;
  if (Array.isArray(videos)) outputCount = videos.length;
  else if (video?.url) outputCount = 1;
  else if (root.video != null) outputCount = 1;

  return {
    videoUrl: video?.url,
    contentType: video?.content_type,
    fileSize: video?.file_size,
    fileName: video?.file_name,
    width: video?.width,
    height: video?.height,
    fps: video?.fps,
    durationSeconds:
      typeof video?.duration === "number" ? video.duration : undefined,
    videos,
    outputCount,
  };
}

/**
 * Creates a live fal queue transport. Reads FAL_KEY only at call time.
 * NEVER invoke from tests or while Motion Transfer flags are OFF.
 */
export function createFalSdkMotionControlTransport(
  options: CreateFalSdkMotionControlTransportOptions = {},
): FalMotionControlTransport {
  const env = options.env ?? (process.env as Record<string, string | undefined>);
  const key = options.credentials ?? env.FAL_KEY;
  if (!key?.trim()) {
    throw new Error("FAL_KEY is not set");
  }
  fal.config({ credentials: key });

  let submitCount = 0;
  let pollCount = 0;
  let resultFetchCount = 0;

  return {
    kind: "fal_sdk",
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
    async submit(request) {
      submitCount += 1;
      const { request_id } = await fal.queue.submit(request.endpointId, {
        input: request.input,
      });
      return { requestId: request_id };
    },
    async getStatus(input) {
      pollCount += 1;
      const status = await fal.queue.status(input.endpointId, {
        requestId: input.requestId,
      });
      return {
        status: status.status,
        requestId: input.requestId,
      };
    },
    async getResult(input) {
      resultFetchCount += 1;
      const status = await fal.queue.status(input.endpointId, {
        requestId: input.requestId,
      });
      if (status.status !== "COMPLETED") {
        return {
          status: status.status,
          requestId: input.requestId,
        };
      }
      const result = await fal.queue.result(input.endpointId, {
        requestId: input.requestId,
      });
      return {
        status: "COMPLETED",
        requestId: input.requestId,
        result: mapFalResultData(result.data),
      };
    },
  };
}
