/**
 * Deterministic speech / screen timing engine (VHS-103).
 * Pure functions — no I/O, no providers. Timing from analyzer candidates is never trusted.
 */

import type { BriefDurationSeconds } from "@/domain/brief";
import type { ScriptSegment, ScriptTimingReport, SegmentTiming } from "./video-script";

export const SPEECH_TIMING_ENGINE_VERSION = "1.0.0" as const;

export type SpeechTimingProfile = {
  /** Stable profile id, e.g. "speech-fr-v1". */
  id: string;
  language: string;
  wordsPerMinute: number;
  punctuationPauseMs: {
    comma: number;
    sentence: number;
    paragraph: number;
  };
  screenTextWordsPerMinute: number;
  /** Minimum on-screen display for any non-empty screen text. */
  minScreenDisplayMs: number;
};

/**
 * Documented profiles.
 * FR/EN calibrated for short-form oral delivery; not universally exact.
 * Fallback: conservative WPM for unknown languages.
 */
export const SPEECH_TIMING_PROFILES: readonly SpeechTimingProfile[] = [
  {
    id: "speech-fr-v1",
    language: "fr",
    wordsPerMinute: 160,
    punctuationPauseMs: { comma: 180, sentence: 380, paragraph: 550 },
    screenTextWordsPerMinute: 200,
    minScreenDisplayMs: 800,
  },
  {
    id: "speech-en-v1",
    language: "en",
    wordsPerMinute: 150,
    punctuationPauseMs: { comma: 160, sentence: 350, paragraph: 500 },
    screenTextWordsPerMinute: 200,
    minScreenDisplayMs: 800,
  },
  {
    id: "speech-fallback-v1",
    language: "*",
    wordsPerMinute: 140,
    punctuationPauseMs: { comma: 180, sentence: 400, paragraph: 600 },
    screenTextWordsPerMinute: 180,
    minScreenDisplayMs: 900,
  },
] as const;

/** ±10 % of target for short formats (doc 09). */
export const DEFAULT_DURATION_TOLERANCE: DurationTolerance = {
  underTargetSeconds: 0.1,
  overTargetSeconds: 0.1,
};

export type DurationTolerance = {
  /** Fraction of target allowed under (e.g. 0.1 = 10 %). */
  underTargetSeconds: number;
  /** Fraction of target allowed over. */
  overTargetSeconds: number;
};

export type BreathingMargin = {
  /** Extra seconds added once at script level after segment sum (default 0). */
  seconds: number;
};

export function normalizeLanguageTag(language: string): string {
  const raw = language.trim().toLowerCase();
  if (!raw) return "und";
  const base = raw.split(/[-_]/)[0] ?? raw;
  return base.slice(0, 3);
}

export function resolveSpeechTimingProfile(language: string): {
  profile: SpeechTimingProfile;
  usedFallback: boolean;
} {
  const base = normalizeLanguageTag(language);
  const exact = SPEECH_TIMING_PROFILES.find((p) => p.language === base);
  if (exact) return { profile: exact, usedFallback: false };
  const fallback = SPEECH_TIMING_PROFILES.find((p) => p.language === "*")!;
  return { profile: fallback, usedFallback: true };
}

/**
 * Unicode-aware word count: sequences of letters/numbers.
 * Empty / punctuation-only → 0.
 */
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  const matches = text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu);
  return matches?.length ?? 0;
}

function countPunctuationPausesMs(text: string, profile: SpeechTimingProfile): number {
  if (!text) return 0;
  let ms = 0;
  const commas = (text.match(/[,;:，、]/g) ?? []).length;
  const sentences = (text.match(/[.!?…。！？]+/g) ?? []).length;
  const paragraphs = (text.match(/\n\s*\n/g) ?? []).length;
  ms += commas * profile.punctuationPauseMs.comma;
  ms += sentences * profile.punctuationPauseMs.sentence;
  ms += paragraphs * profile.punctuationPauseMs.paragraph;
  return ms;
}

/** Round to 2 decimal seconds, half-up via integer cents. */
export function roundSeconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100) / 100;
}

export function estimateSpokenDuration(
  text: string,
  profile: SpeechTimingProfile,
): { seconds: number; wordCount: number } {
  const wordCount = countWords(text);
  if (wordCount === 0) return { seconds: 0, wordCount: 0 };
  const baseSeconds = (wordCount / profile.wordsPerMinute) * 60;
  const pauseSeconds = countPunctuationPausesMs(text, profile) / 1000;
  return { seconds: roundSeconds(baseSeconds + pauseSeconds), wordCount };
}

export function estimateScreenTextDuration(
  text: string,
  profile: SpeechTimingProfile,
): { seconds: number; wordCount: number } {
  const wordCount = countWords(text);
  if (wordCount === 0) return { seconds: 0, wordCount: 0 };
  const baseSeconds = (wordCount / profile.screenTextWordsPerMinute) * 60;
  const minSeconds = profile.minScreenDisplayMs / 1000;
  return { seconds: roundSeconds(Math.max(baseSeconds, minSeconds)), wordCount };
}

function spokenTextForSegment(segment: ScriptSegment): string {
  if (segment.speaker === "character") return segment.dialogue ?? "";
  if (segment.speaker === "voice_over") return segment.voiceOver ?? "";
  return "";
}

export function calculateScriptTiming(
  segments: ScriptSegment[],
  language: string,
  targetDurationSeconds: BriefDurationSeconds,
  options: {
    tolerance?: DurationTolerance;
    breathing?: BreathingMargin;
  } = {},
): ScriptTimingReport {
  const { profile } = resolveSpeechTimingProfile(language);
  const tolerance = options.tolerance ?? DEFAULT_DURATION_TOLERANCE;
  const breathing = options.breathing?.seconds ?? 0;

  let spokenWordCount = 0;
  let screenWordCount = 0;
  let spokenDurationSeconds = 0;
  let screenDurationSeconds = 0;
  let pausesDurationSeconds = 0;
  const segmentTimings: SegmentTiming[] = [];

  for (const segment of [...segments].sort((a, b) => a.order - b.order)) {
    const spoken = estimateSpokenDuration(spokenTextForSegment(segment), profile);
    const screen = estimateScreenTextDuration(segment.screenText ?? "", profile);
    const pauseSeconds = roundSeconds(Math.max(0, segment.pauseAfterMs) / 1000);
    // Simultaneous screen + speech: take the max, then add pause (not naive sum of both).
    const contentSeconds = roundSeconds(Math.max(spoken.seconds, screen.seconds));
    const total = roundSeconds(contentSeconds + pauseSeconds);

    spokenWordCount += spoken.wordCount;
    screenWordCount += screen.wordCount;
    spokenDurationSeconds = roundSeconds(spokenDurationSeconds + spoken.seconds);
    screenDurationSeconds = roundSeconds(screenDurationSeconds + screen.seconds);
    pausesDurationSeconds = roundSeconds(pausesDurationSeconds + pauseSeconds);

    segmentTimings.push({
      segmentId: segment.id,
      order: segment.order,
      spokenDurationSeconds: spoken.seconds,
      screenDurationSeconds: screen.seconds,
      pauseDurationSeconds: pauseSeconds,
      totalDurationSeconds: total,
    });
  }

  const segmentsTotal = roundSeconds(
    segmentTimings.reduce((acc, s) => acc + s.totalDurationSeconds, 0),
  );
  const estimatedTotalSeconds = roundSeconds(segmentsTotal + breathing);
  const differenceSeconds = roundSeconds(estimatedTotalSeconds - targetDurationSeconds);
  const status = validateTargetDuration(estimatedTotalSeconds, targetDurationSeconds, tolerance);

  return {
    profileId: profile.id,
    spokenWordCount,
    screenWordCount,
    spokenDurationSeconds,
    screenDurationSeconds,
    pausesDurationSeconds,
    estimatedTotalSeconds,
    targetDurationSeconds,
    differenceSeconds,
    status,
    segmentTimings,
  };
}

export function validateTargetDuration(
  estimatedTotalSeconds: number,
  targetDurationSeconds: number,
  tolerance: DurationTolerance = DEFAULT_DURATION_TOLERANCE,
): ScriptTimingReport["status"] {
  const maxOver = targetDurationSeconds * tolerance.overTargetSeconds;
  const maxUnder = targetDurationSeconds * tolerance.underTargetSeconds;
  if (estimatedTotalSeconds > targetDurationSeconds + maxOver) return "too_long";
  if (estimatedTotalSeconds < targetDurationSeconds - maxUnder) return "too_short";
  return "within_target";
}
