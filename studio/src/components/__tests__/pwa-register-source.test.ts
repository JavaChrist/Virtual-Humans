import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const src = readFileSync(
  join(process.cwd(), "src/components/pwa-register.tsx"),
  "utf8",
);

test("pwa-register — poll 120s, no-store, channel, cleanup, no native dialog", () => {
  assert.match(src, /APP_VERSION_POLL_MS/);
  assert.match(src, /fetchAppVersionInit/);
  assert.match(src, /BroadcastChannel/);
  assert.match(src, /clearInterval/);
  assert.match(src, /removeEventListener/);
  assert.match(src, /channel\?\.close/);
  assert.match(src, /Plus tard/);
  assert.match(src, /Mettre à jour/);
  assert.doesNotMatch(src, /window\.alert|window\.confirm|window\.prompt/);
  assert.match(src, /aria-modal/);
  assert.match(src, /role="dialog"/);
});
