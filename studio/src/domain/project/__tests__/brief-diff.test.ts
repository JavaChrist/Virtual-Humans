import assert from "node:assert/strict";
import { test } from "node:test";
import { briefsAreIdentical, diffBriefFields } from "../brief-diff";

const base = {
  projectName: "Campagne",
  subjectType: "product" as const,
  subjectName: "Widget",
  subjectDescription: "Desc",
  objective: "conversion" as const,
  platform: "instagram" as const,
  durationSeconds: 30 as const,
  aspectRatio: "9:16" as const,
  language: "fr",
  tone: "energetic" as const,
  mediaReferences: [] as { id: string; kind: "reference_image"; label: string }[],
};

test("diffBriefFields deterministic and ordered", () => {
  const after = { ...base, projectName: "Campagne 2", tone: "calm" as const };
  const changes = diffBriefFields(base, after);
  assert.deepEqual(
    changes.map((c) => c.field),
    ["projectName", "tone"],
  );
  assert.equal(changes[0]?.before, "Campagne");
  assert.equal(changes[0]?.after, "Campagne 2");
});

test("identical briefs yield empty diff", () => {
  assert.equal(briefsAreIdentical(base, { ...base }), true);
  assert.equal(diffBriefFields(base, { ...base }).length, 0);
});

test("mediaReferences change is reported without URLs", () => {
  const after = {
    ...base,
    mediaReferences: [{ id: "m1", kind: "reference_image" as const, label: "Hero" }],
  };
  const changes = diffBriefFields(base, after);
  assert.equal(changes.some((c) => c.field === "mediaReferences"), true);
  assert.equal(JSON.stringify(changes).includes("https://"), false);
});
