/**
 * RideCloud separate project create preflight — local only. No Production write.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MV001_MOTION_PROJECT_ID } from "../phase-11a-motion-isolation";
import { PHASE_11A_SMOKE_PROJECT_ID } from "../phase-11a-openai-image-allowlist";
import { PHASE_11B_WORKSPACE_ID } from "../phase-11b-i2v-allowlist";
import {
  RIDECLOUD_LOCKED_CLAIM,
  RIDECLOUD_LOCKED_CTA,
  RIDECLOUD_PROJECT_KEY,
} from "../ridecloud-input-preflight";
import { RIDECLOUD_STORYBOARD_NEXT_AUTH } from "../ridecloud-first-ad-storyboard-preflight";
import {
  RIDECLOUD_CANONICAL_WORKSPACE_ID,
  RIDECLOUD_DOCUMENTED_BUDGET,
  RIDECLOUD_FORBIDDEN_PROJECT_IDS,
  RIDECLOUD_FUTURE_RPC,
  RIDECLOUD_PROJECT_CREATE_NEXT_AUTH,
  RIDECLOUD_PROJECT_CREATE_PREFLIGHT_AUTH,
  RIDECLOUD_PROJECT_CREATE_PREFLIGHT_VERDICT,
  RIDECLOUD_PROJECT_DISPLAY_NAME,
  RIDECLOUD_VOICE_MAY_SUBMIT,
  RIDECLOUD_VOICE_SUBMIT_COUNT,
  assertRideCloudCreateBudget,
  assertRideCloudCreateIsolation,
  assertRideCloudCreatePlanIsRedactedSafe,
  assertRideCloudCreateResolver,
  assertRideCloudCreateRuntime,
  buildRideCloudSeparateProjectCreatePreflight,
  decideRideCloudCreateReplay,
  plannedRideCloudBriefFields,
  redactRideCloudId,
  rideCloudCreateCommandFingerprint,
  rideCloudDeterministicBriefId,
  rideCloudDeterministicProjectId,
} from "../ridecloud-separate-project-create-preflight";

test("RIDECLOUD-CREATE-PREFLIGHT — auth chain and READY plan", () => {
  assert.equal(
    RIDECLOUD_PROJECT_CREATE_PREFLIGHT_AUTH,
    "AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT_NO_PROVIDER",
  );
  assert.equal(RIDECLOUD_STORYBOARD_NEXT_AUTH, RIDECLOUD_PROJECT_CREATE_PREFLIGHT_AUTH);
  const plan = buildRideCloudSeparateProjectCreatePreflight();
  assert.equal(plan.verdict, RIDECLOUD_PROJECT_CREATE_PREFLIGHT_VERDICT);
  assert.equal(
    plan.nextAuth,
    "AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_IDEMPOTENT_NO_PROVIDER",
  );
  assert.equal(plan.identity.projectKey, "ridecloud-promo-separate-v1");
  assert.equal(plan.identity.name, "RideCloud — First Founder Ad");
  assert.equal(plan.identity.owner, "Christian");
  assert.equal(plan.identity.campaign, "Programme Fondateur");
  assert.deepEqual([...plan.identity.channels], ["linkedin", "instagram"]);
  assert.equal(plan.identity.language, "fr");
  assert.equal(plan.identity.durationSec, 26);
  assert.equal(plan.identity.masterAspectRatio, "9:16");
  assert.deepEqual([...plan.identity.derivedAspectRatios], ["4:5", "1:1"]);
  assert.equal(plan.identity.workspaceIdPrefix.endsWith("…"), true);
  assert.equal(plan.identity.projectIdPrefix.endsWith("…"), true);
});

test("RIDECLOUD-CREATE-PREFLIGHT — deterministic ids stay off the technical denylist", () => {
  const projectId = rideCloudDeterministicProjectId();
  const briefId = rideCloudDeterministicBriefId(projectId);
  assert.equal(projectId, rideCloudDeterministicProjectId());
  assert.equal(briefId, rideCloudDeterministicBriefId(projectId));
  assert.notEqual(projectId, PHASE_11A_SMOKE_PROJECT_ID);
  assert.notEqual(projectId, MV001_MOTION_PROJECT_ID);
  assert.notEqual(briefId, projectId);
  assert.equal(RIDECLOUD_CANONICAL_WORKSPACE_ID, PHASE_11B_WORKSPACE_ID);
  assert.deepEqual(
    [...RIDECLOUD_FORBIDDEN_PROJECT_IDS],
    [PHASE_11A_SMOKE_PROJECT_ID, MV001_MOTION_PROJECT_ID],
  );
  assert.throws(() => assertRideCloudCreateIsolation(PHASE_11A_SMOKE_PROJECT_ID), /TECHNICAL|I2V/);
  assert.throws(() => assertRideCloudCreateIsolation(MV001_MOTION_PROJECT_ID), /MOTION|TECHNICAL/);
  assertRideCloudCreateIsolation(projectId);
  assert.equal(redactRideCloudId(projectId), `${projectId.slice(0, 8)}…`);
});

test("RIDECLOUD-CREATE-PREFLIGHT — replay CAS refuses collisions and accepts identical replay", () => {
  const projectId = rideCloudDeterministicProjectId();
  const planned = {
    id: projectId,
    workspaceId: RIDECLOUD_CANONICAL_WORKSPACE_ID,
    name: RIDECLOUD_PROJECT_DISPLAY_NAME,
    correlationId: RIDECLOUD_PROJECT_KEY,
    fingerprint: rideCloudCreateCommandFingerprint({
      projectId,
      briefId: rideCloudDeterministicBriefId(projectId),
    }),
  };
  const resolver = { mode: "explicit_workspace_project_run_plan_output" as const };
  assert.equal(decideRideCloudCreateReplay({ planned, observed: [], resolver }), "CREATE");
  assert.equal(
    decideRideCloudCreateReplay({ planned, observed: [planned], resolver }),
    "REPLAY_NOOP",
  );
  assert.equal(
    decideRideCloudCreateReplay({
      planned,
      observed: [{ ...planned, fingerprint: "other" }],
      resolver,
    }),
    "REFUSE_FINGERPRINT_MISMATCH",
  );
  assert.equal(
    decideRideCloudCreateReplay({
      planned,
      observed: [{ ...planned, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
      resolver,
    }),
    "REFUSE_NAME_COLLISION",
  );
  assert.equal(
    decideRideCloudCreateReplay({
      planned: { ...planned, id: PHASE_11A_SMOKE_PROJECT_ID },
      observed: [{ ...planned, id: PHASE_11A_SMOKE_PROJECT_ID }],
      resolver,
    }),
    "REFUSE_TECHNICAL_PROJECT",
  );
  assert.equal(
    decideRideCloudCreateReplay({
      planned,
      observed: [],
      resolver: { mode: "current_project" },
    }),
    "REFUSE_CURRENT_PROJECT_FALLBACK",
  );
  assert.throws(
    () => assertRideCloudCreateResolver({ mode: "current_project" }),
    /CURRENT_PROJECT_FALLBACK/,
  );
});

test("RIDECLOUD-CREATE-PREFLIGHT — brief uses locked copy and no media locators", () => {
  const fields = plannedRideCloudBriefFields();
  assert.equal(fields.projectName, RIDECLOUD_PROJECT_DISPLAY_NAME);
  assert.equal(fields.subjectName, "RideCloud");
  assert.equal(fields.subjectDescription, RIDECLOUD_LOCKED_CLAIM);
  assert.equal(fields.callToAction, RIDECLOUD_LOCKED_CTA);
  assert.equal(fields.language, "fr");
  assert.equal(fields.aspectRatio, "9:16");
  assert.equal(fields.durationSeconds, 30);
  assert.equal(fields.platform, "instagram");
  assert.equal(fields.mediaReferences.length, 0);
  assert.match(fields.brandConstraints, /delivery_duration_sec=26/);
  assert.equal(fields.brandConstraints.includes("\\"), false);
});

test("RIDECLOUD-CREATE-PREFLIGHT — runtime, budget, isolation and zero side effects", () => {
  const plan = buildRideCloudSeparateProjectCreatePreflight();
  assert.equal(plan.runtime.voiceRuntime, "OFF");
  assert.equal(plan.runtime.paidMediaRuntime, "OFF");
  assert.equal(plan.runtime.voiceSubmitCount, RIDECLOUD_VOICE_SUBMIT_COUNT);
  assert.equal(plan.runtime.maySubmit, RIDECLOUD_VOICE_MAY_SUBMIT);
  assert.deepEqual(plan.budget, RIDECLOUD_DOCUMENTED_BUDGET);
  assert.equal(plan.isolation.motionIsolated, true);
  assert.equal(plan.isolation.currentProjectFallback, false);
  assert.equal(plan.isolation.pointerMutations, 0);
  assert.equal(plan.creative.lipsync, false);
  assert.equal(plan.creative.music, false);
  assert.equal(plan.creative.providerIdentityActivated, false);
  assert.equal(plan.creative.storyboardPersistedThisWrite, false);
  assert.equal(plan.duplicate.liveSelect, "NOT_EXECUTED");
  assert.equal(plan.duplicate.documentaryRideCloudProjects, 0);
  assert.equal(plan.futureWrite.rpc, RIDECLOUD_FUTURE_RPC);
  assert.deepEqual([...plan.futureWrite.artifacts], ["video_project_brief"]);
  assert.equal(plan.counters.productionProjectsCreated, 0);
  assert.equal(plan.counters.supabaseMutations, 0);
  assert.throws(
    () =>
      assertRideCloudCreateRuntime({
        voiceRuntime: "OFF",
        paidMediaRuntime: "OFF",
        voiceSubmitCount: 1,
        maySubmit: true,
        flagsOff: true,
      }),
    /MAY_SUBMIT/,
  );
  assert.throws(
    () => assertRideCloudCreateBudget({ ...RIDECLOUD_DOCUMENTED_BUDGET, reserved: 1 }),
    /BUDGET_DRIFT/,
  );
  assert.throws(
    () => assertRideCloudCreatePlanIsRedactedSafe({ url: "https://x?token=abcdefghijkl" }),
    /SENSITIVE/,
  );
});
