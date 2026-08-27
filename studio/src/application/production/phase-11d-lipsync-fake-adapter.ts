/**
 * Local deterministic fake lipsync adapter. Not a provider. Not a real validation.
 */
import { createHash } from "node:crypto";
import type { Phase11DLipsyncPlan } from "./phase-11d-lipsync-plan";

export const PHASE_11D_FAKE_ADAPTER_ID = "fake-local-lipsync" as const;

export type Phase11DFakeLipsyncResult = {
  adapterId: typeof PHASE_11D_FAKE_ADAPTER_ID;
  realProvider: false;
  providerSelected: false;
  checksum: string;
  mimeType: "video/mp4";
  persistedToProduction: false;
  mediaBytesRead: 0;
};

export function runPhase11DFakeLipsyncAdapter(plan: Phase11DLipsyncPlan): Phase11DFakeLipsyncResult {
  const checksum = createHash("sha256")
    .update(`fake-lipsync:${plan.idempotencyKey}:${plan.videoFingerprint}:${plan.audioFingerprint}`)
    .digest("hex");
  return {
    adapterId: PHASE_11D_FAKE_ADAPTER_ID,
    realProvider: false,
    providerSelected: false,
    checksum,
    mimeType: "video/mp4",
    persistedToProduction: false,
    mediaBytesRead: 0,
  };
}
