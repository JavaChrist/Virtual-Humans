/**
 * Semantic blocks for ScenePackage (VHS-106).
 * Provider-agnostic structured decisions — not free-text authority.
 */

import type { PronunciationNote } from "@/domain/script";

export const PromptBlockNameValues = [
  "subject",
  "action",
  "environment",
  "camera",
  "lighting",
  "style",
  "composition",
  "dialogue",
  "audio",
  "screenText",
  "constraints",
  "references",
] as const;
export type PromptBlockName = (typeof PromptBlockNameValues)[number];

export type SubjectBlock = {
  kind: "character" | "product" | "environment" | "interface" | "text";
  description: string;
  characterId?: string;
  productId?: string;
  identityRequirements: string[];
};

export type ActionBlock = {
  primaryAction: string;
  secondaryActions: string[];
  motionIntensity: "none" | "low" | "medium" | "high";
};

export type EnvironmentBlock = {
  kind: string;
  description: string;
  timeOfDay?: string;
  weather?: string;
  continuityKey: string;
  mood: string;
};

export type CameraBlock = {
  shotSize: string;
  angle: string;
  movement: string;
  depthOfField: string;
  intent: string;
};

export type LightingBlock = {
  source: string;
  quality: string;
  temperature: string;
  contrast: string;
  intent: string;
};

export type StyleBlock = {
  style: string;
  realism: string;
  colorIntent: string;
  textureIntent?: string;
  brandAlignment: string;
  paletteRoles: string[];
};

export type CompositionBlock = {
  subjectPosition: string;
  lookDirection: string;
  visualHierarchy: string;
  textSafeArea: string;
  productPlacement?: string;
};

export type DialogueBlock = {
  kind: "dialogue" | "voice_over";
  text: string;
  language: string;
  emotion: string;
  pronunciationNotes: PronunciationNote[];
  fidelity: "verbatim";
};

export type AudioBlock = {
  kind: "voice" | "ambient_none";
  language: string;
  emotion?: string;
  requiresLipsync: boolean;
};

export type ScreenTextBlock = {
  text: string;
  renderMode: "post_production" | "model_generated";
  safeAreaRequired: boolean;
};
