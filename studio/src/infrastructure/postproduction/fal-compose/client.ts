/**
 * Injectable low-level fal compose client port (VHS-111B).
 */

import type { FalComposePayload } from "./payload";
import type { FalComposePollResult, FalComposeSubmission } from "./result";

export type FalComposeExecutionContext = {
  correlationId: string;
  requestedAt: string;
  signal?: AbortSignal;
};

export interface FalComposeClientPort {
  submit(
    modelId: string,
    payload: FalComposePayload,
    context: FalComposeExecutionContext
  ): Promise<FalComposeSubmission>;

  poll?(
    modelId: string,
    requestId: string,
    context: FalComposeExecutionContext
  ): Promise<FalComposePollResult>;
}
