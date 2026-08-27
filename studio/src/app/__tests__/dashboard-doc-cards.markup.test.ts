/**
 * Dashboard contract: documentary overview.documents cards are gone.
 * A first-paint render test would be false confidence — `char` starts null,
 * so `char?.overview.documents` never appears in initial markup even if the
 * section remains in source. Source lock is the compatible check (no jsdom).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(join(here, "..", "page.tsx"), "utf8");

test("dashboard — overview.documents cards absent; studio cards and metrics kept", () => {
  assert.equal(dashboardSource.includes("overview.documents"), false);
  assert.equal(dashboardSource.includes("documents.map"), false);
  assert.doesNotMatch(dashboardSource, /00_IDENTITY|01_APPEARANCE|02_PERSONALITY|04_VOICE/);

  assert.match(dashboardSource, /Studio Image/);
  assert.match(dashboardSource, /Studio Voix/);
  assert.match(dashboardSource, /Studio Vidéo/);
  assert.match(dashboardSource, /Dépense estimée/);
  assert.match(dashboardSource, /Comportements/);
  assert.match(dashboardSource, /Templates/);
  assert.match(dashboardSource, /SDK \$\{char\?\.overview\.sdkVersion/);
});
