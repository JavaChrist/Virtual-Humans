/**
 * Phase 11C — explicit spoken-segment resolution.
 * Production text is never stored here: only hash, length, and a redacted excerpt.
 */
import { createHash } from "node:crypto";
import { SCRIPT_FIELD_LIMITS } from "@/domain/script/video-script";
import {
  PHASE_11C_MAX_TEXT_CHARS,
  PHASE_11C_PROJECT_ID,
  PHASE_11C_SCENE_ID,
  PHASE_11C_SUPPORTED_LANGUAGE,
  PHASE_11C_WORKSPACE_ID,
} from "./phase-11c-voice-allowlist";

export const PHASE_11C_SPOKEN_SEGMENT_VERSION = "phase-11c-spoken-segment-1.0.0" as const;

export const PHASE_11C_CANONICAL_SCRIPT_ID =
  "349e2792-3235-4c00-a1da-9e087b0b4d1c" as const;
export const PHASE_11C_CANONICAL_SCRIPT_REVISION = 1 as const;
export const PHASE_11C_CANONICAL_STORYBOARD_ID =
  "7cf183c1-ab31-4312-8156-97bc14c111d9" as const;
export const PHASE_11C_CANONICAL_STORYBOARD_REVISION = 1 as const;
export const PHASE_11C_CANONICAL_SCENE_PACKAGE_SET_ID =
  "2e8e9e6f-226e-498d-9cd7-a336b80d584c" as const;
export const PHASE_11C_CANONICAL_SCENE_PACKAGE_SET_REVISION = 2 as const;
export const PHASE_11C_CANONICAL_SEGMENT_ID = "segment-2" as const;
export const PHASE_11C_CANONICAL_SPOKEN_KIND = "voice_over" as const;
export const PHASE_11C_CANONICAL_SPEAKER = "narrator" as const;
export const PHASE_11C_CANONICAL_CHAR_COUNT = 81 as const;
export const PHASE_11C_CANONICAL_TEXT_SHA256 =
  "f228654fc7fbb60731d02e8609e8520ef935fb8dba92e501fccafb9def3547d6" as const;
export const PHASE_11C_CANONICAL_EXCERPT_REDACTED = "Pass…" as const;
export const PHASE_11C_CANONICAL_ESTIMATED_DURATION_SECONDS = 7.01 as const;
export const PHASE_11C_CANONICAL_PROVENANCE = "i2v_project_active_script_rev1_scene2" as const;

export type SpokenSegmentKind = "dialogue" | "voice_over";

export type CanonicalSpokenSegment = {
  version: typeof PHASE_11C_SPOKEN_SEGMENT_VERSION;
  workspaceId: string;
  projectId: string;
  sceneId: string;
  scriptArtifactId: string;
  scriptRevision: number;
  segmentId: string;
  spokenKind: SpokenSegmentKind;
  speakerKind: "character" | "narrator";
  characterId?: string;
  narratorId?: string;
  language: string;
  textSha256: string;
  characterCount: number;
  excerptRedacted: string;
  estimatedDurationSeconds: number;
  provenance: string;
};

export function hashSpokenText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function assertSpokenTextAcceptable(text: string): void {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Phase 11C spoken segment: text is empty.");
  }
  if (trimmed.length > PHASE_11C_MAX_TEXT_CHARS) {
    throw new Error("Phase 11C spoken segment: text exceeds max length.");
  }
  if (trimmed.length > SCRIPT_FIELD_LIMITS.voiceOver && trimmed.length > SCRIPT_FIELD_LIMITS.dialogue) {
    throw new Error("Phase 11C spoken segment: text exceeds script field limits.");
  }
}

export function resolveCanonicalI2vSpokenSegment(): CanonicalSpokenSegment {
  return Object.freeze({
    version: PHASE_11C_SPOKEN_SEGMENT_VERSION,
    workspaceId: PHASE_11C_WORKSPACE_ID,
    projectId: PHASE_11C_PROJECT_ID,
    sceneId: PHASE_11C_SCENE_ID,
    scriptArtifactId: PHASE_11C_CANONICAL_SCRIPT_ID,
    scriptRevision: PHASE_11C_CANONICAL_SCRIPT_REVISION,
    segmentId: PHASE_11C_CANONICAL_SEGMENT_ID,
    spokenKind: PHASE_11C_CANONICAL_SPOKEN_KIND,
    speakerKind: "narrator",
    narratorId: "narrator:project",
    language: PHASE_11C_SUPPORTED_LANGUAGE,
    textSha256: PHASE_11C_CANONICAL_TEXT_SHA256,
    characterCount: PHASE_11C_CANONICAL_CHAR_COUNT,
    excerptRedacted: PHASE_11C_CANONICAL_EXCERPT_REDACTED,
    estimatedDurationSeconds: PHASE_11C_CANONICAL_ESTIMATED_DURATION_SECONDS,
    provenance: PHASE_11C_CANONICAL_PROVENANCE,
  });
}

export function buildSpokenSegmentFromExplicitText(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  scriptArtifactId: string;
  scriptRevision: number;
  segmentId: string;
  spokenKind: SpokenSegmentKind;
  speakerKind: "character" | "narrator";
  characterId?: string;
  narratorId?: string;
  language: string;
  text: string;
  estimatedDurationSeconds?: number;
  provenance: string;
}): CanonicalSpokenSegment {
  if (input.projectId !== PHASE_11C_PROJECT_ID || input.workspaceId !== PHASE_11C_WORKSPACE_ID) {
    throw new Error("Phase 11C spoken segment: workspace/project mismatch.");
  }
  if (input.scriptArtifactId !== PHASE_11C_CANONICAL_SCRIPT_ID) {
    throw new Error("Phase 11C spoken segment: script belongs to another project or is not the I2V script.");
  }
  assertSpokenTextAcceptable(input.text);
  const characterCount = input.text.trim().length;
  return Object.freeze({
    version: PHASE_11C_SPOKEN_SEGMENT_VERSION,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    sceneId: input.sceneId,
    scriptArtifactId: input.scriptArtifactId,
    scriptRevision: input.scriptRevision,
    segmentId: input.segmentId,
    spokenKind: input.spokenKind,
    speakerKind: input.speakerKind,
    characterId: input.characterId,
    narratorId: input.narratorId,
    language: input.language,
    textSha256: hashSpokenText(input.text.trim()),
    characterCount,
    excerptRedacted: `${input.text.trim().slice(0, 4)}…`,
    estimatedDurationSeconds: input.estimatedDurationSeconds ?? Math.max(1, characterCount / 12),
    provenance: input.provenance,
  });
}

export function fingerprintSpokenSegment(segment: CanonicalSpokenSegment): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        v: segment.version,
        workspaceId: segment.workspaceId,
        projectId: segment.projectId,
        sceneId: segment.sceneId,
        scriptArtifactId: segment.scriptArtifactId,
        scriptRevision: segment.scriptRevision,
        segmentId: segment.segmentId,
        spokenKind: segment.spokenKind,
        textSha256: segment.textSha256,
        characterCount: segment.characterCount,
        language: segment.language,
      }),
    )
    .digest("hex");
}
