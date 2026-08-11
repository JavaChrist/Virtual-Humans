/**
 * Deterministic provider-agnostic prompt renderers (VHS-106).
 * Stable block order, versioned output, reconstructible from blocks.
 */

import type {
  ActionBlock,
  AudioBlock,
  CameraBlock,
  CompositionBlock,
  DialogueBlock,
  EnvironmentBlock,
  LightingBlock,
  PromptBlockName,
  ScreenTextBlock,
  StyleBlock,
  SubjectBlock,
} from "./blocks";
import type { CapabilityProfile, MediaType } from "./capability-profiles";
import type { ConstraintBlock } from "./constraints";
import { delimitUntrustedData } from "./injection-safety";
import type { PromptReference } from "./references";
import {
  PROMPT_FIELD_LIMITS,
  PROMPT_RENDERER_VERSION,
  type PromptVariant,
} from "./scene-package";

export type RenderableBlocks = {
  subject: SubjectBlock;
  action: ActionBlock;
  environment: EnvironmentBlock;
  camera: CameraBlock;
  lighting: LightingBlock;
  style: StyleBlock;
  composition: CompositionBlock;
  dialogue?: DialogueBlock;
  audio?: AudioBlock;
  screenText?: ScreenTextBlock;
  constraints: ConstraintBlock;
  references: PromptReference[];
};

const BLOCK_ORDER: PromptBlockName[] = [
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
];

function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

function blocksForProfile(profile: CapabilityProfile): PromptBlockName[] {
  switch (profile) {
    case "audio.voice":
      return ["dialogue", "audio", "constraints"];
    case "audio.lipsync":
      return ["dialogue", "audio", "subject", "constraints"];
    case "motion.carousel":
      return ["subject", "action", "composition", "screenText", "constraints", "references"];
    case "image.text_to_image":
      return [
        "subject",
        "environment",
        "lighting",
        "style",
        "composition",
        "constraints",
        "references",
      ];
    case "image.reference_identity":
      return [
        "subject",
        "environment",
        "camera",
        "lighting",
        "style",
        "composition",
        "constraints",
        "references",
      ];
    case "video.dialogue":
      return [
        "subject",
        "action",
        "environment",
        "camera",
        "lighting",
        "style",
        "composition",
        "dialogue",
        "audio",
        "constraints",
        "references",
      ];
    case "video.image_to_video":
    case "video.text_to_video":
    case "video.multi_character":
    case "video.motion_transfer":
      return [
        "subject",
        "action",
        "environment",
        "camera",
        "lighting",
        "style",
        "composition",
        "constraints",
        "references",
      ];
    default: {
      const _e: never = profile;
      return _e;
    }
  }
}

function renderBlock(
  name: PromptBlockName,
  blocks: RenderableBlocks,
  language: string,
): string | null {
  switch (name) {
    case "subject": {
      const s = blocks.subject;
      const idReq = s.identityRequirements.join("; ");
      return [
        "SUBJECT:",
        `kind=${s.kind}`,
        delimitUntrustedData("subject_description", s.description),
        s.characterId ? `characterId=${s.characterId}` : null,
        s.productId ? `productId=${s.productId}` : null,
        idReq ? `identity=${idReq}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "action": {
      const a = blocks.action;
      return [
        "ACTION:",
        delimitUntrustedData("primary_action", a.primaryAction),
        a.secondaryActions.length
          ? `secondary=${a.secondaryActions.join(" | ")}`
          : null,
        `motion=${a.motionIntensity}`,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "environment": {
      const e = blocks.environment;
      return [
        "ENVIRONMENT:",
        `kind=${e.kind}`,
        `continuityKey=${e.continuityKey}`,
        e.timeOfDay ? `timeOfDay=${e.timeOfDay}` : null,
        e.weather ? `weather=${e.weather}` : null,
        `mood=${e.mood}`,
        delimitUntrustedData("environment", e.description),
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "camera": {
      const c = blocks.camera;
      return `CAMERA:\nshot=${c.shotSize}; angle=${c.angle}; move=${c.movement}; dof=${c.depthOfField}\nintent=${c.intent}`;
    }
    case "lighting": {
      const l = blocks.lighting;
      return `LIGHTING:\nsource=${l.source}; quality=${l.quality}; temp=${l.temperature}; contrast=${l.contrast}\nintent=${l.intent}`;
    }
    case "style": {
      const s = blocks.style;
      return [
        "STYLE:",
        `style=${s.style}; realism=${s.realism}`,
        `paletteRoles=${s.paletteRoles.join(",")}`,
        delimitUntrustedData("color_intent", s.colorIntent),
        delimitUntrustedData("brand_alignment", s.brandAlignment),
      ].join("\n");
    }
    case "composition": {
      const c = blocks.composition;
      return `COMPOSITION:\nsubject=${c.subjectPosition}; look=${c.lookDirection}; safeArea=${c.textSafeArea}\nhierarchy=${c.visualHierarchy}`;
    }
    case "dialogue": {
      if (!blocks.dialogue) return null;
      const d = blocks.dialogue;
      return [
        "DIALOGUE:",
        `kind=${d.kind}; language=${d.language}; emotion=${d.emotion}; fidelity=verbatim`,
        delimitUntrustedData("spoken_text", d.text),
      ].join("\n");
    }
    case "audio": {
      if (!blocks.audio) return null;
      const a = blocks.audio;
      return `AUDIO:\nkind=${a.kind}; language=${a.language}; lipsync=${a.requiresLipsync}`;
    }
    case "screenText": {
      if (!blocks.screenText) return null;
      // Prefer not embedding screen text into model prompt when post_production
      if (blocks.screenText.renderMode === "post_production") {
        return `SCREEN_TEXT:\nrenderMode=post_production; safeAreaRequired=${blocks.screenText.safeAreaRequired}\n(note: text applied in post — do not invent on-screen copy)`;
      }
      return [
        "SCREEN_TEXT:",
        `renderMode=model_generated; safeAreaRequired=${blocks.screenText.safeAreaRequired}`,
        delimitUntrustedData("screen_text", blocks.screenText.text),
      ].join("\n");
    }
    case "constraints": {
      const c = blocks.constraints;
      const lines = [
        ...c.required.map((x) => `REQ:${x.code}:${x.description}`),
        ...c.continuity.map((x) => `CONT:${x.code}:${x.description}`),
        ...c.safety.map((x) => `SAFE:${x.code}:${x.description}`),
      ];
      return lines.length ? `CONSTRAINTS:\n${lines.join("\n")}` : null;
    }
    case "references": {
      if (!blocks.references.length) return null;
      return (
        "REFERENCES:\n" +
        blocks.references
          .map((r) => `${r.kind}:${r.sourceId}:${r.role}:required=${r.required}`)
          .join("\n")
      );
    }
    default: {
      const _e: never = name;
      return _e;
    }
  }
  void language;
}

function renderNegative(blocks: RenderableBlocks): string {
  const parts = blocks.constraints.forbidden.map((f) => f.description);
  // Targeted defaults only when relevant
  parts.push("no identity drift", "no invented brands", "no extra people");
  const unique = [...new Set(parts.map((p) => p.trim()).filter(Boolean))];
  return clip(unique.join("; "), PROMPT_FIELD_LIMITS.negativeMax);
}

export function renderPromptVariant(input: {
  sceneId: string;
  profile: CapabilityProfile;
  mediaType: MediaType;
  language: string;
  blocks: RenderableBlocks;
}): PromptVariant {
  const included = blocksForProfile(input.profile).filter((name) => {
    if (name === "dialogue" && !input.blocks.dialogue) return false;
    if (name === "audio" && !input.blocks.audio) return false;
    if (name === "screenText" && !input.blocks.screenText) return false;
    return BLOCK_ORDER.includes(name);
  });

  // Stable order
  const ordered = BLOCK_ORDER.filter((n) => included.includes(n));
  const sections: string[] = [
    `PROFILE:${input.profile}`,
    `MEDIA:${input.mediaType}`,
    `RENDERER:${PROMPT_RENDERER_VERSION}`,
  ];
  for (const name of ordered) {
    const section = renderBlock(name, input.blocks, input.language);
    if (section) sections.push(section);
  }

  const positive = clip(sections.join("\n\n"), PROMPT_FIELD_LIMITS.positiveMax);
  const negative =
    input.mediaType === "audio" || input.mediaType === "lipsync"
      ? undefined
      : renderNegative(input.blocks);

  return {
    id: `var_${input.sceneId}_${input.profile.replace(/\./g, "_")}`,
    capabilityProfile: input.profile,
    mediaType: input.mediaType,
    positive,
    ...(negative ? { negative } : {}),
    rendererVersion: PROMPT_RENDERER_VERSION,
    language: input.language,
    includedBlocks: ordered,
  };
}

export function renderAllVariants(input: {
  sceneId: string;
  language: string;
  profiles: Array<{ profile: CapabilityProfile; mediaType: MediaType }>;
  blocks: RenderableBlocks;
}): PromptVariant[] {
  const seen = new Set<string>();
  const out: PromptVariant[] = [];
  for (const p of input.profiles) {
    if (seen.has(p.profile)) continue;
    seen.add(p.profile);
    out.push(
      renderPromptVariant({
        sceneId: input.sceneId,
        profile: p.profile,
        mediaType: p.mediaType,
        language: input.language,
        blocks: input.blocks,
      }),
    );
  }
  return out.slice(0, PROMPT_FIELD_LIMITS.variantsMax);
}
