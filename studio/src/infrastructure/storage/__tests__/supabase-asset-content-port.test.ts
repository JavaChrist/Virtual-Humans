import assert from "node:assert/strict";
import { test } from "node:test";
import { createSupabaseStorageAssetContentPort } from "../supabase-asset-content-port";
import {
  buildSyntheticFakeMp4Bytes,
  sha256Hex,
} from "@/application/postproduction/asset-content-port";
import { buildDirectorFinalAssetStoragePath } from "@/application/postproduction/director-final-asset-path";

const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJ = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONTAINER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ASSET = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

type Stored = { bytes: Uint8Array; contentType: string };

function createFakeStorageClient(store: Map<string, Stored>) {
  return {
    storage: {
      from() {
        return {
          async download(path: string) {
            const hit = store.get(path);
            if (!hit) return { data: null, error: { message: "not found" } };
            return {
              data: {
                arrayBuffer: async () =>
                  hit.bytes.buffer.slice(
                    hit.bytes.byteOffset,
                    hit.bytes.byteOffset + hit.bytes.byteLength,
                  ),
              },
              error: null,
            };
          },
          async upload(path: string, body: Buffer, opts: { contentType: string; upsert: boolean }) {
            if (store.has(path) && !opts.upsert) {
              return { error: { message: "already exists" } };
            }
            store.set(path, {
              bytes: new Uint8Array(body),
              contentType: opts.contentType,
            });
            return { error: null };
          },
        };
      },
    },
  };
}

test("Storage adapter — put/get + idempotence même contenu", async () => {
  const map = new Map<string, Stored>();
  const port = createSupabaseStorageAssetContentPort({
    client: createFakeStorageClient(map) as never,
  });
  const bytes = buildSyntheticFakeMp4Bytes("adapter-unit");
  const storagePath = buildDirectorFinalAssetStoragePath({
    workspaceId: WS,
    projectId: PROJ,
    containerId: CONTAINER,
    assetId: ASSET,
    mimeType: "video/mp4",
  });
  await port.put({
    assetId: ASSET,
    workspaceId: WS,
    projectId: PROJ,
    containerId: CONTAINER,
    mimeType: "video/mp4",
    bytes,
    storagePath,
  });
  await port.put({
    assetId: ASSET,
    workspaceId: WS,
    projectId: PROJ,
    containerId: CONTAINER,
    mimeType: "video/mp4",
    bytes,
    storagePath,
  });
  const got = await port.get({
    assetId: ASSET,
    workspaceId: WS,
    projectId: PROJ,
    storagePath,
  });
  assert.ok(got);
  assert.equal(got!.checksumSha256, sha256Hex(bytes));
  assert.equal(got!.sizeBytes, bytes.byteLength);
  assert.equal(map.size, 1);
});

test("Storage adapter — collision contenu différent refusée", async () => {
  const map = new Map<string, Stored>();
  const port = createSupabaseStorageAssetContentPort({
    client: createFakeStorageClient(map) as never,
  });
  const storagePath = buildDirectorFinalAssetStoragePath({
    workspaceId: WS,
    projectId: PROJ,
    containerId: CONTAINER,
    assetId: ASSET,
    mimeType: "video/mp4",
  });
  await port.put({
    assetId: ASSET,
    workspaceId: WS,
    projectId: PROJ,
    containerId: CONTAINER,
    mimeType: "video/mp4",
    bytes: buildSyntheticFakeMp4Bytes("a"),
    storagePath,
  });
  await assert.rejects(
    () =>
      port.put({
        assetId: ASSET,
        workspaceId: WS,
        projectId: PROJ,
        containerId: CONTAINER,
        mimeType: "video/mp4",
        bytes: buildSyntheticFakeMp4Bytes("b-different"),
        storagePath,
      }),
    /Collision/,
  );
});

test("Storage adapter — MIME inconnu / taille / get sans path", async () => {
  const map = new Map<string, Stored>();
  const port = createSupabaseStorageAssetContentPort({
    client: createFakeStorageClient(map) as never,
  });
  await assert.rejects(
    () =>
      port.put({
        assetId: ASSET,
        workspaceId: WS,
        projectId: PROJ,
        containerId: CONTAINER,
        mimeType: "application/zip",
        bytes: new Uint8Array([1, 2, 3]),
      }),
    /MIME/,
  );
  const missing = await port.get({
    assetId: ASSET,
    workspaceId: WS,
    projectId: PROJ,
  });
  assert.equal(missing, null);
});
