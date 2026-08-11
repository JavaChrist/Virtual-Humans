/**
 * MT-009 — Motion Quality Control (deterministic + fake measurements only).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { money } from "@/domain/cost";
import {
  MotionTransferDomainError,
  type MotionTransferProviderOutputDescriptor,
} from "@/domain/motion";
import {
  aggregateMotionQcResult,
  assertMotionQcEvidenceSafe,
  createSyntheticMotionQcPolicy,
  evaluateMotionTechnicalQc,
  motionQcHandoffFromResult,
  MOTION_QC_MEASUREMENT_SET_VERSION,
} from "@/domain/motion/qc";
import {
  makeMinimalInput,
  makeReferenceSpec,
} from "@/domain/motion/__tests__/fixtures";
import { assertMotionQcFakeMeasurementAllowed } from "../assert-motion-qc-fake-allowed";
import { createFakeMotionQcMeasurementPort } from "../fake-motion-qc-measurement";
import {
  assertMotionQcEventRedacted,
  type MotionQcEvent,
} from "../motion-qc-events";
import {
  applyMotionQcHandoffToAttempt,
  createMotionQcOrchestrator,
} from "../motion-qc-orchestrator";
import { createMemoryMotionQcReportStore } from "../motion-qc-report";
import type { MotionTransferAttemptRecord } from "../motion-transfer-worker-orchestrator";

const AT = "2026-08-11T19:00:00.000Z";

function makeAutoPassInput(
  over: Parameters<typeof makeMinimalInput>[0] = {},
) {
  return makeMinimalInput({
    referenceSpec: makeReferenceSpec({
      humanValidationRequired: false,
      qcRequirements: [],
    }),
    qcRequirements: [{ code: "technical.decode", severity: "blocking" }],
    ...over,
  });
}

function makeOutput(
  over: Partial<MotionTransferProviderOutputDescriptor> = {},
): MotionTransferProviderOutputDescriptor {
  return {
    providerOutputRef: "out-opaque-mt009-1",
    mimeType: "video/mp4",
    sizeBytes: 1_024_000,
    durationSeconds: 8,
    width: 1080,
    height: 1920,
    fps: 24,
    providerChecksum: "sha256:out-mt009",
    completedAt: AT,
    ...over,
  };
}

function makeAttempt(
  over: Partial<MotionTransferAttemptRecord> = {},
): MotionTransferAttemptRecord {
  const motionInput = over.motionInput ?? makeAutoPassInput();
  return {
    attemptId: "att-mt009-1",
    jobId: "job-mt009-1",
    runId: "run-mt009-1",
    reservationId: "res-mt009-1",
    reserved: money(162, "EUR"),
    estimate: {
      schemaVersion: "1.0.0",
      estimatedCostMinor: 135,
      currency: "EUR",
      mode: "firm",
      pricingVersion: "test-1",
    },
    submitCount: 1,
    pollCount: 2,
    resubmitCount: 0,
    phase: "qc_pending",
    terminal: true,
    ledgerSettled: true,
    outputRef: "out-opaque-mt009-1",
    lateQuarantined: false,
    usageUnknown: false,
    reconciliationRequired: false,
    requestFingerprint: "fp-mt009",
    adapterVersion: "test",
    mediaBoundary: {
      sourceVideoRef: "ref:source",
      identityRefs: ["ref:id-1"],
    },
    motionInput,
    ...over,
  };
}

async function evaluateQc(opts: {
  attempt?: MotionTransferAttemptRecord;
  output?: MotionTransferProviderOutputDescriptor;
  motionInput?: ReturnType<typeof makeAutoPassInput>;
  fidelity?: "standard" | "high" | "critical";
  policy?: ReturnType<typeof createSyntheticMotionQcPolicy>;
  measurementOverrides?: Parameters<
    typeof createFakeMotionQcMeasurementPort
  >[0];
  defaultPolicy?: ReturnType<typeof createSyntheticMotionQcPolicy> | null;
  events?: MotionQcEvent[];
  reports?: ReturnType<typeof createMemoryMotionQcReportStore>;
}) {
  const motionInput = opts.motionInput ?? makeAutoPassInput();
  const attempt = opts.attempt ?? makeAttempt({ motionInput });
  const events = opts.events ?? [];
  const reports = opts.reports ?? createMemoryMotionQcReportStore();
  const orch = createMotionQcOrchestrator({
    measurements: createFakeMotionQcMeasurementPort(opts.measurementOverrides),
    reports,
    events: { emit: (e) => events.push(e) },
    defaultPolicy: opts.defaultPolicy === undefined ? undefined : opts.defaultPolicy,
  });
  const result = await orch.evaluate({
    attempt,
    output: opts.output ?? makeOutput(),
    motionInput,
    fidelity: opts.fidelity,
    policy: opts.policy,
    projectId: "proj-mt009",
    correlationId: "corr-mt009",
    actorId: "actor-test",
    nowIso: AT,
  });
  return { result, events, reports, attempt, orch };
}

// ── Technical QC ──────────────────────────────────────────────────────────

test("MT-009 technical PASS", () => {
  const tech = evaluateMotionTechnicalQc({
    output: makeOutput(),
    outputConstraints: makeAutoPassInput().output,
    sourceDurationSeconds: 8,
    policy: createSyntheticMotionQcPolicy(),
  });
  assert.equal(tech.status, "pass");
  assert.equal(tech.issues.length, 0);
});

test("MT-009 technical MIME invalid", () => {
  const tech = evaluateMotionTechnicalQc({
    output: makeOutput({ mimeType: "image/png" }),
    outputConstraints: makeAutoPassInput().output,
    policy: createSyntheticMotionQcPolicy(),
  });
  assert.equal(tech.status, "fail");
  assert.ok(tech.issues.some((i) => i.code === "technical.mime_invalid"));
});

test("MT-009 technical duration/fps/checksum invalid", () => {
  const tech = evaluateMotionTechnicalQc({
    output: makeOutput({
      durationSeconds: 30,
      fps: 60,
      providerChecksum: undefined,
    }),
    outputConstraints: makeAutoPassInput().output,
    sourceDurationSeconds: 8,
    policy: createSyntheticMotionQcPolicy(),
  });
  assert.equal(tech.status, "fail");
  assert.ok(tech.issues.some((i) => i.code === "technical.duration_mismatch"));
  assert.ok(tech.issues.some((i) => i.code === "technical.fps_mismatch"));
  assert.ok(tech.issues.some((i) => i.code === "technical.checksum_missing"));
});

test("MT-009 technical output descriptor incomplete", () => {
  const tech = evaluateMotionTechnicalQc({
    output: makeOutput({
      width: undefined,
      height: undefined,
      sizeBytes: 0,
      providerOutputRef: "",
    }),
    outputConstraints: makeAutoPassInput().output,
    policy: createSyntheticMotionQcPolicy(),
  });
  assert.equal(tech.status, "fail");
  assert.ok(tech.issues.some((i) => i.code === "technical.dimensions_missing"));
  assert.ok(tech.issues.some((i) => i.code === "technical.size_empty"));
});

test("MT-009 technical public URL rejected", () => {
  const tech = evaluateMotionTechnicalQc({
    output: makeOutput({
      providerOutputRef: "https://cdn.example/signed?token=x",
    }),
    outputConstraints: makeAutoPassInput().output,
    policy: createSyntheticMotionQcPolicy(),
  });
  assert.ok(tech.issues.some((i) => i.code === "technical.output_ref_public"));
});

test("MT-009 technical reject → overall reject (no motion claim)", async () => {
  const { result } = await evaluateQc({
    output: makeOutput({ mimeType: "text/plain" }),
  });
  assert.equal(result.result.overallStatus, "reject");
  assert.equal(result.handoff.outcome, "rejected");
  assert.equal(result.result.motionFidelity, "unknown");
});

// ── Measurement / layers ──────────────────────────────────────────────────

test("MT-009 measurement PASS → overall pass (no human required)", async () => {
  const { result } = await evaluateQc({});
  assert.equal(result.result.motionFidelity, "pass");
  assert.equal(result.result.identityFidelity, "pass");
  assert.equal(result.result.overallStatus, "pass");
  assert.equal(result.result.humanValidationRequired, false);
  assert.equal(result.handoff.outcome, "qc_passed");
  assert.equal(result.handoff.phase, "qc_passed");
});

test("MT-009 required FAIL → retry", async () => {
  const { result } = await evaluateQc({
    measurementOverrides: {
      overrides: [{ metricId: "motion_similarity", value: 0.1 }],
    },
  });
  assert.equal(result.result.overallStatus, "retry");
  assert.equal(result.handoff.outcome, "retry_recommended");
  assert.ok(
    result.result.issues.some(
      (i) => i.code === "motion_fidelity.fail" && i.requirementClass === "required",
    ),
  );
});

test("MT-009 required UNAVAILABLE → human_review", async () => {
  const { result } = await evaluateQc({
    measurementOverrides: {
      overrides: [
        {
          metricId: "identity_similarity",
          available: false,
          unavailableReason: "no_identity_signal",
        },
      ],
    },
  });
  assert.equal(result.result.overallStatus, "human_review");
  assert.equal(result.handoff.outcome, "needs_review");
  assert.ok(
    result.result.issues.some((i) => i.code === "identity_fidelity.unavailable"),
  );
});

test("MT-009 advisory FAIL does not force reject", async () => {
  const { result } = await evaluateQc({
    measurementOverrides: {
      overrides: [{ metricId: "outfit_similarity", value: 0.1 }],
    },
  });
  assert.equal(result.result.outfitFidelity, "fail");
  assert.ok(
    result.result.issues.some(
      (i) =>
        i.code === "outfit_fidelity.fail" && i.requirementClass === "advisory",
    ),
  );
  assert.equal(result.result.overallStatus, "pass");
});

test("MT-009 human_only requirement → human_review", async () => {
  const { result } = await evaluateQc({
    motionInput: makeAutoPassInput({
      qcRequirements: [
        {
          code: "sport.expert",
          severity: "blocking",
          humanValidationRequired: true,
        },
      ],
    }),
  });
  assert.equal(result.result.overallStatus, "human_review");
  assert.equal(result.result.humanValidationRequired, true);
  assert.equal(result.handoff.outcome, "needs_review");
});

test("MT-009 critical fidelity → human review even if metrics PASS", async () => {
  const { result } = await evaluateQc({
    fidelity: "critical",
    motionInput: makeAutoPassInput({
      motion: {
        preserveMotion: true,
        preserveTiming: true,
        fidelity: "critical",
        poseControl: "provider_native",
      },
    }),
  });
  assert.equal(result.result.motionFidelity, "pass");
  assert.equal(result.result.overallStatus, "human_review");
  assert.equal(result.result.humanValidationRequired, true);
  assert.equal(result.handoff.outcome, "needs_review");
});

test("MT-009 identity failure", async () => {
  const { result } = await evaluateQc({
    measurementOverrides: {
      overrides: [{ metricId: "identity_similarity", value: 0.2 }],
    },
  });
  assert.equal(result.result.identityFidelity, "fail");
  assert.equal(result.result.overallStatus, "retry");
});

test("MT-009 outfit failure (advisory)", async () => {
  const { result } = await evaluateQc({
    measurementOverrides: {
      overrides: [{ metricId: "outfit_similarity", value: 0.05 }],
    },
  });
  assert.equal(result.result.outfitFidelity, "fail");
  assert.notEqual(result.result.overallStatus, "reject");
});

test("MT-009 body integrity failure", async () => {
  const { result } = await evaluateQc({
    measurementOverrides: {
      overrides: [{ metricId: "body_integrity", value: 0.1 }],
    },
  });
  assert.equal(result.result.bodyIntegrity, "fail");
  assert.equal(result.result.overallStatus, "retry");
});

test("MT-009 temporal failure", async () => {
  const { result } = await evaluateQc({
    measurementOverrides: {
      overrides: [{ metricId: "temporal_consistency", value: 0.1 }],
    },
  });
  assert.equal(result.result.temporalConsistency, "fail");
  assert.equal(result.result.overallStatus, "retry");
});

test("MT-009 camera failure (advisory default)", async () => {
  const { result } = await evaluateQc({
    measurementOverrides: {
      overrides: [{ metricId: "camera_compliance", value: 0.1 }],
    },
  });
  assert.equal(result.result.cameraCompliance, "fail");
  assert.equal(result.result.overallStatus, "pass");
});

test("MT-009 full-body / hands-feet unavailable → advisory issues", async () => {
  const { result } = await evaluateQc({
    measurementOverrides: {
      overrides: [
        {
          metricId: "full_body_visibility",
          available: false,
          unavailableReason: "occluded",
        },
        {
          metricId: "hands_feet_confidence",
          available: false,
          unavailableReason: "low_res",
        },
      ],
    },
  });
  assert.ok(
    result.result.issues.some((i) => i.code === "full_body_visibility.unavailable"),
  );
  assert.ok(
    result.result.issues.some((i) => i.code === "hands_feet_confidence.unavailable"),
  );
  assert.equal(result.result.overallStatus, "pass");
});

test("MT-009 opaque checkpoints fail → retry", async () => {
  const { result } = await evaluateQc({
    measurementOverrides: {
      overrides: [
        {
          metricId: "checkpoint_observation",
          subjectId: "cp-1",
          value: 0.1,
        },
      ],
    },
  });
  assert.ok(
    result.result.checkpointResults.some(
      (c) => c.checkpointId === "cp-1" && c.status === "fail",
    ),
  );
  assert.ok(
    result.result.issues.some((i) => i.code === "checkpoint.fail:cp-1"),
  );
  assert.equal(result.result.overallStatus, "retry");
  assert.ok(
    !JSON.stringify(result.result).toLowerCase().includes("tai-chi"),
  );
});

test("MT-009 opaque body relation fail → retry", async () => {
  const { result } = await evaluateQc({
    measurementOverrides: {
      overrides: [
        {
          metricId: "body_relation_observation",
          subjectId: "br-1",
          value: 0.05,
        },
      ],
    },
  });
  assert.ok(
    result.result.issues.some((i) => i.code === "body_relation.fail:br-1"),
  );
  assert.equal(result.result.overallStatus, "retry");
});

test("MT-009 timing tolerance (phase_timing)", async () => {
  const { result } = await evaluateQc({
    measurementOverrides: {
      overrides: [{ metricId: "phase_timing", value: 0.9 }],
    },
  });
  assert.equal(result.result.temporalConsistency, "fail");
  assert.equal(result.result.overallStatus, "retry");
});

test("MT-009 confidence insuffisante → unavailable", async () => {
  const { result } = await evaluateQc({
    measurementOverrides: {
      overrides: [
        {
          metricId: "motion_similarity",
          value: 0.95,
          confidence: 0.1,
        },
      ],
    },
  });
  assert.equal(result.result.motionFidelity, "unknown");
  assert.ok(
    result.result.issues.some((i) => i.code === "motion_fidelity.unavailable"),
  );
  assert.equal(result.result.overallStatus, "human_review");
});

test("MT-009 evidence mismatch / hostile URL rejected", () => {
  assert.throws(() =>
    assertMotionQcEvidenceSafe({
      evidenceId: "ev-bad",
      role: "motion_qc_evidence",
      contentFingerprint: "fp",
      mimeType: "image/png",
      assetId: "https://evil.example/x",
      provenance: {
        correlationId: "c",
        measurementVersion: MOTION_QC_MEASUREMENT_SET_VERSION,
      },
    }),
  );
  assert.throws(() =>
    assertMotionQcEvidenceSafe({
      evidenceId: "https://cdn.evil/a.png",
      role: "motion_qc_evidence",
      contentFingerprint: "fp",
      mimeType: "image/png",
      provenance: {
        correlationId: "c",
        measurementVersion: MOTION_QC_MEASUREMENT_SET_VERSION,
      },
    }),
  );
});

test("MT-009 policy absente → pas de PASS", async () => {
  await assert.rejects(
    () =>
      evaluateQc({
        defaultPolicy: null,
        policy: undefined,
      }),
    (err: unknown) =>
      err instanceof MotionTransferDomainError &&
      err.code === "qc_rejected" &&
      err.publicMessage.includes("Policy QC absente"),
  );
});

test("MT-009 measurement version inconnue → pas de PASS", async () => {
  await assert.rejects(
    () =>
      evaluateQc({
        measurementOverrides: { measurementVersion: "unknown-v99" },
      }),
    (err: unknown) =>
      err instanceof MotionTransferDomainError &&
      err.code === "qc_rejected" &&
      err.publicMessage.includes("measurementVersion"),
  );
});

test("MT-009 duplicate QC idempotent", async () => {
  const reports = createMemoryMotionQcReportStore();
  const events: MotionQcEvent[] = [];
  const attempt = makeAttempt();
  const first = await evaluateQc({ attempt, reports, events });
  assert.equal(first.result.idempotentReplay, false);
  const second = await evaluateQc({ attempt, reports, events });
  assert.equal(second.result.idempotentReplay, true);
  assert.equal(
    second.result.result.overallStatus,
    first.result.result.overallStatus,
  );
  const activeCount = [...reports.records.values()].filter((r) => r.active)
    .length;
  assert.equal(activeCount, 1);
});

test("MT-009 quality report provenance", async () => {
  const { result } = await evaluateQc({});
  assert.equal(result.report.kind, "motion_qc_result");
  assert.equal(result.report.schemaVersion, "1.0.0");
  assert.equal(result.report.policyId, "synthetic-motion-qc");
  assert.ok(result.report.measurementVersion);
  assert.equal(result.report.correlationId, "corr-mt009");
  assert.equal(result.report.createdBy, "actor-test");
  assert.equal(result.report.source.runId, "run-mt009-1");
  assert.ok(!JSON.stringify(result.report).includes("https://"));
});

test("MT-009 fake Production guard", () => {
  assert.deepEqual(
    assertMotionQcFakeMeasurementAllowed({
      NODE_ENV: "production",
      VERCEL: undefined,
    }),
    { ok: false, reason: "production" },
  );
  assert.deepEqual(
    assertMotionQcFakeMeasurementAllowed({ VERCEL: "1", NODE_ENV: "test" }),
    { ok: false, reason: "vercel" },
  );
  assert.throws(() =>
    createFakeMotionQcMeasurementPort({
      env: { NODE_ENV: "production" },
    }),
  );
});

test("MT-009 redaction hostile events", () => {
  assert.throws(() =>
    assertMotionQcEventRedacted({
      type: "motion.qc.completed",
      correlationId: "c",
      projectId: "p",
      runId: "r",
      overallStatus: "https://leak.example/video.mp4",
    }),
  );
});

test("MT-009 no retry submit / no approval / no merge-export", async () => {
  const attempt = makeAttempt({ submitCount: 1, resubmitCount: 0 });
  const { result } = await evaluateQc({
    attempt,
    measurementOverrides: {
      overrides: [{ metricId: "motion_similarity", value: 0.1 }],
    },
  });
  const next = applyMotionQcHandoffToAttempt(attempt, result.handoff);
  assert.equal(next.submitCount, 1);
  assert.equal(next.resubmitCount, 0);
  assert.equal(result.handoff.outcome, "retry_recommended");
  assert.equal(next.phase, "retry_recommended");
  // Retry classification present — no job created
  const issue = result.result.issues.find((i) => i.code === "motion_fidelity.fail");
  assert.equal(issue?.reviewIntent, "RETRY_WITH_SAME_REFERENCE");
  assert.ok(!("approved" in result.report));
  assert.ok(!("merge" in result.report));
  assert.ok(!("export" in result.report));
});

test("MT-009 pass + humanValidationRequired stays needs_review", () => {
  const handoff = motionQcHandoffFromResult({
    schemaVersion: "1.0.0",
    motionFidelity: "pass",
    identityFidelity: "pass",
    outfitFidelity: "pass",
    cameraCompliance: "pass",
    bodyIntegrity: "pass",
    temporalConsistency: "pass",
    checkpointResults: [],
    issues: [],
    overallStatus: "pass",
    humanValidationRequired: true,
  });
  assert.equal(handoff.outcome, "needs_review");
  assert.equal(handoff.phase, "qc_pending");
});

test("MT-009 run non qc_pending → refus", async () => {
  await assert.rejects(
    () =>
      evaluateQc({
        attempt: makeAttempt({ phase: "polling" }),
      }),
    (err: unknown) =>
      err instanceof MotionTransferDomainError &&
      err.code === "qc_rejected" &&
      err.publicMessage.includes("qc_pending"),
  );
});

test("MT-009 observability events emitted (redacted)", async () => {
  const events: MotionQcEvent[] = [];
  await evaluateQc({ events });
  const types = events.map((e) => e.type);
  assert.ok(types.includes("motion.qc.started"));
  assert.ok(types.includes("motion.qc.technical.completed"));
  assert.ok(types.includes("motion.qc.measurements.completed"));
  assert.ok(types.includes("motion.qc.completed"));
  for (const e of events) {
    assertMotionQcEventRedacted(e);
  }
});

test("MT-009 aggregation decision table — technical first", () => {
  const policy = createSyntheticMotionQcPolicy();
  const result = aggregateMotionQcResult({
    technical: {
      status: "fail",
      issues: [
        {
          code: "technical.mime_invalid",
          severity: "blocking",
          message: "bad",
          layer: "technical",
          requirementClass: "required",
          retryClass: "nonRetryable",
          reviewIntent: "REJECT",
        },
      ],
    },
    measurements: {
      schemaVersion: "1.0.0",
      measurementVersion: MOTION_QC_MEASUREMENT_SET_VERSION,
      measuredAt: AT,
      measurements: [],
    },
    policy,
    fidelity: "standard",
    qcRequirements: [],
  });
  assert.equal(result.overallStatus, "reject");
});

test("MT-009 measurement set version constant", () => {
  assert.equal(MOTION_QC_MEASUREMENT_SET_VERSION, "mt009-measurement-1.0.0");
});
