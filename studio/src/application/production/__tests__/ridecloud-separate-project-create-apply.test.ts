/**
 * RideCloud separate project create apply — local decision tests. No live write.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PHASE_11A_SMOKE_PROJECT_ID } from "../phase-11a-openai-image-allowlist";
import {
  RIDECLOUD_LOCKED_CLAIM,
  RIDECLOUD_LOCKED_CTA,
  RIDECLOUD_LOCKED_SIGNATURE,
  RIDECLOUD_PROJECT_KEY,
} from "../ridecloud-input-preflight";
import {
  RIDECLOUD_CANONICAL_WORKSPACE_ID,
  RIDECLOUD_DOCUMENTED_BUDGET,
  RIDECLOUD_PROJECT_DISPLAY_NAME,
} from "../ridecloud-separate-project-create-preflight";
import {
  RIDECLOUD_BRIEF_ID_PREFIX,
  RIDECLOUD_FINGERPRINT_PREFIX,
  RIDECLOUD_PROJECT_CREATE_APPLY_AUTH,
  RIDECLOUD_PROJECT_CREATE_APPLY_NEXT_AUTH,
  RIDECLOUD_PROJECT_CREATE_APPLY_VERDICT_EXISTING,
  RIDECLOUD_PROJECT_ID_PREFIX,
  RIDECLOUD_SUPABASE_PROJECT_REF,
  assertRideCloudBriefStaysTextual,
  buildRideCloudCreateBriefValue,
  decideRideCloudCreateApply,
  evaluateRideCloudCreateReplay,
  redactRideCloudCreateReport,
  resolveRideCloudCreateIdentity,
  rideCloudCreateRpcName,
  type RideCloudCreateLiveFacts,
} from "../ridecloud-separate-project-create-apply";

function readyFacts(overrides: Partial<RideCloudCreateLiveFacts> = {}): RideCloudCreateLiveFacts {
  return {
    supabaseProjectRef: RIDECLOUD_SUPABASE_PROJECT_REF,
    supabaseHostAllowlisted: true,
    workspaceFound: true,
    migrationCount: 32,
    budgetHard: RIDECLOUD_DOCUMENTED_BUDGET.hard,
    budgetCommitted: RIDECLOUD_DOCUMENTED_BUDGET.committed,
    budgetReserved: RIDECLOUD_DOCUMENTED_BUDGET.reserved,
    budgetAvailable: RIDECLOUD_DOCUMENTED_BUDGET.available,
    activeReservations: 0,
    voiceSubmitCount: 1,
    maySubmit: false,
    flagsOff: true,
    voiceRuntime: "OFF",
    paidMediaRuntime: "OFF",
    projectById: null,
    projectsByExactName: [],
    briefRev1: null,
    storyboardArtifactCount: 0,
    technicalProjectIntact: true,
    motionProjectIntact: true,
    ...overrides,
  };
}

test("RIDECLOUD-CREATE-APPLY — identity matches preflight prefixes", () => {
  assert.equal(
    RIDECLOUD_PROJECT_CREATE_APPLY_AUTH,
    "AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_IDEMPOTENT_NO_PROVIDER",
  );
  const identity = resolveRideCloudCreateIdentity();
  assert.equal(identity.projectKey, RIDECLOUD_PROJECT_KEY);
  assert.equal(identity.name, RIDECLOUD_PROJECT_DISPLAY_NAME);
  assert.equal(identity.workspaceId, RIDECLOUD_CANONICAL_WORKSPACE_ID);
  assert.equal(identity.projectId.startsWith(RIDECLOUD_PROJECT_ID_PREFIX), true);
  assert.equal(identity.briefId.startsWith(RIDECLOUD_BRIEF_ID_PREFIX), true);
  assert.equal(identity.fingerprint.startsWith(RIDECLOUD_FINGERPRINT_PREFIX), true);
  assert.notEqual(identity.projectId, PHASE_11A_SMOKE_PROJECT_ID);
  assert.equal(rideCloudCreateRpcName(), "create_director_project_with_brief");
  assert.equal(
    RIDECLOUD_PROJECT_CREATE_APPLY_NEXT_AUTH,
    "AUTH_RIDECLOUD_SEPARATE_PROJECT_STORYBOARD_PACK_BIND_PREFLIGHT_NO_PROVIDER",
  );
});

test("RIDECLOUD-CREATE-APPLY — CREATE when empty and preconditions pass", () => {
  const decided = decideRideCloudCreateApply(readyFacts());
  assert.equal(decided.decision, "CREATE");
  assert.equal(decided.rpcCalls, 1);
});

test("RIDECLOUD-CREATE-APPLY — EXISTING when exact project and brief already match", () => {
  const identity = resolveRideCloudCreateIdentity();
  const row = {
    id: identity.projectId,
    workspaceId: identity.workspaceId,
    name: identity.name,
    status: "draft",
    correlationId: identity.correlationId,
  };
  const decided = decideRideCloudCreateApply(
    readyFacts({
      projectById: row,
      projectsByExactName: [row],
      briefRev1: {
        id: identity.briefId,
        projectId: identity.projectId,
        revision: 1,
        artifactType: "video_project_brief",
      },
    }),
  );
  assert.equal(decided.decision, "EXISTING");
  assert.equal(decided.rpcCalls, 0);
  const replay = evaluateRideCloudCreateReplay(
    readyFacts({
      projectById: row,
      projectsByExactName: [row],
      briefRev1: {
        id: identity.briefId,
        projectId: identity.projectId,
        revision: 1,
        artifactType: "video_project_brief",
      },
    }),
  );
  assert.equal(replay.verdict, RIDECLOUD_PROJECT_CREATE_APPLY_VERDICT_EXISTING);
  assert.equal(replay.mayCreate, false);
  assert.equal(replay.rpcCalls, 0);
});

test("RIDECLOUD-CREATE-APPLY — refuses collisions, partial state, flags and budget drift", () => {
  const identity = resolveRideCloudCreateIdentity();
  assert.equal(
    decideRideCloudCreateApply(
      readyFacts({
        projectsByExactName: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            workspaceId: identity.workspaceId,
            name: identity.name,
            status: "draft",
            correlationId: "other-project",
          },
        ],
      }),
    ).refuseCode,
    "NAME_COLLISION",
  );
  assert.equal(
    decideRideCloudCreateApply(
      readyFacts({
        projectById: {
          id: identity.projectId,
          workspaceId: identity.workspaceId,
          name: identity.name,
          status: "draft",
          correlationId: identity.correlationId,
        },
      }),
    ).refuseCode,
    "PARTIAL_STATE",
  );
  assert.equal(decideRideCloudCreateApply(readyFacts({ maySubmit: true })).refuseCode, "PRECONDITION");
  assert.equal(decideRideCloudCreateApply(readyFacts({ budgetReserved: 1 })).refuseCode, "PRECONDITION");
  assert.equal(
    decideRideCloudCreateApply(readyFacts({ supabaseHostAllowlisted: false })).refuseCode,
    "HOST_NOT_ALLOWLISTED",
  );
  assert.equal(
    decideRideCloudCreateApply(readyFacts({ storyboardArtifactCount: 1 })).refuseCode,
    "STORYBOARD_ALREADY_PRESENT",
  );
});

test("RIDECLOUD-CREATE-APPLY — brief stays locked, textual and redacted-safe", () => {
  const brief = buildRideCloudCreateBriefValue("2026-08-27T12:00:00.000Z");
  assertRideCloudBriefStaysTextual(brief);
  assert.equal(brief.projectName, RIDECLOUD_PROJECT_DISPLAY_NAME);
  assert.equal(brief.subjectDescription, RIDECLOUD_LOCKED_CLAIM);
  assert.equal(brief.callToAction, RIDECLOUD_LOCKED_CTA);
  assert.equal(brief.schemaVersion, "1.0.0");
  assert.equal(brief.revision, 1);
  assert.equal(Array.isArray(brief.mediaReferences) && brief.mediaReferences.length === 0, true);
  const report = redactRideCloudCreateReport(resolveRideCloudCreateIdentity());
  assert.equal(report.signatureAuthority, RIDECLOUD_LOCKED_SIGNATURE);
  assert.equal(report.fingerprintPrefix, RIDECLOUD_FINGERPRINT_PREFIX);
});
