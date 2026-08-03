import assert from "node:assert/strict";
import { test } from "node:test";
import type { ClaimedProductionJob } from "@/application/production/enqueue";
import {
  assertLeaseOwnership,
  leaseLogFields,
  requireLeaseOwnership,
} from "../lease-guard";
import { LeaseLostError, redactSecrets } from "../errors";

function job(over: Partial<ClaimedProductionJob> = {}): ClaimedProductionJob {
  return {
    jobId: "j1",
    projectId: "p1",
    runId: "r1",
    sceneId: "sc-1",
    stepId: "step:1",
    attemptId: "step:1:a1",
    action: "image",
    providerId: "openai",
    modelId: "gpt-image-1",
    leaseToken: "secret-lease-token-abc",
    leasedBy: "worker-1",
    payload: {
      planRevisionId: "plan-1",
      scenePackageSceneId: "sc-1",
      mode: "execute",
    },
    ...over,
  };
}

test("lease — valide", () => {
  const j = job();
  const r = assertLeaseOwnership({
    job: j,
    lease: {
      workerId: "worker-1",
      leaseToken: "secret-lease-token-abc",
      leasedAt: "2026-08-02T12:00:00.000Z",
      leaseExpiresAt: "2026-08-02T12:05:00.000Z",
    },
    workerId: "worker-1",
    nowMs: () => Date.parse("2026-08-02T12:01:00.000Z"),
  });
  assert.equal(r.ok, true);
});

test("lease — mauvais token / worker / expiré", () => {
  const j = job();
  assert.equal(
    assertLeaseOwnership({
      job: j,
      lease: {
        workerId: "worker-1",
        leaseToken: "other",
        leasedAt: "2026-08-02T12:00:00.000Z",
      },
      workerId: "worker-1",
      nowMs: () => 0,
    }).ok,
    false
  );
  assert.equal(
    assertLeaseOwnership({
      job: j,
      lease: {
        workerId: "worker-2",
        leaseToken: j.leaseToken,
        leasedAt: "2026-08-02T12:00:00.000Z",
      },
      workerId: "worker-1",
      nowMs: () => 0,
    }).ok,
    false
  );
  assert.equal(
    assertLeaseOwnership({
      job: j,
      lease: {
        workerId: "worker-1",
        leaseToken: j.leaseToken,
        leasedAt: "2026-08-02T12:00:00.000Z",
        leaseExpiresAt: "2026-08-02T12:00:00.000Z",
      },
      workerId: "worker-1",
      nowMs: () => Date.parse("2026-08-02T12:00:01.000Z"),
    }).ok,
    false
  );
});

test("lease — token absent des logs / erreurs publiques", () => {
  const j = job();
  const fields = leaseLogFields(j);
  assert.ok(!JSON.stringify(fields).includes("secret-lease"));
  assert.throws(
    () =>
      requireLeaseOwnership({
        job: j,
        lease: {
          workerId: "worker-1",
          leaseToken: "wrong",
          leasedAt: "2026-08-02T12:00:00.000Z",
        },
        workerId: "worker-1",
        nowMs: () => 0,
      }),
    (e: unknown) => {
      assert.ok(e instanceof LeaseLostError);
      assert.ok(!e.publicMessage.includes("secret-lease"));
      assert.ok(!String(e).includes("secret-lease-token-abc"));
      return true;
    }
  );
  const redacted = redactSecrets('lease_token: "secret-lease-token-abc"');
  assert.ok(!redacted.includes("secret-lease-token-abc"));
});
