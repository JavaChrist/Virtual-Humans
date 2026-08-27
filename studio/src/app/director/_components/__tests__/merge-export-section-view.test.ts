import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { buildMergeExportSectionView } from "../merge-export-section-view";

const here = dirname(fileURLToPath(import.meta.url));

test("merge/export view — préparé mais désactivé, pas de moteur, publication fermée", () => {
  const view = buildMergeExportSectionView({
    videoResolved: true,
    audioResolved: true,
    lipsyncResolved: true,
    bundleCoherent: true,
    runtimeOff: true,
  });
  assert.equal(view.availableInProduction, false);
  assert.equal(view.engineExposed, false);
  assert.equal(view.directorNavChanged, false);
  assert.equal(view.mergeExportAuthorized, false);
  assert.equal(view.publicationAllowed, false);
  assert.equal(view.mergeReadiness, "prepared_disabled");
  assert.equal(view.exportReadiness, "prepared_disabled");
  assert.match(view.disabledReason, /désactivé/);
});

test("merge/export view — bundle incomplet bloque", () => {
  const missingVideo = buildMergeExportSectionView({
    videoResolved: false,
    audioResolved: true,
    lipsyncResolved: true,
  });
  assert.equal(missingVideo.mergeReadiness, "blocked");
  assert.ok(missingVideo.blockingReasons.some((reason) => /vidéo/i.test(reason)));
  const missingLipsync = buildMergeExportSectionView({
    videoResolved: true,
    audioResolved: true,
    lipsyncResolved: false,
  });
  assert.ok(missingLipsync.blockingReasons.some((reason) => /lipsync/i.test(reason)));
});

test("merge/export source — UI n’expose aucun moteur et n’active pas Director", () => {
  const section = readFileSync(join(here, "..", "merge-export-section.tsx"), "utf8");
  const delivery = readFileSync(join(here, "..", "delivery-section.tsx"), "utf8");
  const client = readFileSync(join(here, "..", "director-project-client.tsx"), "utf8");
  assert.match(section, /Merge réel indisponible/);
  assert.match(section, /Export réel indisponible/);
  assert.doesNotMatch(section, /<select/);
  assert.doesNotMatch(section, /ffmpeg|fal|elevenlabs|openai/i);
  assert.doesNotMatch(section, /DIRECTOR_V2_ENABLED/);
  assert.match(delivery, /buildMergeExportSectionView/);
  assert.match(client, /<MergeExportSection/);
  assert.doesNotMatch(client, /DIRECTOR_V2_ENABLED/);
});
