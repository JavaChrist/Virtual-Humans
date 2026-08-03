/**
 * VHS-127 — durable AssetContentPort against local Supabase Storage.
 * Two independent clients prove content does not depend on process memory.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import {
  buildSyntheticFakeMp4Bytes,
  sha256Hex,
  SYNTHETIC_FAKE_MP4_MARKER,
} from "@/application/postproduction/asset-content-port";
import {
  DIRECTOR_FINAL_ASSETS_BUCKET,
  buildDirectorFinalAssetStoragePath,
} from "@/application/postproduction/director-final-asset-path";
import { createSupabaseStorageAssetContentPort } from "@/infrastructure/storage/supabase-asset-content-port";
import { createLocalClients } from "@/infrastructure/db/integration-harness";

test("VHS-127 — Storage put/get multi-client + isolation + idempotence", async () => {
  const { client, clientB, gate } = createLocalClients();
  assert.ok(gate.url.includes("127.0.0.1") || gate.url.includes("localhost"));

  const workspaceId = randomUUID();
  const otherWorkspace = randomUUID();
  const projectId = randomUUID();
  const containerId = randomUUID();
  const assetId = randomUUID();
  const bytes = buildSyntheticFakeMp4Bytes(`storage-${assetId.slice(0, 8)}`);
  const storagePath = buildDirectorFinalAssetStoragePath({
    workspaceId,
    projectId,
    containerId,
    assetId,
    mimeType: "video/mp4",
  });

  // Instance A writes, then all references to A are dropped before B reads.
  {
    const portA = createSupabaseStorageAssetContentPort({ client });
    await portA.put({
      assetId,
      workspaceId,
      projectId,
      containerId,
      mimeType: "video/mp4",
      bytes,
      storagePath,
    });
    // Idempotent retry
    await portA.put({
      assetId,
      workspaceId,
      projectId,
      containerId,
      mimeType: "video/mp4",
      bytes,
      storagePath,
    });
  }

  const portB = createSupabaseStorageAssetContentPort({ client: clientB });
  const fromB = await portB.get({
    assetId,
    workspaceId,
    projectId,
    storagePath,
  });
  assert.ok(fromB, "second independent client must read durable bytes from Storage");
  assert.deepEqual(Buffer.from(fromB!.bytes), Buffer.from(bytes));
  assert.ok(Buffer.from(fromB!.bytes).includes(Buffer.from(SYNTHETIC_FAKE_MP4_MARKER)));
  assert.equal(fromB!.checksumSha256, sha256Hex(bytes));
  assert.equal(fromB!.mimeType, "video/mp4");

  // Wrong workspace path must not resolve via get (scoped path check)
  const leaked = await portB.get({
    assetId,
    workspaceId: otherWorkspace,
    projectId,
    storagePath,
  });
  assert.equal(leaked, null);

  // Collision with different content (fresh writer instance)
  const portC = createSupabaseStorageAssetContentPort({ client });
  await assert.rejects(
    () =>
      portC.put({
        assetId,
        workspaceId,
        projectId,
        containerId,
        mimeType: "video/mp4",
        bytes: buildSyntheticFakeMp4Bytes("collision-other"),
        storagePath,
      }),
    /Collision/,
  );

  // Anon cannot download (no policy) — use anon key from gate if available
  const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY;
  if (anonKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(gate.url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.storage
      .from(DIRECTOR_FINAL_ASSETS_BUCKET)
      .download(storagePath);
    assert.ok(error || !data, "anon must not read director-final-assets");
  }

  // Cleanup only objects created by this test (workspace prefix)
  const { data: listed } = await client.storage
    .from(DIRECTOR_FINAL_ASSETS_BUCKET)
    .list(`${workspaceId}/${projectId}/${containerId}`);
  for (const obj of listed ?? []) {
    await client.storage
      .from(DIRECTOR_FINAL_ASSETS_BUCKET)
      .remove([`${workspaceId}/${projectId}/${containerId}/${obj.name}`]);
  }
});
