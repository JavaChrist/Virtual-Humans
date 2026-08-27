/**
 * RideCloud storyboard/pack bind preflight — local only. No Production write.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PHASE_11A_SMOKE_PROJECT_ID } from "../phase-11a-openai-image-allowlist";
import { RIDECLOUD_REJECTED_UNSAFE_SOURCES } from "../ridecloud-input-preflight";
import {
  RIDECLOUD_DOCUMENTED_BUDGET,
  RIDECLOUD_PROJECT_DISPLAY_NAME,
} from "../ridecloud-separate-project-create-preflight";
import {
  RIDECLOUD_BIND_FUTURE_WRITES,
  RIDECLOUD_BIND_NEXT_AUTH,
  RIDECLOUD_BIND_PREFLIGHT_AUTH,
  RIDECLOUD_BIND_PREFLIGHT_VERDICT,
  RIDECLOUD_MEDIA_MANIFEST_KIND,
  RIDECLOUD_STORYBOARD_CONTRACT_KIND,
  assertRideCloudBindLocatorSafe,
  assertRideCloudBindPayloadIsTextual,
  assertRideCloudBindRejectsAutoSubstitution,
  assertRideCloudBindRejectsTechnicalDeliverable,
  buildRideCloudSeparateProjectBindPreflight,
  decideRideCloudBindApply,
  evaluateRideCloudBindReplay,
  plannedRideCloudHdVariantRefs,
  plannedRideCloudLockedPackRefs,
  plannedRideCloudNarrations,
  resolveRideCloudBindIdentity,
  type RideCloudBindLiveFacts,
} from "../ridecloud-separate-project-bind-preflight";

function readyFacts(overrides: Partial<RideCloudBindLiveFacts> = {}): RideCloudBindLiveFacts {
  const identity = resolveRideCloudBindIdentity();
  return {
    projectId: identity.projectId,
    workspaceId: identity.workspaceId,
    name: identity.name,
    status: "draft",
    briefId: identity.briefId,
    briefRevision: 1,
    mediaReferenceCount: 0,
    storyboardProjectCount: 0,
    generationPlanCount: 0,
    bindArtifactCount: 0,
    rideCloudRunCount: 0,
    rideCloudJobCount: 0,
    technicalProjectIntact: true,
    motionProjectIntact: true,
    budgetHard: RIDECLOUD_DOCUMENTED_BUDGET.hard,
    budgetCommitted: RIDECLOUD_DOCUMENTED_BUDGET.committed,
    budgetReserved: RIDECLOUD_DOCUMENTED_BUDGET.reserved,
    budgetAvailable: RIDECLOUD_DOCUMENTED_BUDGET.available,
    activeReservations: 0,
    voiceRuntime: "OFF",
    paidMediaRuntime: "OFF",
    voiceSubmitCount: 1,
    maySubmit: false,
    flagsOff: true,
    observedContract: null,
    observedManifest: null,
    ...overrides,
  };
}

test("RIDECLOUD-BIND-PREFLIGHT — READY plan, custom kinds and deterministic IDs", () => {
  const plan = buildRideCloudSeparateProjectBindPreflight();
  assert.equal(plan.auth, RIDECLOUD_BIND_PREFLIGHT_AUTH);
  assert.equal(plan.verdict, RIDECLOUD_BIND_PREFLIGHT_VERDICT);
  assert.equal(plan.nextAuth, RIDECLOUD_BIND_NEXT_AUTH);
  assert.equal(plan.identity.name, RIDECLOUD_PROJECT_DISPLAY_NAME);
  assert.deepEqual([...plan.support.kinds], [
    RIDECLOUD_STORYBOARD_CONTRACT_KIND,
    RIDECLOUD_MEDIA_MANIFEST_KIND,
  ]);
  assert.equal(plan.support.currentSchemaAllowsKinds, false);
  assert.equal(plan.support.futureWrites, RIDECLOUD_BIND_FUTURE_WRITES);
  assert.equal(plan.support.mutateBrief, false);
  assert.equal(plan.support.storyboardProject, false);
  const identity = resolveRideCloudBindIdentity();
  assert.equal(identity.projectId.startsWith("ba4a6021"), true);
  assert.equal(identity.briefId.startsWith("adea092a"), true);
  assert.notEqual(identity.contractId, identity.manifestId);
  assert.notEqual(identity.contractId, PHASE_11A_SMOKE_PROJECT_ID);
  assert.equal(plannedRideCloudNarrations().length, 6);
  assert.equal(plannedRideCloudLockedPackRefs().length, 12);
  assert.equal(plannedRideCloudHdVariantRefs().length, 5);
});

test("RIDECLOUD-BIND-PREFLIGHT — CREATE when bind artifacts are absent", () => {
  const decided = decideRideCloudBindApply(readyFacts());
  assert.equal(decided.decision, "CREATE");
  assert.equal(decided.futureWrites, 2);
});

test("RIDECLOUD-BIND-PREFLIGHT — EXISTING replay writes zero", () => {
  const identity = resolveRideCloudBindIdentity();
  const facts = readyFacts({
    observedContract: {
      id: identity.contractId,
      projectId: identity.projectId,
      kind: RIDECLOUD_STORYBOARD_CONTRACT_KIND,
      revision: 1,
      parentId: identity.briefId,
      fingerprint: identity.fingerprint,
    },
    observedManifest: {
      id: identity.manifestId,
      projectId: identity.projectId,
      kind: RIDECLOUD_MEDIA_MANIFEST_KIND,
      revision: 1,
      parentId: identity.contractId,
      fingerprint: identity.fingerprint,
    },
  });
  const decided = decideRideCloudBindApply(facts);
  assert.equal(decided.decision, "EXISTING");
  assert.equal(decided.futureWrites, 0);
  const replay = evaluateRideCloudBindReplay(facts);
  assert.equal(replay.mayBind, false);
  assert.equal(replay.futureWrites, 0);
});

test("RIDECLOUD-BIND-PREFLIGHT — refuses duplicate write on exact replay facts", () => {
  const identity = resolveRideCloudBindIdentity();
  assert.throws(
    () =>
      evaluateRideCloudBindReplay(
        readyFacts({
          observedContract: {
            id: identity.contractId,
            projectId: identity.projectId,
            kind: RIDECLOUD_STORYBOARD_CONTRACT_KIND,
            revision: 1,
            parentId: identity.briefId,
          },
        }),
      ),
    /REPLAY_NOT_EXISTING/,
  );
});

test("RIDECLOUD-BIND-PREFLIGHT — refuses wrong project, partial state and divergent payload", () => {
  assert.equal(
    decideRideCloudBindApply(readyFacts({ projectId: PHASE_11A_SMOKE_PROJECT_ID })).refuseCode,
    "WRONG_PROJECT",
  );
  const identity = resolveRideCloudBindIdentity();
  assert.equal(
    decideRideCloudBindApply(
      readyFacts({
        observedContract: {
          id: identity.contractId,
          projectId: identity.projectId,
          kind: RIDECLOUD_STORYBOARD_CONTRACT_KIND,
          revision: 1,
          parentId: identity.briefId,
        },
      }),
    ).refuseCode,
    "PARTIAL_STATE",
  );
  assert.equal(
    decideRideCloudBindApply(
      readyFacts({
        observedContract: {
          id: identity.contractId,
          projectId: identity.projectId,
          kind: RIDECLOUD_STORYBOARD_CONTRACT_KIND,
          revision: 1,
          parentId: identity.briefId,
        },
        observedManifest: {
          id: identity.manifestId,
          projectId: identity.projectId,
          kind: RIDECLOUD_MEDIA_MANIFEST_KIND,
          revision: 1,
          parentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
      }),
    ).refuseCode,
    "MANIFEST_DIVERGED",
  );
});

test("RIDECLOUD-BIND-PREFLIGHT — refuses local paths, signed URLs and blobs", () => {
  assert.throws(() => assertRideCloudBindLocatorSafe("C:\\\\tmp\\\\ridecloud-pack\\\\shot.png"), /UNSAFE|SENSITIVE/);
  assert.throws(() => assertRideCloudBindLocatorSafe("studio/.tmp/ridecloud-pack/logo.png"), /UNSAFE|SENSITIVE/);
  assert.throws(
    () => assertRideCloudBindLocatorSafe("https://example.com/file?X-Amz-Signature=abcdef123456"),
    /UNSAFE|SENSITIVE/,
  );
  assert.throws(() => assertRideCloudBindLocatorSafe("data:image/png;base64,AAAA"), /UNSAFE|SENSITIVE/);
});

test("RIDECLOUD-BIND-PREFLIGHT — refuses technical 11A/11B/11C deliverables and auto substitution", () => {
  assert.throws(
    () => assertRideCloudBindRejectsTechnicalDeliverable(RIDECLOUD_REJECTED_UNSAFE_SOURCES[0]),
    /TECHNICAL_PROOF/,
  );
  assert.throws(
    () => assertRideCloudBindRejectsAutoSubstitution({ preferHd: true, replaceLocked720: true }),
    /AUTO_SUBSTITUTION/,
  );
});

test("RIDECLOUD-BIND-PREFLIGHT — refuses ambiguous parentage and media in payload", () => {
  assert.throws(() => assertRideCloudBindPayloadIsTextual({ parent: "current" }), /AMBIGUOUS/);
  assert.throws(() => assertRideCloudBindPayloadIsTextual({ parent: "latest" }), /AMBIGUOUS/);
  assert.throws(
    () => assertRideCloudBindPayloadIsTextual({ path: "studio/.tmp/ridecloud-pack/a.png" }),
    /UNSAFE/,
  );
});
