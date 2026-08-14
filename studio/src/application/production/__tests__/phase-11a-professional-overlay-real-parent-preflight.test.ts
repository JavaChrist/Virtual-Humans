/**
 * Phase 11A professional overlay real-parent preflight — local guards only.
 * No Production media. No provider.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createPhase11AProfessionalOverlaySpec } from "@/domain/production/image-text-overlay";
import {
  PHASE_11A_SCENE2_OVERLAY_CTA,
  PHASE_11A_SCENE2_OVERLAY_LOCALE,
  PHASE_11A_SCENE2_OVERLAY_TITLE,
} from "../phase-11a-strip-overlay-copy-dry-run";
import { PHASE_11A_COMPOSITOR_VERSION } from "../phase-11a-deterministic-compositor";
import { PHASE_11A_VECTOR_COMPOSITOR_VERSION } from "../phase-11a-vector-compositor";
import {
  PHASE_11A_VECTOR_FONT_FAMILY,
  PHASE_11A_VECTOR_FONT_ID,
  PHASE_11A_VECTOR_FONT_LICENSE,
} from "../phase-11a-overlay-latin-vector";
import {
  PHASE_11A_CONTRAST_PANEL_VERSION,
  PHASE_11A_LAYOUT_VERSION,
} from "../phase-11a-overlay-layout-1-2";
import { legacyHashGlyphRows } from "../phase-11a-overlay-latin-bitmap";
import {
  assertPhase11AProfessionalPreflightConfirm,
  assertPhase11AProfessionalPreflightReportRedacted,
  assertPhase11AProfessionalSourceVersions,
  PHASE_11A_PROFESSIONAL_PREFLIGHT_CONFIRM_ENV,
  PHASE_11A_PROFESSIONAL_SOURCE_COMMIT_SHORT,
  redactChecksumPrefix,
} from "../phase-11a-professional-overlay-real-parent-preflight";
import { assertPhase11AOverlayPipelineGuards } from "../phase-11a-overlay-review";
import { PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME } from "../phase-11a-deterministic-compositor";

test("11A-1.2.0 preflight — source versions and 1.1.0 isolation", () => {
  assertPhase11AProfessionalSourceVersions({
    fontFamily: PHASE_11A_VECTOR_FONT_FAMILY,
    fontId: PHASE_11A_VECTOR_FONT_ID,
    fontLicense: PHASE_11A_VECTOR_FONT_LICENSE,
    compositorVersion: PHASE_11A_VECTOR_COMPOSITOR_VERSION,
    layoutVersion: PHASE_11A_LAYOUT_VERSION,
    panelVersion: PHASE_11A_CONTRAST_PANEL_VERSION,
    bitmapCompositorVersion: PHASE_11A_COMPOSITOR_VERSION,
  });
  assert.equal(PHASE_11A_PROFESSIONAL_SOURCE_COMMIT_SHORT, "d395ec7");
  assert.equal(legacyHashGlyphRows("A".codePointAt(0)!).length, 8);
});

test("11A-1.2.0 preflight — professional copy exact, confirm gate, redaction", () => {
  const spec = createPhase11AProfessionalOverlaySpec({
    locale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
    title: PHASE_11A_SCENE2_OVERLAY_TITLE,
    callToAction: PHASE_11A_SCENE2_OVERLAY_CTA,
  });
  assert.equal(spec.title, "De l’idée à la structure");
  assert.equal(spec.title.includes("\u2019"), true);
  assert.equal(spec.callToAction, "Découvrir Virtual Humans Studio");
  assert.equal(spec.subtitle, undefined);
  assert.equal(spec.legalLine, undefined);
  assert.equal(spec.fontFamily, "vhs-overlay-latin-vector-v1");
  assert.throws(
    () => assertPhase11AProfessionalPreflightConfirm({}),
    /CONFIRM_PHASE_11A_PROFESSIONAL_OVERLAY_REAL_PARENT_PREFLIGHT/,
  );
  assert.throws(
    () =>
      assertPhase11AProfessionalPreflightConfirm({
        [PHASE_11A_PROFESSIONAL_PREFLIGHT_CONFIRM_ENV]: "1",
        PHASE_11A_ALLOW_EXECUTE: "1",
      }),
    /PHASE_11A_ALLOW_EXECUTE/,
  );
  assertPhase11AProfessionalPreflightConfirm({
    [PHASE_11A_PROFESSIONAL_PREFLIGHT_CONFIRM_ENV]: "1",
  });
  assert.throws(
    () => assertPhase11AProfessionalPreflightReportRedacted("see https://example.com"),
    /leak/,
  );
  assert.equal(redactChecksumPrefix("1ac51f484420ef88abcdef"), "1ac51f484420ef88");
  assertPhase11AOverlayPipelineGuards({
    overlayRuntime: PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME,
    legacyEndpoint: false,
    motionReferenced: false,
    downstreamRequested: false,
    humanReviewPresent: true,
    providerCalls: 0,
  });
});
