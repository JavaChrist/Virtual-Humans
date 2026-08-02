import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ObjectiveValues,
  PlatformValues,
  ToneValues,
} from "@/domain/brief";
import { isArtifactType } from "@/domain/project";
import { createInitialRevision } from "@/domain/project/revision";
import {
  mapBriefObjectiveToMarketing,
  MarketingObjectiveValues,
} from "../marketing-plan";
import { finalizeMarketingPlan } from "../finalize";
import { toMarketingPlanViewModel } from "../explanation";
import { makeBrief, makeValidCandidate } from "./fixtures";

test("chaque objectif du brief possède une correspondance identité", () => {
  for (const objective of ObjectiveValues) {
    assert.equal(mapBriefObjectiveToMarketing(objective), objective);
    assert.ok((MarketingObjectiveValues as readonly string[]).includes(objective));
  }
});

test("chaque ton et plateforme supportés restent utilisables", () => {
  for (const tone of ToneValues) {
    for (const platform of PlatformValues) {
      const brief = makeBrief({
        tone,
        platform,
        objective: "awareness",
        callToAction: "Découvrez notre solution",
      });
      assert.equal(brief.tone, tone);
      assert.equal(brief.platform, platform);
    }
  }
});

test("artifact type canonique marketing_plan", () => {
  assert.equal(isArtifactType("marketing_plan"), true);
});

test("révision VHS-004 possible autour d'un MarketingPlan", () => {
  const plan = finalizeMarketingPlan({
    brief: makeBrief(),
    candidate: makeValidCandidate(),
    metadata: { id: "plan-rev", createdBy: "tester", correlationId: "corr-rev" },
  });
  const revision = createInitialRevision({
    id: "rev-1",
    projectId: plan.projectId,
    artifactType: "marketing_plan",
    value: plan,
    createdBy: "tester",
    correlationId: "corr-rev",
  });
  assert.equal(revision.artifactType, "marketing_plan");
  assert.equal(revision.revision, 1);
});

test("view model expose les champs UI prévus", () => {
  const plan = finalizeMarketingPlan({
    brief: makeBrief(),
    candidate: makeValidCandidate(),
    metadata: { id: "plan-vm", createdBy: "tester", correlationId: "corr-vm" },
  });
  const vm = toMarketingPlanViewModel(plan);
  assert.ok(vm.objective);
  assert.ok(vm.audience);
  assert.ok(vm.problem);
  assert.ok(vm.benefit);
  assert.ok(vm.hook);
  assert.ok(vm.cta);
  assert.ok(vm.keyMessages.length >= 1);
  assert.ok(vm.assumptions.length >= 1);
  assert.ok(vm.evidence.length >= 1);
});
