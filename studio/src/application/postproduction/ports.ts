/**
 * Postproduction ports (VHS-111).
 * Merge and AICCOS stubs — no Route Handler imports.
 */

import type {
  ExportPackage,
  MergeEngineCapabilities,
  MergeExecutionContext,
  MergePlan,
  MergeResult,
  MergeValidationResult,
  ExternalMergeJobRef,
} from "@/domain/postproduction";

export interface MergeEngine {
  readonly capabilities: MergeEngineCapabilities;

  validate(
    plan: MergePlan,
    context: MergeExecutionContext
  ): Promise<MergeValidationResult>;

  execute(
    plan: MergePlan,
    context: MergeExecutionContext
  ): Promise<MergeResult>;

  poll?(
    job: ExternalMergeJobRef,
    context: MergeExecutionContext
  ): Promise<MergeResult>;

  cancel?(
    job: ExternalMergeJobRef,
    context: MergeExecutionContext
  ): Promise<MergeResult>;
}

export type ExportContext = {
  correlationId: string;
  requestedAt: string;
};

export type ExportValidationResult = {
  valid: boolean;
  issues: { code: string; message: string }[];
};

export type ExportResult =
  | {
      status: "completed";
      destinationId: string;
      /** Opaque remote id — never a signed URL. */
      remoteRef?: string;
      completedAt: string;
    }
  | {
      status: "failed";
      error: { code: string; publicMessage: string };
      failedAt: string;
    };

export interface ExportDestinationAdapter {
  readonly destinationId: string;
  validate(
    exportPackage: ExportPackage,
    context: ExportContext
  ): Promise<ExportValidationResult>;
  send(
    exportPackage: ExportPackage,
    context: ExportContext
  ): Promise<ExportResult>;
}
