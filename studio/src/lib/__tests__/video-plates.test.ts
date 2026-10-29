import assert from "node:assert/strict";
import { test } from "node:test";
import { listVideoPlates, lockedPresenterPlate, readAsset } from "../sdk";

test("Tom — plaque fond vert officielle verrouillée et lisible", () => {
  const tom = "Tom SDK v1.0.0";
  const plate = lockedPresenterPlate(tom);
  assert.ok(plate, "Tom must expose a locked presenter plate");
  assert.equal(plate.role, "presenter_green_screen");
  assert.equal(plate.locked, true);
  assert.equal(plate.relPath, "videos/approved/tom_green-screen_phone_v001.mp4");
  const media = readAsset(tom, plate.relPath);
  assert.ok(media, "locked plate file must be readable");
  assert.equal(media.mime, "video/mp4");
  assert.ok(media.buffer.length > 0);
  assert.equal(listVideoPlates(tom).filter((p) => p.locked).length, 1);
});

test("Mei — pas de plaque présentateur verrouillée dans le SDK", () => {
  assert.equal(lockedPresenterPlate("Mei SDK v1.0.0"), null);
  assert.deepEqual(listVideoPlates("Mei SDK v1.0.0"), []);
});
