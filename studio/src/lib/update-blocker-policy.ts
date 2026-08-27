/**
 * Pure predicates for when an existing update blocker should be active.
 * Does not register anything and does not start workflows.
 */

import type { AutosaveStatus } from "@/application/director/progress";

/** Director UI phases that are past local confirm and not yet terminal. */
const DIRECTOR_PROCESSING_PHASES = new Set([
  "submitting",
  "running",
  "validating",
  "persisting",
]);

export const PRODUCTION_RUN_TERMINAL = new Set([
  "completed",
  "partial",
  "failed",
  "cancelled",
]);

export const DIRECTOR_DRY_BUSY_TOKENS = ["dry", "dry-run", "qc-dry"] as const;

export function shouldBlockDirectorUiProcessing(phase: string): boolean {
  return DIRECTOR_PROCESSING_PHASES.has(phase);
}

export function shouldBlockNonDryBusy(
  busy: string | null | undefined,
  dryTokens: readonly string[] = DIRECTOR_DRY_BUSY_TOKENS,
): boolean {
  if (!busy) return false;
  return !dryTokens.includes(busy);
}

export function shouldBlockProductionRun(
  busy: string | null | undefined,
  runStatus: string | null | undefined,
): boolean {
  if (shouldBlockNonDryBusy(busy, ["dry"])) return true;
  if (runStatus && !PRODUCTION_RUN_TERMINAL.has(runStatus)) return true;
  return false;
}

/** Same dry-run exception as Production: validation/dry never register a blocker. */
export function shouldBlockLipsyncInFlight(
  busy: string | null | undefined,
  runStatus: string | null | undefined,
): boolean {
  return shouldBlockProductionRun(busy, runStatus);
}

/** Same dry-run exception: fake local sync and dry never register a blocker. */
export function shouldBlockMergeExportInFlight(
  busy: string | null | undefined,
  runStatus: string | null | undefined,
): boolean {
  return shouldBlockProductionRun(busy, runStatus);
}

export function shouldBlockAutosave(status: AutosaveStatus): boolean {
  return status === "dirty" || status === "saving";
}

/** In-flight studio job: status set, result not durable yet, error not terminal. */
export function shouldBlockStudioJob(input: {
  status?: string | null;
  resultUrl?: string | null;
  error?: string | null;
}): boolean {
  const status = input.status ?? null;
  if (!status) return false;
  if (input.error) return false;
  if (input.resultUrl) return false;
  if (status === "Terminé" || status.startsWith("Terminé")) return false;
  return true;
}

export type StoryboardBusyShot = {
  status?: string | null;
  videoUrl?: string | null;
  error?: string | null;
  voiceBusy?: boolean;
  syncStatus?: string | null;
  syncedUrl?: string | null;
  syncError?: string | null;
};

export type StoryboardBusySnapshot = {
  masterBusy: boolean;
  duoBusy: boolean;
  mergeStatus: string | null;
  mergedUrl: string | null;
  mergeError: string | null;
  shots: StoryboardBusyShot[];
  partners: Array<{ busy?: boolean }>;
};

export function shouldBlockStoryboard(snapshot: StoryboardBusySnapshot): boolean {
  if (snapshot.masterBusy || snapshot.duoBusy) return true;
  if (snapshot.partners.some((partner) => partner.busy)) return true;
  if (
    shouldBlockStudioJob({
      status: snapshot.mergeStatus,
      resultUrl: snapshot.mergedUrl,
      error: snapshot.mergeError,
    })
  ) {
    return true;
  }
  return snapshot.shots.some((shot) => {
    if (shot.voiceBusy) return true;
    if (
      shouldBlockStudioJob({
        status: shot.status,
        resultUrl: shot.videoUrl,
        error: shot.error,
      })
    ) {
      return true;
    }
    return shouldBlockStudioJob({
      status: shot.syncStatus,
      resultUrl: shot.syncedUrl,
      error: shot.syncError,
    });
  });
}
