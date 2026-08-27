#!/usr/bin/env node
/**
 * RideCloud separate project create — local identity + replay contract only.
 * Never calls create_director_project_with_brief. No provider, Storage, or media.
 */
import {
  RIDECLOUD_PROJECT_CREATE_APPLY_AUTH,
  RIDECLOUD_PROJECT_CREATE_APPLY_NEXT_AUTH,
  RIDECLOUD_PROJECT_CREATE_APPLY_VERDICT_EXISTING,
  evaluateRideCloudCreateReplay,
  redactRideCloudCreateReport,
  resolveRideCloudCreateIdentity,
  rideCloudCreateRpcName,
  type RideCloudCreateLiveFacts,
} from "@/application/production/ridecloud-separate-project-create-apply";
import { RIDECLOUD_DOCUMENTED_BUDGET } from "@/application/production/ridecloud-separate-project-create-preflight";

const identity = resolveRideCloudCreateIdentity();
const exactRow = {
  id: identity.projectId,
  workspaceId: identity.workspaceId,
  name: identity.name,
  status: "draft",
  correlationId: identity.correlationId,
};
const replayFacts: RideCloudCreateLiveFacts = {
  supabaseProjectRef: "ejdbksxaswhdtsudnmvi",
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
  projectById: exactRow,
  projectsByExactName: [exactRow],
  briefRev1: {
    id: identity.briefId,
    projectId: identity.projectId,
    revision: 1,
    artifactType: "video_project_brief",
  },
  storyboardArtifactCount: 0,
  technicalProjectIntact: true,
  motionProjectIntact: true,
};
const replay = evaluateRideCloudCreateReplay(replayFacts);

console.log(
  JSON.stringify(
    {
      ok: true,
      auth: RIDECLOUD_PROJECT_CREATE_APPLY_AUTH,
      nextAuth: RIDECLOUD_PROJECT_CREATE_APPLY_NEXT_AUTH,
      rpc: rideCloudCreateRpcName(),
      rpcCalls: 0,
      mayCreate: replay.mayCreate,
      replayVerdict: RIDECLOUD_PROJECT_CREATE_APPLY_VERDICT_EXISTING,
      report: redactRideCloudCreateReport(identity),
    },
    null,
    2,
  ),
);
