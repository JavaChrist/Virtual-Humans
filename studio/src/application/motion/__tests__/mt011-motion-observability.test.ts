/**
 * MT-011 — Motion Transfer Observability & Security (hostile fixtures only).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MOTION_DATA_CLASSIFICATION,
  MOTION_PRIVACY_DECISION_CONTRACT_VERSION,
  MOTION_SANITIZER_VERSION,
  MOTION_SECURITY_GATES_VERSION,
  assertMotionPrivacyDecisionsOpen,
  assertMotionSurfaceRedacted,
  createSyntheticAcceptedPrivacyDecisions,
  evaluateMotionPrivacyDecisions,
  evaluateMotionSecurityGates,
  isForbiddenInLogs,
  sanitizeMotionString,
  sanitizeMotionValue,
} from "@/domain/motion";
import {
  MOTION_OBSERVABILITY_CATALOG_VERSION,
  MOTION_OBSERVABILITY_EVENT_TYPES,
  createMemoryMotionObservabilitySink,
  emitMotionObservabilityEvent,
  mapLegacyMotionEventType,
} from "../motion-observability";
import { assertMotionEventRedacted } from "../motion-transfer-worker-events";
import { assertMotionQcEventRedacted } from "../motion-qc-events";
import { assertMotionReviewEventRedacted } from "../motion-review-events";
import { assertMotionQcFakeMeasurementAllowed } from "../assert-motion-qc-fake-allowed";
import { evaluateMotionTransferPrivacyGate } from "@/infrastructure/providers/motion-transfer/privacy-gate";

const AT = "2026-08-11T21:00:00.000Z";
const BIG_B64 = "A".repeat(240) + "==";

test("MT-011 catalog version + coverage", () => {
  assert.equal(MOTION_OBSERVABILITY_CATALOG_VERSION, "mt011-events-1.0.0");
  assert.equal(MOTION_SANITIZER_VERSION, "mt011-sanitize-1.0.0");
  assert.equal(MOTION_SECURITY_GATES_VERSION, "mt011-gates-1.0.0");
  assert.ok(MOTION_OBSERVABILITY_EVENT_TYPES.includes("motion.route.requested"));
  assert.ok(MOTION_OBSERVABILITY_EVENT_TYPES.includes("motion.security.policy_denied"));
  assert.ok(MOTION_OBSERVABILITY_EVENT_TYPES.length >= 30);
});

test("MT-011 sanitize — fal key nested error", () => {
  const out = sanitizeMotionValue({
    error: { cause: { message: "FAL_KEY=fal-secret-abc123456789 leaked" } },
  }) as { error: { cause: { message: string } } };
  assert.ok(!String(out.error.cause.message).includes("fal-secret"));
  assert.ok(String(out.error.cause.message).includes("[REDACTED_MOTION]"));
});

test("MT-011 sanitize — Bearer token", () => {
  const s = sanitizeMotionString("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb");
  assert.ok(!s.includes("Bearer eyJ"));
});

test("MT-011 sanitize — signed Supabase URL", () => {
  const s = sanitizeMotionString(
    "https://xyz.supabase.co/storage/v1/object/sign/bucket/x?token=abc&X-Amz-Signature=deadbeef",
  );
  assert.equal(s, "[REDACTED_MOTION]");
});

test("MT-011 sanitize — fal CDN query string", () => {
  const s = sanitizeMotionString(
    "https://v3.fal.media/files/out.mp4?signature=abc123&expires=999",
  );
  assert.ok(!s.includes("fal.media"));
});

test("MT-011 sanitize — data URL", () => {
  const s = sanitizeMotionString("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB");
  assert.ok(!s.includes("base64"));
});

test("MT-011 sanitize — large base64", () => {
  const s = sanitizeMotionString(`prefix ${BIG_B64} suffix`);
  assert.ok(!s.includes("AAAA"));
});

test("MT-011 sanitize — prompt field", () => {
  const out = sanitizeMotionValue({
    prompt: "Do the Tai-Chi form slowly with identity lock",
    negativePrompt: "cartoon",
  }) as Record<string, string>;
  assert.equal(out.prompt, "[REDACTED_MOTION]");
  assert.equal(out.negativePrompt, "[REDACTED_MOTION]");
});

test("MT-011 sanitize — private source video / identity", () => {
  const out = sanitizeMotionValue({
    sourceVideo: "https://private.cdn/video.mp4?sig=1",
    identityImage: "data:image/png;base64,abc",
    mimeType: "video/mp4",
    durationSeconds: 8,
  }) as Record<string, unknown>;
  assert.equal(out.sourceVideo, "[REDACTED_MOTION]");
  assert.equal(out.identityImage, "[REDACTED_MOTION]");
  assert.equal(out.mimeType, "video/mp4");
  assert.equal(out.durationSeconds, 8);
});

test("MT-011 sanitize — human comment", () => {
  const out = sanitizeMotionValue({
    comment: "Subject looks like real person X — reject",
  }) as { comment: string };
  assert.equal(out.comment, "[REDACTED_MOTION]");
});

test("MT-011 sanitize — raw provider payload", () => {
  const out = sanitizeMotionValue({
    providerResponse: { video: { url: "https://fal.media/x" }, raw: { sk: "sk-abcdefghijklmnopqrstuvwxyz" } },
  }) as { providerResponse: string };
  assert.equal(out.providerResponse, "[REDACTED_MOTION]");
});

test("MT-011 sanitize — keep HTTP / correlation metadata", () => {
  const out = sanitizeMotionValue(
    {
      correlationId: "corr-mt011",
      httpStatus: 429,
      providerErrorCode: "rate_limited",
      networkAttempts: 2,
      stage: "poll",
    },
    {
      preserveKeys: [
        "correlationId",
        "httpStatus",
        "providerErrorCode",
        "networkAttempts",
        "stage",
      ],
    },
  ) as Record<string, unknown>;
  assert.equal(out.correlationId, "corr-mt011");
  assert.equal(out.httpStatus, 429);
  assert.equal(out.networkAttempts, 2);
});

test("MT-011 assert surface — hostile leaks", () => {
  assert.throws(() =>
    assertMotionSurfaceRedacted({ url: "https://evil.example/x" }),
  );
  assert.throws(() =>
    assertMotionSurfaceRedacted({ token: "sk-abcdefghijklmnopqrstuv" }),
  );
  assert.throws(() =>
    assertMotionSurfaceRedacted({ a: "X-Amz-Signature=abc" }),
  );
});

test("MT-011 emit event — deterministic + immutable + redacted", () => {
  const sink = createMemoryMotionObservabilitySink();
  const a = emitMotionObservabilityEvent(sink, {
    type: "motion.security.redaction_applied",
    correlationId: "corr-1",
    projectId: "proj-1",
    workspaceId: "ws-1",
    data: {
      prompt: "secret prompt",
      httpStatus: 200,
      mimeType: "video/mp4",
    },
  });
  const b = emitMotionObservabilityEvent(sink, {
    type: "motion.security.redaction_applied",
    correlationId: "corr-1",
    projectId: "proj-1",
    workspaceId: "ws-1",
    data: {
      prompt: "secret prompt",
      httpStatus: 200,
      mimeType: "video/mp4",
    },
  });
  assert.equal(a.schemaVersion, MOTION_OBSERVABILITY_CATALOG_VERSION);
  assert.deepEqual(a.data, b.data);
  assert.throws(() => {
    (a as { correlationId: string }).correlationId = "mutated";
  });
  assert.equal(sink.events.length, 2);
  assert.ok(!JSON.stringify(a).includes("secret prompt"));
});

test("MT-011 emit — correlation required", () => {
  assert.throws(() =>
    emitMotionObservabilityEvent(undefined, {
      type: "motion.route.failed",
      correlationId: "",
    }),
  );
});

test("MT-011 legacy event mapping", () => {
  assert.equal(mapLegacyMotionEventType("motion.poll.scheduled"), "motion.poll.started");
  assert.equal(mapLegacyMotionEventType("motion.review.opened"), "motion.review.requested");
  assert.equal(mapLegacyMotionEventType("motion.late_result"), "motion.output.quarantined");
});

test("MT-011 classification — secrets forbidden in logs", () => {
  assert.ok(isForbiddenInLogs(MOTION_DATA_CLASSIFICATION.FAL_KEY));
  assert.ok(isForbiddenInLogs(MOTION_DATA_CLASSIFICATION.prompt));
  assert.ok(isForbiddenInLogs(MOTION_DATA_CLASSIFICATION.identityImage));
  assert.equal(MOTION_DATA_CLASSIFICATION.mimeType, "PRIVATE_MEDIA_METADATA");
});

test("MT-011 privacy — missing decisions blocked", () => {
  const ev = evaluateMotionPrivacyDecisions(null, AT);
  assert.equal(ev.status, "blocked");
  assert.ok(ev.missing.length === 5);
});

test("MT-011 privacy — expired consent refused", () => {
  const set = createSyntheticAcceptedPrivacyDecisions({
    workspaceId: "ws",
    expiresAt: "2020-01-01T00:00:00.000Z",
  });
  const ev = evaluateMotionPrivacyDecisions(set, AT);
  assert.equal(ev.status, "blocked");
  assert.ok(ev.expired.length > 0);
  assert.throws(() => assertMotionPrivacyDecisionsOpen(set, AT));
});

test("MT-011 privacy — accepted synthetic", () => {
  const set = createSyntheticAcceptedPrivacyDecisions({
    workspaceId: "ws",
    projectId: "p",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  const ev = evaluateMotionPrivacyDecisions(set, AT);
  assert.equal(ev.status, "accepted");
  assert.equal(ev.contractVersion, MOTION_PRIVACY_DECISION_CONTRACT_VERSION);
});

test("MT-011 privacy legacy gate still blocked by default", () => {
  const g = evaluateMotionTransferPrivacyGate();
  assert.equal(g.status, "blocked");
});

test("MT-011 security gates — flags incomplete", () => {
  const r = evaluateMotionSecurityGates({
    env: { NODE_ENV: "test" },
    nowIso: AT,
    registry: { enabled: true, verificationStatus: "VERIFIED" },
    privacy: createSyntheticAcceptedPrivacyDecisions({
      workspaceId: "ws",
      expiresAt: "2099-01-01T00:00:00.000Z",
    }),
    mediaValid: true,
    budgetValid: true,
    remoteMigrationApplied: true,
  });
  assert.equal(r.ok, false);
  assert.ok(r.denied.includes("capability_disabled"));
  assert.ok(r.denied.includes("paid_disabled"));
});

test("MT-011 security gates — Registry UNVERIFIED", () => {
  const r = evaluateMotionSecurityGates({
    env: {
      MOTION_TRANSFER_ENABLED: "1",
      MOTION_TRANSFER_PAID_ENABLED: "1",
      MOTION_TRANSFER_FAL_ENABLED: "1",
      MOTION_TRANSFER_WORKER_ENABLED: "1",
    },
    nowIso: AT,
    registry: { enabled: false, verificationStatus: "UNVERIFIED" },
    privacy: createSyntheticAcceptedPrivacyDecisions({
      workspaceId: "ws",
      expiresAt: "2099-01-01T00:00:00.000Z",
    }),
    mediaValid: true,
    budgetValid: true,
    remoteMigrationApplied: true,
  });
  assert.ok(r.denied.includes("registry_unverified"));
  assert.ok(r.denied.includes("registry_disabled"));
});

test("MT-011 security gates — remote migration absent signaled (no apply)", () => {
  const r = evaluateMotionSecurityGates({
    env: {
      MOTION_TRANSFER_ENABLED: "1",
      MOTION_TRANSFER_PAID_ENABLED: "1",
      MOTION_TRANSFER_FAL_ENABLED: "1",
      MOTION_TRANSFER_WORKER_ENABLED: "1",
    },
    nowIso: AT,
    registry: { enabled: true, verificationStatus: "VERIFIED" },
    privacy: createSyntheticAcceptedPrivacyDecisions({
      workspaceId: "ws",
      expiresAt: "2099-01-01T00:00:00.000Z",
    }),
    mediaValid: true,
    budgetValid: true,
    remoteMigrationApplied: false,
  });
  assert.ok(r.denied.includes("remote_migration_absent"));
});

test("MT-011 security gates — scope mismatch", () => {
  const r = evaluateMotionSecurityGates({
    env: {
      MOTION_TRANSFER_ENABLED: "1",
      MOTION_TRANSFER_PAID_ENABLED: "1",
      MOTION_TRANSFER_FAL_ENABLED: "1",
      MOTION_TRANSFER_WORKER_ENABLED: "1",
    },
    nowIso: AT,
    registry: { enabled: true, verificationStatus: "VERIFIED" },
    privacy: createSyntheticAcceptedPrivacyDecisions({
      workspaceId: "ws-a",
      expiresAt: "2099-01-01T00:00:00.000Z",
    }),
    mediaValid: true,
    budgetValid: true,
    remoteMigrationApplied: true,
    workspaceId: "ws-a",
    projectWorkspaceId: "ws-b",
  });
  assert.ok(r.denied.includes("scope_mismatch"));
});

test("MT-011 fake Production forbidden", () => {
  assert.deepEqual(
    assertMotionQcFakeMeasurementAllowed({ NODE_ENV: "production" }),
    { ok: false, reason: "production" },
  );
  const r = evaluateMotionSecurityGates({
    env: { NODE_ENV: "production", VERCEL: "1" },
    nowIso: AT,
    fakeRequested: true,
  });
  assert.ok(r.denied.includes("fake_forbidden"));
});

test("MT-011 no automatic retry semantics in observability emit", () => {
  const sink = createMemoryMotionObservabilitySink();
  emitMotionObservabilityEvent(sink, {
    type: "motion.submit.failed",
    correlationId: "c",
    data: { retryable: false, networkAttempts: 1 },
  });
  assert.equal(sink.events[0]!.data?.networkAttempts, 1);
  // Facade never schedules retries — single emit only
  assert.equal(sink.events.length, 1);
});

test("MT-011 legacy asserts use central sanitizer", () => {
  assert.throws(() =>
    assertMotionEventRedacted({
      type: "motion.job.claimed",
      correlationId: "c",
      projectId: "p",
      runId: "r",
      jobId: "j",
      attemptId: "a",
      status: "https://leak",
    }),
  );
  assert.throws(() =>
    assertMotionQcEventRedacted({
      type: "motion.qc.completed",
      correlationId: "c",
      projectId: "p",
      runId: "r",
      overallStatus: "Bearer sk-abcdefghijklmnopqrstuv",
    }),
  );
  assert.throws(() =>
    assertMotionReviewEventRedacted({
      type: "motion.review.conflict",
      correlationId: "c",
      projectId: "p",
      decision: "data:image/png;base64,AAAA",
    }),
  );
});

test("MT-011 security policy_denied event", () => {
  const sink = createMemoryMotionObservabilitySink();
  const gates = evaluateMotionSecurityGates({
    env: {},
    nowIso: AT,
  });
  emitMotionObservabilityEvent(sink, {
    type: "motion.security.policy_denied",
    correlationId: "corr-deny",
    data: { denied: [...gates.denied] },
  });
  assert.equal(sink.events[0]!.type, "motion.security.policy_denied");
  assert.ok(Array.isArray(sink.events[0]!.data?.denied));
});
