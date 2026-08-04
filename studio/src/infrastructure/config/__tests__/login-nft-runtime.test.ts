/**
 * Regression: Production login 500 when NFT omits Turbopack runtime chunks
 * (Porte 6 — dpl_EVnMYnF… MODULE_NOT_FOUND ../../../chunks/[turbopack]_runtime.js).
 *
 * Runs only when a production `.next` build is present; otherwise skipped.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const loginRoute = join(
  process.cwd(),
  ".next/server/app/api/login/route.js",
);
const loginNft = join(
  process.cwd(),
  ".next/server/app/api/login/route.js.nft.json",
);

test("login route compiled — requires turbopack runtime chunk", { skip: !existsSync(loginRoute) }, () => {
  const src = readFileSync(loginRoute, "utf8");
  assert.match(src, /chunks\/\[turbopack\]_runtime\.js/);
});

test("login NFT — includes turbopack runtime (packaging)", { skip: !existsSync(loginNft) }, () => {
  const nft = JSON.parse(readFileSync(loginNft, "utf8")) as {
    files?: string[];
  };
  const files = nft.files ?? [];
  assert.ok(files.length > 0, "NFT vide");
  const hasRuntime = files.some(
    (f) =>
      f.includes("[turbopack]_runtime") ||
      f.replace(/\\/g, "/").endsWith("chunks/[turbopack]_runtime.js"),
  );
  assert.ok(
    hasRuntime,
    "NFT login sans [turbopack]_runtime.js — packaging Vercel cassera POST /api/login",
  );
});
