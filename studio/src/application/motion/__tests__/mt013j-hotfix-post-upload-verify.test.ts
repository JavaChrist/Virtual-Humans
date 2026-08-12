import assert from "node:assert/strict";
import test from "node:test";
import {
  MV001_POST_UPLOAD_ASSET_SELECT,
  parseMv001PostUploadAssetRow,
  verifyMv001PostUploadAssetRow,
  type Mv001PostUploadAssetRow,
} from "../mv001/mv001-post-upload-verify";

const SOURCE_ID = "12c4bd0b-c56b-48c1-88c8-6d2053acc320";
const IDENTITY_ID = "f42393ae-6095-4939-a307-c7b47365e77c";
const SOURCE_SHA =
  "91b32ec502454e46a93122f250fcde51431ce5e83d1947d645c8f9c40a58fc5a";
const IDENTITY_SHA =
  "9e270cd7d31bbb3e7cd6955059eff1c4d23c93d982cf5e2b03f19d8346561dae";
const WS = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const PROJ = "390c25db-69e1-403a-83c5-7afcb4b85e84";

const expected = {
  bucket: "director-final-assets",
  sourceAssetId: SOURCE_ID,
  identityAssetId: IDENTITY_ID,
  sourceChecksum: SOURCE_SHA,
  identityChecksum: IDENTITY_SHA,
};

function sourceRow(
  overrides: Partial<Mv001PostUploadAssetRow> = {},
): Mv001PostUploadAssetRow {
  return {
    id: SOURCE_ID,
    kind: "video",
    mime_type: "video/mp4",
    storage_bucket: "director-final-assets",
    storage_path: `${WS}/${PROJ}/motion/source/${SOURCE_ID}.mp4`,
    checksum: SOURCE_SHA,
    size_bytes: 2672339,
    status: "available",
    source_kind: "internal",
    provenance: { motionRole: "motion_source_video" },
    ...overrides,
  };
}

test("select includes source_kind for typed post-upload verify", () => {
  assert.match(MV001_POST_UPLOAD_ASSET_SELECT, /\bsource_kind\b/);
  assert.match(MV001_POST_UPLOAD_ASSET_SELECT, /\bprovenance\b/);
});

test("accepts internal source + identity rows", () => {
  assert.equal(verifyMv001PostUploadAssetRow(sourceRow(), expected).ok, true);
  assert.equal(
    verifyMv001PostUploadAssetRow(
      {
        id: IDENTITY_ID,
        kind: "image",
        mime_type: "image/png",
        storage_bucket: "director-final-assets",
        storage_path: `${WS}/${PROJ}/motion/identity/${IDENTITY_ID}.png`,
        checksum: IDENTITY_SHA,
        size_bytes: 1467232,
        status: "available",
        source_kind: "internal",
        provenance: { motionRole: "motion_identity_reference" },
      },
      expected,
    ).ok,
    true,
  );
});

test("rejects non-internal source_kind (security)", () => {
  const r = verifyMv001PostUploadAssetRow(
    sourceRow({ source_kind: "temporary_external" }),
    expected,
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "source_kind must be internal");
});

test("rejects checksum / path / mime mismatches", () => {
  assert.equal(
    verifyMv001PostUploadAssetRow(sourceRow({ checksum: "0".repeat(64) }), expected)
      .ok,
    false,
  );
  assert.equal(
    verifyMv001PostUploadAssetRow(sourceRow({ mime_type: "video/webm" }), expected)
      .ok,
    false,
  );
  assert.equal(
    verifyMv001PostUploadAssetRow(
      sourceRow({ storage_path: `${WS}/${PROJ}/motion/source/other.mp4` }),
      expected,
    ).ok,
    false,
  );
});

test("parseMv001PostUploadAssetRow requires source_kind string", () => {
  const ok = parseMv001PostUploadAssetRow(sourceRow());
  assert.ok(ok);
  assert.equal(ok?.source_kind, "internal");
  assert.equal(
    parseMv001PostUploadAssetRow({
      ...sourceRow(),
      source_kind: undefined,
    }),
    null,
  );
});
