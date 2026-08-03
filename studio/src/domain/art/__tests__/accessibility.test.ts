import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contrastRatio,
  normalizeHex,
  validateCompositionAccessibility,
  validatePaletteAccessibility,
} from "../accessibility";
import { makeArtChain, makeValidArtCandidate } from "./fixtures";

test("hex normalisé", () => {
  assert.equal(normalizeHex("#ABC"), "#aabbcc");
  assert.equal(normalizeHex("#AaBbCc"), "#aabbcc");
  assert.equal(normalizeHex("nope"), null);
});

test("contraste suffisant", () => {
  const { issues } = validatePaletteAccessibility([
    { name: "bg", hex: "#FFFFFF", role: "background" },
    { name: "tx", hex: "#000000", role: "text" },
  ]);
  assert.equal(issues.length, 0);
  assert.ok((contrastRatio("#000000", "#FFFFFF") ?? 0) >= 4.5);
});

test("contraste insuffisant", () => {
  const { issues } = validatePaletteAccessibility([
    { name: "bg", hex: "#EEEEEE", role: "background" },
    { name: "tx", hex: "#DDDDDD", role: "text" },
  ]);
  assert.ok(issues.some((i) => i.code === "accessibility_violation"));
});

test("texte sans safe area", () => {
  const chain = makeArtChain();
  const candidate = makeValidArtCandidate(chain.videoScript.segments.map((s) => s.id));
  const seg3 = candidate.segments.find((s) => s.scriptSegmentId === "seg-3")!;
  seg3.composition.textSafeArea = "none";
  const screenMap = new Map(chain.videoScript.segments.map((s) => [s.id, s.screenText]));
  const { issues } = validateCompositionAccessibility(candidate.segments, screenMap);
  assert.ok(issues.some((i) => i.message.includes("safe area")));
});

test("palette sans texte — pas d'erreur contraste", () => {
  const { issues } = validatePaletteAccessibility([
    { name: "primary", hex: "#0B5FFF", role: "primary" },
  ]);
  assert.equal(issues.length, 0);
});

test("rôles couleur dupliqués → warning", () => {
  const { warnings } = validatePaletteAccessibility([
    { name: "t1", hex: "#000000", role: "text" },
    { name: "t2", hex: "#111111", role: "text" },
    { name: "b1", hex: "#FFFFFF", role: "background" },
  ]);
  assert.ok(warnings.some((w) => w.code === "duplicate_color_role"));
});
