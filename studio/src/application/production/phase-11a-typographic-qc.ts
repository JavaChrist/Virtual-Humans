/**
 * Phase 11A — deterministic typographic QC (strings, layout, font, contrast).
 * Provider visual defects that cannot be measured remain humanOnly.
 */

import {
  overlayStrings,
  parseImageTextOverlaySpec,
  PHASE_11A_OVERLAY_FONT_FAMILIES,
  type ImageTextOverlaySpec,
} from "@/domain/production/image-text-overlay";
import type { Phase11ACompositorResult } from "./phase-11a-deterministic-compositor";
import { PHASE_11A_COMPOSITOR_CANVAS } from "./phase-11a-deterministic-compositor";
import { checksumSha256Bytes, readPngDimensions } from "./phase-11a-image-technical-qc";
import { PHASE_11A_VECTOR_COMPOSITOR_VERSION } from "./phase-11a-vector-compositor";
import { PHASE_11A_LAYOUT_12_MAX_PANEL_SURFACE } from "./phase-11a-overlay-layout-1-2";

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
  if (!(PHASE_11A_OVERLAY_FONT_FAMILIES as readonly string[]).includes(composed.fontFamily)) {
    reasons.push({ code: "font", message: "composed font is not allowlisted" });
  }
  if (composed.fontFamily !== spec.fontFamily) {
    reasons.push({ code: "font_mismatch", message: "composed font does not match overlay spec" });
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

  const joinRole = (role: (typeof ROLE_ORDER)[number]) =>
    composed.lineBoxes
      .filter((box) => box.role === role)
      .map((box) => box.text)
      .join(" ");
  if (joinRole("title") !== spec.title) {
    reasons.push({ code: "line_breaks", message: "title line breaks mutate copy" });
  }
  if (spec.callToAction && joinRole("callToAction") !== spec.callToAction) {
    reasons.push({ code: "line_breaks", message: "CTA line breaks mutate copy" });
  }

  if (composed.compositorVersion === PHASE_11A_VECTOR_COMPOSITOR_VERSION) {
    const cta = composed.lineBoxes.filter((box) => box.role === "callToAction");
    if (cta.length >= 2 && cta[cta.length - 1]?.text === "Studio") {
      reasons.push({ code: "orphan_word", message: "CTA last line is an orphan Studio" });
    }
    const titleBox = composed.lineBoxes.find((box) => box.role === "title");
    const ctaBox = cta[0];
    if (titleBox && ctaBox && titleBox.height <= ctaBox.height) {
      reasons.push({ code: "hierarchy", message: "title must be visually larger than CTA" });
    }
    const panelSurface =
      composed.lineBoxes.reduce((n, box) => n + box.width * box.height, 0) / (1024 * 1024);
    if (panelSurface > PHASE_11A_LAYOUT_12_MAX_PANEL_SURFACE) {
      reasons.push({ code: "panel_surface", message: "contrast panel covers too much of the canvas" });
    }
    if (composed.redactedMetadata.compositorVersion !== PHASE_11A_VECTOR_COMPOSITOR_VERSION) {
      reasons.push({ code: "compositor_provenance", message: "compositor provenance mismatch" });
    }
  }

  return {
    status: reasons.length ? "rejected" : "accepted",
    reasons,
    renderedStrings: [...composed.renderedStrings],
    expectedStrings: expected,
    humanOnlyResidual: true,
  };
}
