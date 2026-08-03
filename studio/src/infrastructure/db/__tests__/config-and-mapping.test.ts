/**
 * V2 persistence — config validation + repository mapping (no network) (VHS-113).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSupabaseProjectRepository,
  parseV2SupabaseConfig,
  resetV2SupabaseCacheForTests,
  V2SupabaseConfigError,
} from "../index";

const WS = "11111111-1111-4111-8111-111111111111";

test("parseV2SupabaseConfig — exige URL, service role, workspace UUID", () => {
  resetV2SupabaseCacheForTests();
  assert.throws(
    () => parseV2SupabaseConfig({}),
    (e: unknown) => e instanceof V2SupabaseConfigError
  );
  assert.throws(
    () =>
      parseV2SupabaseConfig({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "role-key",
        DIRECTOR_V2_WORKSPACE_ID: "not-a-uuid",
      }),
    (e: unknown) =>
      e instanceof V2SupabaseConfigError &&
      String(e.message).includes("DIRECTOR_V2_WORKSPACE_ID")
  );

  const cfg = parseV2SupabaseConfig({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "role-key",
    DIRECTOR_V2_WORKSPACE_ID: WS,
  });
  assert.equal(cfg.workspaceId, WS);
  assert.equal(cfg.url, "https://example.supabase.co");
  assert.equal(cfg.serviceRoleKey, "role-key");
});

test("ProjectRepository — insert/load mapping + workspace guard", async () => {
  const inserts: unknown[] = [];
  const fakeClient = {
    from(table: string) {
      assert.equal(table, "video_projects");
      return {
        insert(row: unknown) {
          inserts.push(row);
          return Promise.resolve({ error: null });
        },
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({
                      data: {
                        id: "p1",
                        workspace_id: WS,
                        name: "Demo",
                        status: "draft",
                        active_revision: 1,
                        schema_version: "1.0.0",
                        created_at: "2026-08-02T12:00:00.000Z",
                        updated_at: "2026-08-02T12:00:00.000Z",
                        archived_at: null,
                        correlation_id: "corr-12345678",
                      },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const repo = createSupabaseProjectRepository({
    client: fakeClient as never,
    workspaceId: WS,
  });

  await assert.rejects(
    () =>
      repo.create({
        id: "p1",
        workspaceId: "22222222-2222-4222-8222-222222222222",
        name: "X",
        status: "draft",
        activeRevision: 1,
        schemaVersion: "1.0.0",
        createdAt: "2026-08-02T12:00:00.000Z",
        updatedAt: "2026-08-02T12:00:00.000Z",
        archivedAt: null,
        correlationId: "corr-12345678",
      }),
    /workspace_id/
  );

  await repo.create({
    id: "p1",
    workspaceId: WS,
    name: "Demo",
    status: "draft",
    activeRevision: 1,
    schemaVersion: "1.0.0",
    createdAt: "2026-08-02T12:00:00.000Z",
    updatedAt: "2026-08-02T12:00:00.000Z",
    archivedAt: null,
    correlationId: "corr-12345678",
  });
  assert.equal(inserts.length, 1);
  const row = inserts[0] as { workspace_id: string; name: string };
  assert.equal(row.workspace_id, WS);
  assert.equal(row.name, "Demo");

  const loaded = await repo.load("p1");
  assert.ok(loaded);
  assert.equal(loaded!.workspaceId, WS);
  assert.equal(loaded!.status, "draft");
  assert.equal(loaded!.name, "Demo");
});

test("mapSupabaseError — pas de fuite de secret", async () => {
  const { mapSupabaseError } = await import("../errors");
  const err = mapSupabaseError({
    message: "JWT secret sk_live_abcdef permission denied",
  });
  assert.equal(err.publicMessage, "Persistance indisponible.");
  assert.ok(!err.publicMessage.includes("sk_live"));
});
