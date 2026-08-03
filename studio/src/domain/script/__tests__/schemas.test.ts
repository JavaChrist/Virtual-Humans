import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizeVideoScript } from "../finalize";
import { ScriptAnalysisCandidateSchema, VideoScriptSchema } from "../schemas";
import { calculateScriptTiming } from "../timing";
import {
  makeScriptChain,
  makeValidScriptCandidate,
} from "./fixtures";

test("script minimal valide via finalize", () => {
  const { brief, marketingPlan, creativeConcept } = makeScriptChain();
  const candidate = makeValidScriptCandidate();
  const timing = calculateScriptTiming(
    candidate.segments,
    candidate.language,
    brief.durationSeconds,
  );
  assert.notEqual(timing.status, "too_long", `timing ${timing.estimatedTotalSeconds}s`);

  const script = finalizeVideoScript({
    brief,
    marketingPlan,
    creativeConcept,
    candidate,
    metadata: { id: "scr-1", createdBy: "t", correlationId: "c1" },
  });
  assert.equal(VideoScriptSchema.safeParse(script).success, true);
  assert.equal(script.creativeConceptRevisionId, creativeConcept.id);
  assert.equal(script.marketingPlanRevisionId, marketingPlan.id);
});

test("ordres non contigus", async () => {
  const { validateSegmentStructure } = await import("../validation");
  const base = makeValidScriptCandidate();
  const c = [
    { ...base.segments[0]!, order: 1 },
    { ...base.segments[1]!, order: 3, purpose: "cta" as const },
  ];
  assert.ok(validateSegmentStructure(c).some((i) => i.message.includes("contigus")));
});

test("IDs dupliqués", async () => {
  const { validateSegmentStructure } = await import("../validation");
  const base = makeValidScriptCandidate();
  const segs = base.segments.map((s, i) => ({ ...s, id: "dup", order: i + 1 }));
  assert.ok(validateSegmentStructure(segs).some((i) => i.message.includes("dupliqués")));
});

test("speaker sans contenu", () => {
  assert.equal(
    ScriptAnalysisCandidateSchema.safeParse(
      makeValidScriptCandidate({
        segments: [
          {
            id: "a",
            order: 1,
            purpose: "hook",
            speaker: "character",
            emotion: "x",
            pauseAfterMs: 0,
            pronunciationNotes: [],
          },
          {
            id: "b",
            order: 2,
            purpose: "cta",
            speaker: "character",
            dialogue: "Téléchargez l'app maintenant",
            emotion: "x",
            pauseAfterMs: 0,
            pronunciationNotes: [],
          },
        ],
      }),
    ).success,
    false,
  );
});

test("speaker none avec dialogue", () => {
  assert.equal(
    ScriptAnalysisCandidateSchema.safeParse(
      makeValidScriptCandidate({
        segments: makeValidScriptCandidate().segments.map((s, i) =>
          i === 0
            ? { ...s, speaker: "none" as const, dialogue: "oops", voiceOver: undefined }
            : s,
        ),
      }),
    ).success,
    false,
  );
});

test("dialogue et voice-over concurrents", () => {
  assert.equal(
    ScriptAnalysisCandidateSchema.safeParse(
      makeValidScriptCandidate({
        segments: makeValidScriptCandidate().segments.map((s, i) =>
          i === 0
            ? {
                ...s,
                speaker: "character" as const,
                dialogue: "Hi",
                voiceOver: "Also",
              }
            : s,
        ),
      }),
    ).success,
    false,
  );
});

test("sérialisation complète", () => {
  const { brief, marketingPlan, creativeConcept } = makeScriptChain();
  const script = finalizeVideoScript({
    brief,
    marketingPlan,
    creativeConcept,
    candidate: makeValidScriptCandidate(),
    metadata: { id: "scr-ser", createdBy: "t", correlationId: "c" },
  });
  assert.equal(VideoScriptSchema.safeParse(JSON.parse(JSON.stringify(script))).success, true);
});
