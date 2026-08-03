import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseDirectorV2Enabled,
  parseStrictEnabledFlag,
  isDirectorV2WorkerEnabled,
  isDirectorV2PaidGenerationEnabled,
  isDirectorV2PersistenceEnabled,
  canUseDirectorV2Persistence,
  isDirectorV2MarketingAiEnabled,
  isDirectorV2PaidAiEnabled,
  canExecuteMarketingAi,
  canExecuteCreativeAi,
  isDirectorV2CreativeAiEnabled,
  isDirectorV2ArtAiEnabled,
  isDirectorV2StoryboardAiEnabled,
  canExecuteArtAi,
  canExecuteStoryboardAi,
  getFeatureFlags,
  canExecutePaidGeneration,
} from "../feature-flags";

test("flag absent / empty / 0 / false → disabled", () => {
  assert.equal(parseDirectorV2Enabled(undefined), false);
  assert.equal(parseDirectorV2Enabled(null), false);
  assert.equal(parseDirectorV2Enabled(""), false);
  assert.equal(parseDirectorV2Enabled("  "), false);
  assert.equal(parseDirectorV2Enabled("0"), false);
  assert.equal(parseDirectorV2Enabled("false"), false);
  assert.equal(parseDirectorV2Enabled("FALSE"), false);
  assert.equal(parseDirectorV2Enabled("no"), false);
  assert.equal(parseDirectorV2Enabled("yes"), false);
});

test("flag 1 / true (case + spaces) → enabled", () => {
  assert.equal(parseDirectorV2Enabled("1"), true);
  assert.equal(parseDirectorV2Enabled(" true "), true);
  assert.equal(parseDirectorV2Enabled("TRUE"), true);
  assert.equal(parseDirectorV2Enabled("True"), true);
});

test("flag never enabled accidentally by truthy junk", () => {
  assert.equal(parseDirectorV2Enabled("enabled"), false);
  assert.equal(parseDirectorV2Enabled("on"), false);
  assert.equal(parseDirectorV2Enabled("2"), false);
});

test("worker + paid flags — strict parse + double kill switch", () => {
  assert.equal(parseStrictEnabledFlag("1"), true);
  assert.equal(isDirectorV2WorkerEnabled({}), false);
  assert.equal(isDirectorV2PaidGenerationEnabled({}), false);
  assert.equal(
    isDirectorV2WorkerEnabled({ DIRECTOR_V2_WORKER_ENABLED: "1" }),
    true
  );
  assert.equal(
    isDirectorV2PaidGenerationEnabled({
      DIRECTOR_V2_PAID_GENERATION_ENABLED: "true",
    }),
    true
  );
  assert.equal(
    canExecutePaidGeneration({
      DIRECTOR_V2_WORKER_ENABLED: "1",
      DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
    }),
    false
  );
  const snap = getFeatureFlags({
    DIRECTOR_V2_ENABLED: "1",
    DIRECTOR_V2_WORKER_ENABLED: "1",
    DIRECTOR_V2_PAID_GENERATION_ENABLED: "1",
  });
  assert.deepEqual(snap, {
    directorV2: true,
    directorV2Worker: true,
    directorV2PaidGeneration: true,
    directorV2Persistence: false,
    directorV2MarketingAi: false,
    directorV2CreativeAi: false,
    directorV2ScriptAi: false,
    directorV2ArtAi: false,
    directorV2StoryboardAi: false,
    directorV2PaidAi: false,
  });
});

test("creative AI flags — require creative + paid AI", () => {
  assert.equal(isDirectorV2CreativeAiEnabled({}), false);
  assert.equal(
    canExecuteCreativeAi({
      DIRECTOR_V2_CREATIVE_AI_ENABLED: "1",
      DIRECTOR_V2_PAID_AI_ENABLED: "0",
    }),
    false
  );
  assert.equal(
    canExecuteCreativeAi({
      DIRECTOR_V2_CREATIVE_AI_ENABLED: "1",
      DIRECTOR_V2_PAID_AI_ENABLED: "1",
    }),
    true
  );
});

test("marketing AI flags — separate from paid generation", () => {
  assert.equal(isDirectorV2MarketingAiEnabled({}), false);
  assert.equal(isDirectorV2PaidAiEnabled({}), false);
  assert.equal(
    canExecuteMarketingAi({
      DIRECTOR_V2_MARKETING_AI_ENABLED: "1",
      DIRECTOR_V2_PAID_AI_ENABLED: "0",
    }),
    false
  );
  assert.equal(
    canExecuteMarketingAi({
      DIRECTOR_V2_MARKETING_AI_ENABLED: "1",
      DIRECTOR_V2_PAID_AI_ENABLED: "1",
    }),
    true
  );
  // Not an alias of media paid generation
  assert.equal(
    canExecuteMarketingAi({
      DIRECTOR_V2_PAID_GENERATION_ENABLED: "1",
      DIRECTOR_V2_MARKETING_AI_ENABLED: "1",
    }),
    false
  );
});

test("persistence flag — requires DIRECTOR_V2_ENABLED + PERSISTENCE", () => {
  assert.equal(isDirectorV2PersistenceEnabled({}), false);
  assert.equal(
    isDirectorV2PersistenceEnabled({ DIRECTOR_V2_PERSISTENCE_ENABLED: "1" }),
    true
  );
  assert.equal(
    canUseDirectorV2Persistence({
      DIRECTOR_V2_ENABLED: "0",
      DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
    }),
    false
  );
  assert.equal(
    canUseDirectorV2Persistence({
      DIRECTOR_V2_ENABLED: "1",
      DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
    }),
    true
  );
  assert.equal(
    canUseDirectorV2Persistence({
      DIRECTOR_V2_ENABLED: "1",
      DIRECTOR_V2_PERSISTENCE_ENABLED: "yes",
    }),
    false
  );
});

test("art + storyboard AI flags — off by default, require paid AI", () => {
  assert.equal(isDirectorV2ArtAiEnabled({}), false);
  assert.equal(isDirectorV2StoryboardAiEnabled({}), false);
  assert.equal(canExecuteArtAi({ DIRECTOR_V2_ART_AI_ENABLED: "1" }), false);
  assert.equal(canExecuteStoryboardAi({ DIRECTOR_V2_STORYBOARD_AI_ENABLED: "1" }), false);
  assert.equal(canExecuteArtAi({ DIRECTOR_V2_ART_AI_ENABLED: "1", DIRECTOR_V2_PAID_AI_ENABLED: "1" }), true);
  assert.equal(canExecuteStoryboardAi({ DIRECTOR_V2_STORYBOARD_AI_ENABLED: "1", DIRECTOR_V2_PAID_AI_ENABLED: "1" }), true);
});
