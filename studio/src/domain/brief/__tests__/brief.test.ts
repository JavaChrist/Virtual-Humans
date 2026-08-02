import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AspectRatioValues,
  DurationValues,
  FIELD_LIMITS,
  PlatformValues,
  assertNoTechnicalLeak,
  createEmptyBriefDraft,
  defaultAspectRatioForPlatform,
  finalizeBrief,
  normalizeBriefFields,
  normalizeLanguage,
  type VideoProjectBriefFields,
} from "../brief";
import { BriefDomainError } from "../errors";

const validFields: VideoProjectBriefFields = {
  projectName: "Lancement App",
  subjectType: "product",
  subjectName: "RideCloud",
  subjectDescription: "Application de mobilité partagée pour les villes.",
  objective: "awareness",
  platform: "instagram",
  durationSeconds: 30,
  aspectRatio: "9:16",
  language: "fr",
  tone: "warm",
  mediaReferences: [],
};

test("normalizeBriefFields accepts a minimal valid brief", () => {
  const fields = normalizeBriefFields(validFields);
  assert.equal(fields.projectName, "Lancement App");
  assert.equal(fields.language, "fr");
});

test("supports all platforms, durations and aspect ratios", () => {
  for (const platform of PlatformValues) {
    const fields = normalizeBriefFields({
      ...validFields,
      platform,
      aspectRatio: defaultAspectRatioForPlatform(platform),
    });
    assert.equal(fields.platform, platform);
  }
  for (const durationSeconds of DurationValues) {
    assert.equal(normalizeBriefFields({ ...validFields, durationSeconds }).durationSeconds, durationSeconds);
  }
  for (const aspectRatio of AspectRatioValues) {
    assert.equal(normalizeBriefFields({ ...validFields, aspectRatio }).aspectRatio, aspectRatio);
  }
});

test("rejects missing required fields and overlong values", () => {
  assert.throws(() => normalizeBriefFields({ ...validFields, projectName: "" }), BriefDomainError);
  assert.throws(
    () => normalizeBriefFields({ ...validFields, subjectDescription: "x".repeat(FIELD_LIMITS.subjectDescription + 1) }),
    BriefDomainError,
  );
});

test("rejects invalid language; accepts fr-FR", () => {
  assert.throws(() => normalizeLanguage("xx_YY"), BriefDomainError);
  assert.equal(normalizeLanguage("fr-fr"), "fr-FR");
  assert.equal(normalizeLanguage("EN"), "en");
});

test("characterId is opaque string, not a Tom/Mei union", () => {
  const fields = normalizeBriefFields({
    ...validFields,
    characterId: "any-folder-sdk-v1",
  });
  assert.equal(fields.characterId, "any-folder-sdk-v1");
});

test("finalizeBrief does not mutate the draft and has no technical keys", () => {
  const draft = createEmptyBriefDraft(2);
  draft.fields = { ...validFields };
  const before = JSON.stringify(draft);
  const brief = finalizeBrief(draft, {
    id: "brief_1",
    projectId: "proj_1",
    createdBy: "user_local",
    correlationId: "corr-brief-000001",
    createdAt: "2026-08-02T15:00:00.000Z",
  });
  assert.equal(JSON.stringify(draft), before);
  assert.equal(brief.schemaVersion, "1.0.0");
  assert.equal(brief.projectName, "Lancement App");
  assertNoTechnicalLeak(brief);
});

test("rejects binary media uris", () => {
  assert.throws(
    () =>
      normalizeBriefFields({
        ...validFields,
        mediaReferences: [
          { id: "m1", kind: "logo", label: "Logo", uri: "data:image/png;base64,xxx" },
        ],
      }),
    BriefDomainError,
  );
});

test("default aspect ratios by platform", () => {
  assert.equal(defaultAspectRatioForPlatform("tiktok"), "9:16");
  assert.equal(defaultAspectRatioForPlatform("linkedin"), "16:9");
  assert.equal(defaultAspectRatioForPlatform("facebook"), "1:1");
});
