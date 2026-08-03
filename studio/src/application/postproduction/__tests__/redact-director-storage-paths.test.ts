import assert from "node:assert/strict";
import { test } from "node:test";
import { redactDirectorStoragePathsForClient } from "../redact-director-storage-paths";

test("redacts nested storagePath without mutating input", () => {
  const input = {
    mergeOutcome: {
      status: "completed",
      finalAsset: {
        id: "a1",
        source: {
          kind: "internal",
          storagePath: "ws/proj/container/asset.mp4",
        },
      },
    },
    exportPackage: {
      finalAsset: {
        source: { kind: "internal", storagePath: "other/path.webm" },
      },
    },
  };
  const out = redactDirectorStoragePathsForClient(input) as typeof input;
  assert.equal(out.mergeOutcome.finalAsset.source.storagePath, "[redacted]");
  assert.equal(out.exportPackage.finalAsset.source.storagePath, "[redacted]");
  assert.equal(
    input.mergeOutcome.finalAsset.source.storagePath,
    "ws/proj/container/asset.mp4",
  );
});

test("leaves non-path fields intact", () => {
  const out = redactDirectorStoragePathsForClient({
    id: "pkg-1",
    checksum: "abc",
    sourceKind: "internal",
  }) as { id: string; checksum: string; sourceKind: string };
  assert.equal(out.id, "pkg-1");
  assert.equal(out.checksum, "abc");
  assert.equal(out.sourceKind, "internal");
});
