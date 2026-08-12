/**
 * Production download gate — real transport prepared behind flags; fail-closed otherwise.
 * Fake download only via createFakeMotionOutputDownloadPort in harness/tests.
 */

import { MotionTransferDomainError } from "@/domain/motion";
import { isMotionTransferFakeHarnessActive } from "./motion-transfer-worker-gates";
import {
  createFakeMotionOutputDownloadPort,
  type MotionOutputDownloadPort,
} from "./motion-output-download-port";

export function createFailClosedMotionOutputDownloadPort(): MotionOutputDownloadPort {
  return {
    kind: "real",
    downloadCount: 0,
    async download() {
      throw new MotionTransferDomainError(
        "provider_not_configured",
        "Download Motion output indisponible — transport réel non armé / flags OFF.",
      );
    },
  };
}

/**
 * Resolve download port for Production composition.
 * - Harness (non-Vercel): fake
 * - Else: fail-closed (real fal download not armed in this Auth)
 */
export function resolveProductionMotionOutputDownloadPort(
  env: Record<string, string | undefined>,
  testDownload?: MotionOutputDownloadPort,
): MotionOutputDownloadPort {
  if (testDownload) return testDownload;
  if (isMotionTransferFakeHarnessActive(env)) {
    return createFakeMotionOutputDownloadPort();
  }
  return createFailClosedMotionOutputDownloadPort();
}
