/**
 * Normalized GenerationResult union (VHS-109).
 */

import type { Money } from "@/domain/cost";
import type { GenerationError } from "./errors";
import type { ExternalJobRef, GeneratedAsset, ProviderUsage } from "./output";

export type GenerationResult =
  | {
      status: "completed";
      output: GeneratedAsset;
      providerJob?: ExternalJobRef;
      usage?: ProviderUsage;
      actualCost?: Money;
      completedAt: string;
    }
  | {
      status: "submitted";
      providerJob: ExternalJobRef;
      submittedAt: string;
      pollAfterMs?: number;
    }
  | {
      status: "processing";
      providerJob: ExternalJobRef;
      progress?: number;
      pollAfterMs?: number;
    }
  | {
      status: "failed";
      error: GenerationError;
      providerJob?: ExternalJobRef;
      failedAt: string;
    }
  | {
      status: "cancelled";
      providerJob?: ExternalJobRef;
      cancelledAt: string;
    };

export type GenerationWarning = {
  code: string;
  message: string;
};

export type GenerationValidation = {
  code: string;
  passed: boolean;
  message: string;
};
