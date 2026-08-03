import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDirectorFinalAssetStoragePath,
  assertSafeDirectorStoragePath,
  extensionForDirectorMime,
} from "../director-final-asset-path";

const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJ = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONTAINER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ASSET = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

test("path — déterministe et validé", () => {
  const a = buildDirectorFinalAssetStoragePath({
    workspaceId: WS,
    projectId: PROJ,
    containerId: CONTAINER,
    assetId: ASSET,
    mimeType: "video/mp4",
  });
  const b = buildDirectorFinalAssetStoragePath({
    workspaceId: WS,
    projectId: PROJ,
    containerId: CONTAINER,
    assetId: ASSET,
    mimeType: "video/mp4",
  });
  assert.equal(a, b);
  assert.equal(a, `${WS}/${PROJ}/${CONTAINER}/${ASSET}.mp4`);
});

test("path — refuse segments non UUID et traversal", () => {
  assert.throws(() =>
    buildDirectorFinalAssetStoragePath({
      workspaceId: "../evil",
      projectId: PROJ,
      containerId: CONTAINER,
      assetId: ASSET,
      mimeType: "video/mp4",
    }),
  );
  assert.throws(() =>
    buildDirectorFinalAssetStoragePath({
      workspaceId: WS,
      projectId: PROJ,
      containerId: CONTAINER,
      assetId: ASSET,
      mimeType: "application/x-msdownload",
    }),
  );
});

test("MIME → extension allowlist", () => {
  assert.equal(extensionForDirectorMime("video/mp4"), "mp4");
  assert.equal(extensionForDirectorMime("image/jpeg"), "jpg");
  assert.equal(extensionForDirectorMime("text/plain"), null);
});

test("assertSafeDirectorStoragePath — scope workspace/projet", () => {
  const path = `${WS}/${PROJ}/${CONTAINER}/${ASSET}.mp4`;
  assertSafeDirectorStoragePath(path, { workspaceId: WS, projectId: PROJ });
  assert.throws(() =>
    assertSafeDirectorStoragePath(path, {
      workspaceId: WS,
      projectId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    }),
  );
  assert.throws(() =>
    assertSafeDirectorStoragePath(`${WS}/${PROJ}/../${ASSET}.mp4`, {
      workspaceId: WS,
      projectId: PROJ,
    }),
  );
});
