import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

test("wiring source — AICCOS files are not bound to the update-blocker registry", () => {
  const send = read("src/components/send-to-aiccos.tsx");
  const route = read("src/app/api/aiccos/send/route.ts");
  for (const src of [send, route]) {
    assert.doesNotMatch(src, /registerUpdateBlocker/);
    assert.doesNotMatch(src, /useUpdateBlocker/);
    assert.doesNotMatch(src, /update-blocker/);
  }
});

test("wiring source — sw.js is not modified by this gate", () => {
  const sw = read("public/sw.js");
  assert.doesNotMatch(sw, /registerUpdateBlocker/);
  assert.doesNotMatch(sw, /useUpdateBlocker/);
  assert.doesNotMatch(sw, /update-blocker/);
  assert.match(sw, /SKIP_WAITING/);
});

test("wiring source — single registry; selected workflows bind useUpdateBlocker", () => {
  const registry = read("src/lib/update-blockers.ts");
  assert.match(registry, /export function registerUpdateBlocker/);
  const hook = read("src/lib/use-update-blocker.ts");
  assert.match(hook, /registerUpdateBlocker/);
  assert.doesNotMatch(hook, /new Map/);

  const wired = [
    "src/app/director/_components/use-director-processing.ts",
    "src/app/director/_components/use-brief-draft.ts",
    "src/app/director/_components/brief-wizard.tsx",
    "src/app/director/_components/production-section.tsx",
    "src/app/director/_components/brief-section.tsx",
    "src/app/director/_components/delivery-section.tsx",
    "src/app/director/_components/routing-section.tsx",
    "src/app/director/_components/prompt-section.tsx",
    "src/app/director/_components/motion-review-section.tsx",
    "src/app/image/page.tsx",
    "src/app/voice/page.tsx",
    "src/app/video/page.tsx",
    "src/app/lipsync/page.tsx",
    "src/app/scene/page.tsx",
    "src/app/storyboard/page.tsx",
    "src/app/products/page.tsx",
    "src/app/login/page.tsx",
  ];
  for (const file of wired) {
    assert.match(read(file), /useUpdateBlocker/, file);
  }
});

test("wiring source — Director processing uses processing not confirming; motion submit-only", () => {
  const processing = read("src/app/director/_components/use-director-processing.ts");
  assert.match(processing, /isDirectorUiProcessing\(phase\)/);
  assert.doesNotMatch(processing, /useUpdateBlocker\(\s*busy/);

  const motion = read("src/app/director/_components/motion-review-section.tsx");
  assert.match(motion, /decisionBusy/);
  assert.doesNotMatch(motion, /useUpdateBlocker\(\s*ui\s*===\s*"loading"/);

  const wizard = read("src/app/director/_components/brief-wizard.tsx");
  const createBody = wizard.slice(wizard.indexOf("async function createPersistedProject"));
  const submitIdx = createBody.indexOf("setSubmitting(true)");
  const normalizeIdx = createBody.indexOf("normalizeBriefFields");
  assert.ok(normalizeIdx >= 0 && submitIdx > normalizeIdx);
});

test("wiring source — no provider flag writes in blocker files", () => {
  const files = [
    "src/lib/update-blocker-reasons.ts",
    "src/lib/update-blocker-policy.ts",
    "src/lib/use-update-blocker.ts",
  ];
  for (const file of files) {
    const src = read(file);
    assert.doesNotMatch(src, /DIRECTOR_V2_ENABLED/);
    assert.doesNotMatch(src, /PAID_MEDIA/);
    assert.doesNotMatch(src, /process\.env/);
  }
});
