import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateScriptTiming,
  countWords,
  estimateScreenTextDuration,
  estimateSpokenDuration,
  resolveSpeechTimingProfile,
  roundSeconds,
  validateTargetDuration,
  DEFAULT_DURATION_TOLERANCE,
} from "../timing";
import type { ScriptSegment } from "../video-script";

test("français et anglais ont des profils dédiés", () => {
  assert.equal(resolveSpeechTimingProfile("fr-FR").usedFallback, false);
  assert.equal(resolveSpeechTimingProfile("en").usedFallback, false);
  assert.equal(resolveSpeechTimingProfile("fr").profile.id, "speech-fr-v1");
  assert.equal(resolveSpeechTimingProfile("en-US").profile.id, "speech-en-v1");
});

test("fallback de langue documenté", () => {
  const { profile, usedFallback } = resolveSpeechTimingProfile("de");
  assert.equal(usedFallback, true);
  assert.equal(profile.id, "speech-fallback-v1");
});

test("comptage mots Unicode et apostrophes", () => {
  assert.equal(countWords("L'été à Paris"), 3);
  assert.equal(countWords("It's a test"), 3);
  assert.equal(countWords("…"), 0);
  assert.equal(countWords(""), 0);
});

test("ponctuation augmente la durée orale", () => {
  const { profile } = resolveSpeechTimingProfile("fr");
  const plain = estimateSpokenDuration("Bonjour monde test phrase", profile);
  const punct = estimateSpokenDuration("Bonjour, monde. Test phrase!", profile);
  assert.ok(punct.seconds >= plain.seconds);
});

test("texte vide → 0", () => {
  const { profile } = resolveSpeechTimingProfile("en");
  assert.equal(estimateSpokenDuration("   ", profile).seconds, 0);
  assert.equal(estimateScreenTextDuration("", profile).seconds, 0);
});

test("nombres comptés comme mots", () => {
  assert.equal(countWords("Réservez en 2 minutes"), 4);
});

test("écran plus long que l'oral (max)", () => {
  const segments: ScriptSegment[] = [
    {
      id: "s1",
      order: 1,
      purpose: "hook",
      speaker: "none",
      screenText: "Un texte écran un peu plus long pour forcer l'affichage",
      emotion: "neutre",
      pauseAfterMs: 0,
      pronunciationNotes: [],
    },
  ];
  const report = calculateScriptTiming(segments, "fr", 15);
  assert.ok(report.segmentTimings[0]!.screenDurationSeconds > 0);
  assert.equal(report.segmentTimings[0]!.spokenDurationSeconds, 0);
  assert.equal(
    report.segmentTimings[0]!.totalDurationSeconds,
    report.segmentTimings[0]!.screenDurationSeconds,
  );
});

test("oral plus long que l'écran", () => {
  const segments: ScriptSegment[] = [
    {
      id: "s1",
      order: 1,
      purpose: "hook",
      speaker: "character",
      dialogue: "Voici une phrase orale nettement plus longue que le texte écran court.",
      screenText: "Go",
      emotion: "claire",
      pauseAfterMs: 0,
      pronunciationNotes: [],
    },
  ];
  const report = calculateScriptTiming(segments, "fr", 15);
  assert.ok(
    report.segmentTimings[0]!.spokenDurationSeconds >=
      report.segmentTimings[0]!.screenDurationSeconds,
  );
});

test("pauses ajoutées après le contenu", () => {
  const base: ScriptSegment = {
    id: "s1",
    order: 1,
    purpose: "hook",
    speaker: "character",
    dialogue: "Bonjour à tous",
    emotion: "claire",
    pauseAfterMs: 0,
    pronunciationNotes: [],
  };
  const withPause = { ...base, pauseAfterMs: 1000 };
  const a = calculateScriptTiming([base], "fr", 15);
  const b = calculateScriptTiming([withPause], "fr", 15);
  assert.ok(b.estimatedTotalSeconds >= a.estimatedTotalSeconds + 0.99);
});

test("arrondis stables", () => {
  assert.equal(roundSeconds(1.234), 1.23);
  assert.equal(roundSeconds(1.235), 1.24);
  assert.equal(roundSeconds(0), 0);
});

test("tolérance 10 % — exact / trop court / trop long", () => {
  assert.equal(validateTargetDuration(30, 30), "within_target");
  assert.equal(validateTargetDuration(27, 30, DEFAULT_DURATION_TOLERANCE), "within_target");
  assert.equal(validateTargetDuration(26, 30, DEFAULT_DURATION_TOLERANCE), "too_short");
  assert.equal(validateTargetDuration(34, 30, DEFAULT_DURATION_TOLERANCE), "too_long");
});

test("rapport ignore toute durée candidate (recalcul pur)", () => {
  const segments: ScriptSegment[] = [
    {
      id: "s1",
      order: 1,
      purpose: "hook",
      speaker: "character",
      dialogue: "Une seule phrase courte.",
      emotion: "claire",
      pauseAfterMs: 0,
      pronunciationNotes: [],
    },
  ];
  const r1 = calculateScriptTiming(segments, "fr", 15);
  const r2 = calculateScriptTiming(segments, "fr", 15);
  assert.deepEqual(r1, r2);
  assert.equal(r1.profileId, "speech-fr-v1");
});
