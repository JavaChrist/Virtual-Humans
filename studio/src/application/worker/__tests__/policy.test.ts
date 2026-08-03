import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createWorkerPolicy,
  needsConcurrentHeartbeat,
  serializeWorkerPolicy,
  WORKER_POLICY_BOUNDS,
} from "../policy";
import { WorkerPolicyError } from "../errors";

test("policy — bornes et heartbeat < lease", () => {
  const p = createWorkerPolicy({ workerId: "w1" });
  assert.equal(p.claimLimit <= p.maximumJobsPerRun, true);
  assert.ok(p.heartbeatIntervalSeconds < p.leaseSeconds);
  assert.ok(p.claimLimit <= WORKER_POLICY_BOUNDS.claimLimit.max);
});

test("policy — claimLimit > maximumJobsPerRun rejeté", () => {
  assert.throws(
    () =>
      createWorkerPolicy({
        workerId: "w1",
        claimLimit: 10,
        maximumJobsPerRun: 5,
      }),
    (e: unknown) => e instanceof WorkerPolicyError && e.code === "claim_exceeds_max_jobs"
  );
});

test("policy — heartbeat >= lease rejeté", () => {
  assert.throws(
    () =>
      createWorkerPolicy({
        workerId: "w1",
        leaseSeconds: 30,
        heartbeatIntervalSeconds: 30,
      }),
    WorkerPolicyError
  );
});

test("policy — workerId vide / JWT-like rejeté", () => {
  assert.throws(() => createWorkerPolicy({ workerId: "  " }), WorkerPolicyError);
  assert.throws(
    () => createWorkerPolicy({ workerId: "aaa.bbb.ccc" }),
    WorkerPolicyError
  );
});

test("policy — durée / provider hors bornes", () => {
  assert.throws(
    () => createWorkerPolicy({ workerId: "w1", maximumRunDurationMs: 10 }),
    WorkerPolicyError
  );
  assert.throws(
    () => createWorkerPolicy({ workerId: "w1", maximumProviderCallsPerRun: 99 }),
    WorkerPolicyError
  );
});

test("policy — sérialisation sans secret", () => {
  const p = createWorkerPolicy({ workerId: "worker-a" });
  const s = serializeWorkerPolicy(p);
  assert.equal(s.workerId, "worker-a");
  assert.ok(!JSON.stringify(s).includes("token"));
});

test("policy — needsConcurrentHeartbeat false par défaut", () => {
  const p = createWorkerPolicy({ workerId: "w1" });
  // lease 90s > max run 25s → pas de heartbeat concurrent nécessaire
  assert.equal(needsConcurrentHeartbeat(p), false);
});
