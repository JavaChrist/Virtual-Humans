/**
 * Phase 11A — deterministic typographic QC (strings, layout, font, contrast).
 * Provider visual defects that cannot be measured remain humanOnly.
 */

import {
  overlayStrings,
  parseImageTextOverlaySpec,
  type ImageTextOverlaySpec,
} from "@/domain/production/image-text-overlay";
import { PHASE_11A_OVERLAY_FONT_FAMILY } from "./phase-11a-overlay-font";
import type { Phase11ACompositorResult } from "./phase-11a-deterministic-compositor";
import { PHASE_11A_COMPOSITOR_CANVAS } from "./phase-11a-deterministic-compositor";
import { checksumSha256Bytes, readPngDimensions } from "./phase-11a-image-technical-qc";

export type Phase11ATypographicQcStatus = "accepted" | "rejected";

export type Phase11ATypographicQcReason = {
  code: string;
  message: string;
};

export type Phase11ATypographicQcResult = {
  status: Phase11ATypographicQcStatus;
  reasons: Phase11ATypographicQcReason[];
  renderedStrings: string[];
  expectedStrings: string[];
  humanOnlyResidual: true;
};

const ROLE_ORDER = ["title", "subtitle", "callToAction", "legalLine"] as const;

export function validatePhase11ATypographicQc(input: {
  spec: ImageTextOverlaySpec;
  composed: Phase11ACompositorResult;
}): Phase11ATypographicQcResult {
  const spec = parseImageTextOverlaySpec(input.spec);
  const expected = overlayStrings(spec);
  const reasons: Phase11ATypographicQcReason[] = [];
  const composed = input.composed;

  if (composed.width !== 1024 || composed.height !== 1024) {
    reasons.push({ code: "dimensions", message: "composed image must be 1024×1024" });
  }
  const dims = readPngDimensions(composed.png);
  if (!dims || dims.width !== 1024 || dims.height !== 1024) {
    reasons.push({ code: "undecodable", message: "composed PNG is not a 1024×1024 PNG" });
  }
  if (checksumSha256Bytes(composed.png) !== composed.checksumSha256) {
    reasons.push({ code: "checksum_mismatch", message: "composed checksum does not match bytes" });
  }
  if (composed.locale !== spec.locale) {
    reasons.push({ code: "locale", message: "composed locale must match overlay spec" });
  }
  if (composed.fontFamily !== PHASE_11A_OVERLAY_FONT_FAMILY) {
    reasons.push({ code: "font", message: "composed font is not allowlisted" });
  }
  if (composed.contrastRatio + 1e-9 < spec.contrastRequirement) {
    reasons.push({ code: "contrast", message: "composed contrast below requirement" });
  }

  if (composed.renderedStrings.length !== expected.length) {
    reasons.push({ code: "string_count", message: "rendered overlay string count mismatch" });
  }
  for (let i = 0; i < expected.length; i++) {
    if (composed.renderedStrings[i] !== expected[i]) {
      reasons.push({
        code: "string_mismatch",
        message: "rendered overlay string differs from expected (no silent mutation)",
      });
    }
  }

  const extra = composed.renderedStrings.filter((s) => !expected.includes(s));
  const missing = expected.filter((s) => !composed.renderedStrings.includes(s));
  if (extra.length) reasons.push({ code: "extra_string", message: "unexpected overlay string" });
  if (missing.length) reasons.push({ code: "missing_string", message: "expected overlay string missing" });

  if (composed.lineBoxes.length > spec.maxLines) {
    reasons.push({ code: "max_lines", message: "line count exceeds maxLines" });
  }

  const clip = {
    x0: spec.safeArea.left,
    y0: spec.safeArea.top,
    x1: PHASE_11A_COMPOSITOR_CANVAS - spec.safeArea.right,
    y1: PHASE_11A_COMPOSITOR_CANVAS - spec.safeArea.bottom,
  };
  for (const box of composed.lineBoxes) {
    if (box.x < clip.x0 || box.y < clip.y0 || box.x + box.width > clip.x1 || box.y + box.height > clip.y1) {
      reasons.push({ code: "safe_area", message: "bounding box outside safe area" });
      break;
    }
  }

  let lastRoleIndex = -1;
  for (const box of composed.lineBoxes) {
    const idx = ROLE_ORDER.indexOf(box.role);
    if (idx < lastRoleIndex) {
      reasons.push({ code: "order", message: "title/subtitle/CTA/legal order violated" });
      break;
    }
    lastRoleIndex = idx;
  }

  return {
    status: reasons.length ? "rejected" : "accepted",
    reasons,
    renderedStrings: [...composed.renderedStrings],
    expectedStrings: expected,
    humanOnlyResidual: true,
  };
}
