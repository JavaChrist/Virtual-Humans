import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { buildLipsyncSectionView } from "../lipsync-section-view";

const here = dirname(fileURLToPath(import.meta.url));

test("lipsync view — préparé mais désactivé, pas de provider, merge fermé", () => {
  const view = buildLipsyncSectionView({
    videoResolved: true,
    audioResolved: true,
    runtimeOff: true,
  });
  assert.equal(view.availableInProduction, false);
  assert.equal(view.providerExposed, false);
  assert.equal(view.directorNavChanged, false);
  assert.equal(view.mergeExportAuthorized, false);
  assert.equal(view.readiness, "prepared_disabled");
  assert.match(view.disabledReason, /désactivé/);
});

test("lipsync view — vidéo ou audio absents bloquent", () => {
  const missingVideo = buildLipsyncSectionView({ videoResolved: false, audioResolved: true });
  assert.equal(missingVideo.readiness, "blocked");
  assert.ok(missingVideo.blockingReasons.some((reason) => /vidéo/i.test(reason)));
  const missingAudio = buildLipsyncSectionView({ videoResolved: true, audioResolved: false });
  assert.ok(missingAudio.blockingReasons.some((reason) => /audio/i.test(reason)));
});

test("lipsync source — UI n’expose aucun choix de provider et n’active pas Director", () => {
  const section = readFileSync(join(here, "..", "lipsync-section.tsx"), "utf8");
  const client = readFileSync(join(here, "..", "director-project-client.tsx"), "utf8");
  assert.match(section, /Préparer le fake local/);
  assert.match(section, /Exécution réelle indisponible/);
  assert.doesNotMatch(section, /videoResolved: true/);
  assert.doesNotMatch(section, /<select/);
  assert.doesNotMatch(section, /(?<![A-Za-z])(?:fal|elevenlabs|openai)(?![A-Za-z])/i);
  assert.doesNotMatch(section, /DIRECTOR_V2_ENABLED/);
  assert.match(client, /<LipsyncSection/);
  assert.match(client, /videoResolved=\{Boolean\(initialPlanRouting\)\}/);
  assert.doesNotMatch(client, /DIRECTOR_V2_ENABLED/);
});
