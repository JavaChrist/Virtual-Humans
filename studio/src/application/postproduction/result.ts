/**
 * PostProductionDirector result union (VHS-111).
 */

import type { ProductionResult } from "@/domain/production";
import type {
  ExportPackage,
  FinalQualityReport,
  HumanReviewDecision,
  MergePlan,
  PostProductionValidation,
  PostProductionWarning,
} from "@/domain/postproduction";

export type PostProductionResult =
  | {
      status: "prepared";
      quality: FinalQualityReport;
      mergePlan?: MergePlan;
      productionResult: ProductionResult;
      validations: PostProductionValidation[];
      warnings: PostProductionWarning[];
      exportReady: boolean;
    }
  | {
      status: "merge_unavailable";
      quality: FinalQualityReport;
      mergePlan?: MergePlan;
      productionResult: ProductionResult;
      reason: string;
      validations: PostProductionValidation[];
      warnings: PostProductionWarning[];
      exportReady: false;
    }
  | {
      status: "export_prepared";
      exportPackage: ExportPackage;
      productionResult: ProductionResult;
      validations: PostProductionValidation[];
      warnings: PostProductionWarning[];
    }
  | {
      status: "needs_review";
      quality: FinalQualityReport;
      mergePlan?: MergePlan;
      productionResult: ProductionResult;
      validations: PostProductionValidation[];
      warnings: PostProductionWarning[];
      exportReady: false;
    }
  | {
      status: "failed";
      errors: { code: string; message: string }[];
      validations: PostProductionValidation[];
      warnings: PostProductionWarning[];
    }
  | {
      status: "review_recorded";
      humanReview: HumanReviewDecision;
      productionResult: ProductionResult;
    };
