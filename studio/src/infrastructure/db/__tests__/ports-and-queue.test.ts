/**
 * Queue / idempotency / events adapters with fake client (VHS-113).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSupabaseProductionEventPort,
  createSupabaseProductionIdempotencyPort,
  createSupabaseProductionJobQueue,
} from "../index";

const WS = "11111111-1111-4111-8111-111111111111";

test("JobQueue — enqueue + claim RPC args (fake)", async () => {
  const rpcs: { name: string; args: Record<string, unknown> }[] = [];
  const inserts: unknown[] = [];
  const fake = {
    from(table: string) {
      assert.equal(table, "production_jobs");
      return {
        insert(row: unknown) {
          inserts.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
    rpc(name: string, args: Record<string, unknown>) {
      rpcs.push({ name, args });
      if (name === "claim_production_jobs") {
        return Promise.resolve({
          data: [
            {
              id: "j1",
              workspace_id: WS,
              project_id: "p1",
              run_id: "r1",
              scene_id: "s1",
              step_id: "st1",
              attempt_id: "a1",
              action: "video",
              provider_id: "fal",
              model_id: "m1",
              status: "leased",
              priority: 10,
              lease_token: "33333333-3333-4333-8333-333333333333",
              leased_by: "worker-1",
              payload: { stepRef: "st1" },
              result: null,
              error: null,
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };

  const q = createSupabaseProductionJobQueue({
    client: fake as never,
    workspaceId: WS,
  });
  await q.enqueue({
    id: "j1",
    projectId: "p1",
    runId: "r1",
    sceneId: "s1",
    stepId: "st1",
    attemptId: "a1",
    action: "video",
    providerId: "fal",
    modelId: "m1",
    payload: { stepRef: "st1" },
  });
  assert.equal((inserts[0] as { status: string }).status, "queued");
  assert.ok(!JSON.stringify(inserts[0]).includes("https://"));

  const claimed = await q.claim("worker-1", 5, 60);
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0]!.leaseToken, "33333333-3333-4333-8333-333333333333");
  assert.deepEqual(rpcs[0]!.args, {
    p_worker_id: "worker-1",
    p_limit: 5,
    p_lease_seconds: 60,
  });

});

test("JobQueue — reschedule RPC args (fake)", async () => {
  const rpcs: { name: string; args: Record<string, unknown> }[] = [];
  const fake = {
    from() {
      return { insert: async () => ({ error: null }) };
    },
    rpc(name: string, args: Record<string, unknown>) {
      rpcs.push({ name, args });
      return Promise.resolve({
        data: {
          id: "j1",
          workspace_id: WS,
          project_id: "p1",
          run_id: "r1",
          scene_id: "s1",
          step_id: "st1",
          attempt_id: "a1",
          action: "video",
          provider_id: "fal",
          model_id: "m1",
          status: "queued",
          priority: 10,
          lease_token: null,
          leased_by: null,
          payload: args.p_payload,
          result: null,
          error: null,
        },
        error: null,
      });
    },
  };
  const q = createSupabaseProductionJobQueue({
    client: fake as never,
    workspaceId: WS,
  });
  const rescheduled = await q.reschedule(
    "j1",
    "33333333-3333-4333-8333-333333333333",
    "worker-1",
    "2026-08-02T12:00:03.000Z",
    { mode: "poll", planRevisionId: "plan-1", scenePackageSceneId: "s1" }
  );
  assert.equal(rescheduled.status, "queued");
  assert.equal(rpcs[0]!.name, "reschedule_production_job");
  assert.equal(rpcs[0]!.args.p_worker_id, "worker-1");
});

test("IdempotencyPort — durable + begin conflict mapping", async () => {
  const fake = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({
                      data: {
                        key: "k1",
                        command_fingerprint: "fp1",
                        status: "begun",
                      },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        },
        update() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    eq: async () => ({ error: null }),
                  };
                },
              };
            },
          };
        },
      };
    },
    rpc() {
      return Promise.resolve({ data: "fingerprint_mismatch", error: null });
    },
  };

  const port = createSupabaseProductionIdempotencyPort({
    client: fake as never,
    workspaceId: WS,
    resolveProjectId: async () => "p1",
  });
  assert.equal(port.durable, true);
  const found = await port.find("k1");
  assert.equal(found?.status, "begun");
  const begin = await port.begin("k1", "other");
  assert.deepEqual(begin, {
    status: "conflict",
    reason: "fingerprint_mismatch",
  });
});

test("EventPort — insert redacted payload fields only", async () => {
  const inserts: unknown[] = [];
  const fake = {
    from(table: string) {
      assert.equal(table, "domain_events");
      return {
        insert(row: unknown) {
          inserts.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  const port = createSupabaseProductionEventPort({
    client: fake as never,
    workspaceId: WS,
  });
  await port.publish({
    id: "e1",
    type: "attempt.completed",
    at: "2026-08-02T12:00:00.000Z",
    correlationId: "corr-12345678",
    projectId: "p1",
    runId: "r1",
    sceneId: "s1",
    stepId: "st1",
    data: { ok: true },
  });
  const row = inserts[0] as { payload: Record<string, unknown>; correlation_id: string };
  assert.equal(row.correlation_id, "corr-12345678");
  assert.equal(row.payload.type, "attempt.completed");
  assert.ok(!JSON.stringify(row).includes("Bearer"));
  assert.ok(!JSON.stringify(row).includes("signed"));
});
