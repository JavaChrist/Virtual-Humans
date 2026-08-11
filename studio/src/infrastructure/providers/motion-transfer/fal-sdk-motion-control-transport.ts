/**
 * Real @fal-ai/client transport for fal Kling motion-control (MT-007B).
 * Importing this module loads the SDK package but does NOT read FAL_KEY
 * or call fal.config until createFalSdkMotionControlTransport() runs.
 *
 * Resolver must keep this factory unreachable while flags are OFF.
 */

import { fal } from "@fal-ai/client";
import type { FalMotionControlTransport } from "./fal-motion-control-transport";

export type CreateFalSdkMotionControlTransportOptions = {
  env?: Record<string, string | undefined>;
  /** Override — Production path uses env.FAL_KEY only. */
  credentials?: string;
};

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
  let statusCount = 0;

  return {
    kind: "fal_sdk",
    get submitCount() {
      return submitCount;
    },
    get statusCount() {
      return statusCount;
    },
    async submit(request) {
      submitCount += 1;
      const { request_id } = await fal.queue.submit(request.endpointId, {
        input: request.input,
      });
      return { requestId: request_id };
    },
    async getStatus(input) {
      statusCount += 1;
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
      const data = result.data as {
        video?: {
          url?: string;
          content_type?: string;
          file_size?: number;
          file_name?: string;
        };
      };
      return {
        status: "COMPLETED",
        requestId: input.requestId,
        result: {
          videoUrl: data.video?.url,
          contentType: data.video?.content_type,
          fileSize: data.video?.file_size,
          fileName: data.video?.file_name,
        },
      };
    },
  };
}
