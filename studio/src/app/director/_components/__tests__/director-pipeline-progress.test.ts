import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDirectorPipelineProgress,
  humanArtifactLabel,
} from "../director-pipeline-progress-model";

test("pipeline — brief seul : Marketing est l’étape courante, la suite est verrouillée", () => {
  const view = buildDirectorPipelineProgress({ hasBrief: true });
  assert.equal(view.steps[0].state, "done");
  assert.equal(view.steps[1].state, "current");
  assert.equal(view.steps[1].label, "Marketing");
  assert.equal(view.steps[2].state, "locked");
  assert.equal(view.realRuntimeOff, true);
  assert.equal(view.mergeExportAuthorized, false);
  assert.equal(view.finalMediaProduced, false);
  assert.match(view.summary, /Export réel non autorisé/);
  assert.doesNotMatch(view.summary, /openai|fal|elevenlabs|ffmpeg/i);
});

test("pipeline — lipsync/merge/export restent préparés désactivés", () => {
  const view = buildDirectorPipelineProgress({
    hasBrief: true,
    hasMarketing: true,
    hasCreative: true,
    hasScript: true,
    hasVoiceChoice: true,
    hasArt: true,
    hasStoryboard: true,
    hasPrompts: true,
    hasRouting: true,
    hasProduction: true,
    lipsyncPrepared: true,
    mergePrepared: true,
    exportPrepared: true,
  });
  assert.equal(view.steps.find((s) => s.id === "lipsync")?.state, "prepared_disabled");
  assert.equal(view.steps.find((s) => s.id === "merge")?.state, "prepared_disabled");
  assert.equal(view.steps.find((s) => s.id === "export")?.state, "prepared_disabled");
});

test("pipeline — libellés humains sans types internes", () => {
  assert.equal(humanArtifactLabel("marketing_plan"), "Marketing");
  assert.equal(humanArtifactLabel("generation_plan"), "Routage");
  assert.doesNotMatch(humanArtifactLabel("video_script"), /video_script/);
});
