/**
 * Domain cost foundation — VHS-006 (partial).
 * Pure TypeScript: no React, Supabase, providers, or route handlers.
 */

export {
  CostDomainError,
  isCostDomainError,
  type CostErrorCode,
} from "./errors";

export {
  addMoney,
  compareMoney,
  formatMoney,
  fromDecimalAmount,
  isMoney,
  money,
  multiplyMoney,
  subtractMoney,
  toDecimalAmount,
  zeroMoney,
  type DecimalRoundMode,
  type Money,
} from "./money";

export {
  COST_ESTIMATE_SCHEMA_VERSION,
  ConfidenceValues,
  EstimationUnitValues,
  MediaActionSchemaValues,
  assertEstimateCoherent,
  buildCostEstimate,
  estimationImpossible,
  type BuildCostEstimateInput,
  type CostEstimate,
  type EstimateConfidence,
  type EstimationUnit,
  type MediaAction,
} from "./estimate";

export {
  createBudgetPolicy,
  createBudgetSnapshot,
  decideBudget,
  isBudgetWarning,
  type BudgetDecision,
  type BudgetPolicy,
  type BudgetRejectionReason,
  type BudgetSnapshot,
} from "./budget";

export {
  runDryRun,
  type DryRunCapability,
  type DryRunInputs,
  type DryRunRequest,
  type DryRunResult,
  type DryRunValidation,
  type DryRunValidationCode,
  type DryRunWarning,
  type RunDryRunOptions,
} from "./dry-run";

export {
  LEGACY_PRICING_VERSION,
  fromLegacyUsdEstimate,
  toLegacyEstimateResponse,
  type FromLegacyUsdInput,
  type LegacyEstimateResponse,
  type LegacyEstimateType,
} from "./legacy";

export {
  BudgetPolicySchema,
  BudgetSnapshotSchema,
  CostEstimateSchema,
  DryRunRequestSchema,
  EstimateConfidenceSchema,
  EstimationUnitSchema,
  MediaActionSchema,
  MoneySchema,
} from "./schemas";
