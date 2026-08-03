import { finalizeVisualDirection } from "@/domain/art";
import {
  makeArtChain,
  makeGenericSnapshot,
  makeValidArtCandidate,
} from "@/domain/art/__tests__/fixtures";
import { SCRIPT_PURPOSE_TO_SCENE } from "../scene";
import { defaultContinuityKeys } from "../continuity";
import type { StoryboardAnalysisCandidate } from "../storyboard-project";
import type { VisualDirection } from "@/domain/art";
import type { VideoScript } from "@/domain/script";

export function makeStoryboardChain(options: { withCharacter?: boolean } = {}) {
  const artChain = makeArtChain({ withCharacter: options.withCharacter });
  const snap = options.withCharacter ? makeGenericSnapshot() : undefined;
  const artCandidate = makeValidArtCandidate(
    artChain.videoScript.segments.map((s) => s.id),
    { withCharacter: options.withCharacter },
  );
  const visualDirection = finalizeVisualDirection({
    brief: artChain.brief,
    marketingPlan: artChain.marketingPlan,
    creativeConcept: artChain.creativeConcept,
    videoScript: artChain.videoScript,
    candidate: artCandidate,
    characterCapabilities: snap,
    metadata: {
      id: "art-1",
      createdBy: "tester",
      correlationId: "corr-art-1",
    },
  });
  return { ...artChain, visualDirection, snap };
}

function spokenForSegment(
  seg: VideoScript["segments"][number],
  characterId?: string,
): StoryboardAnalysisCandidate["scenes"][number]["spokenContent"] {
  if (seg.speaker === "character" && seg.dialogue) {
    return {
      kind: "dialogue",
      sourceText: seg.dialogue,
      ...(characterId ? { characterId } : {}),
    };
  }
  if (seg.speaker === "voice_over" && seg.voiceOver) {
    return { kind: "voice_over", sourceText: seg.voiceOver };
  }
  return { kind: "none" };
}

function intentFor(
  purpose: VideoScript["segments"][number]["purpose"],
): StoryboardAnalysisCandidate["scenes"][number]["productionIntent"] {
  if (purpose === "cta") return "talking_head";
  if (purpose === "proof") return "voice_over_visual";
  if (purpose === "problem") return "b_roll";
  return "talking_head";
}

export function makeValidStoryboardCandidate(
  script: VideoScript,
  visual: VisualDirection,
  options: {
    withCharacter?: boolean;
    splitFirstSegment?: boolean;
    overrides?: Partial<StoryboardAnalysisCandidate>;
  } = {},
): StoryboardAnalysisCandidate {
  const characterId = options.withCharacter ? "char-generic-01" : undefined;
  const scenes: StoryboardAnalysisCandidate["scenes"] = [];
  let order = 1;

  for (const seg of [...script.segments].sort((a, b) => a.order - b.order)) {
    const vd = visual.segments.find((v) => v.scriptSegmentId === seg.id)!;
    const keys = defaultContinuityKeys(visual, vd.id);
    const purpose =
      SCRIPT_PURPOSE_TO_SCENE[
        seg.purpose as keyof typeof SCRIPT_PURPOSE_TO_SCENE
      ] ?? "presentation";

    const refs =
      options.withCharacter && vd.character
        ? [
            {
              id: `ref-${seg.id}-char`,
              kind: "character" as const,
              sourceId: vd.character.characterId,
              role: "presenter",
              required: true,
            },
            ...(vd.character.outfitId
              ? [
                  {
                    id: `ref-${seg.id}-outfit`,
                    kind: "outfit" as const,
                    sourceId: vd.character.outfitId,
                    role: "wardrobe",
                    required: true,
                  },
                ]
              : []),
          ]
        : [];

    if (options.splitFirstSegment && seg.order === 1 && seg.dialogue) {
      const words = seg.dialogue.trim().split(/\s+/);
      const mid = Math.ceil(words.length / 2);
      const part1 = words.slice(0, mid).join(" ");
      const part2 = words.slice(mid).join(" ");
      scenes.push({
        id: `sc-${order}`,
        order: order++,
        title: `${purpose} A`,
        purpose,
        scriptSegmentId: seg.id,
        visualDirectionSegmentId: vd.id,
        productionIntent: intentFor(seg.purpose),
        spokenContent: {
          kind: "dialogue",
          sourceText: part1,
          ...(characterId ? { characterId } : {}),
        },
        references: refs,
        transition: { type: "cut", durationSeconds: 0 },
        continuityKeys: keys,
      });
      scenes.push({
        id: `sc-${order}`,
        order: order++,
        title: `${purpose} B`,
        purpose,
        scriptSegmentId: seg.id,
        visualDirectionSegmentId: vd.id,
        productionIntent: intentFor(seg.purpose),
        spokenContent: {
          kind: "dialogue",
          sourceText: part2,
          ...(characterId ? { characterId } : {}),
        },
        references: refs,
        transition: { type: "cut", durationSeconds: 0 },
        continuityKeys: keys,
      });
      continue;
    }

    scenes.push({
      id: `sc-${order}`,
      order: order++,
      title: purpose,
      purpose,
      scriptSegmentId: seg.id,
      visualDirectionSegmentId: vd.id,
      productionIntent: intentFor(seg.purpose),
      spokenContent: spokenForSegment(seg, characterId),
      ...(seg.screenText ? { screenText: seg.screenText } : {}),
      references: refs,
      transition: { type: "cut", durationSeconds: 0 },
      continuityKeys: keys,
    });
  }

  // Last transition none
  if (scenes.length) {
    scenes[scenes.length - 1]!.transition = { type: "none", durationSeconds: 0 };
  }

  return {
    title: script.title,
    scenes,
    assumptions: [
      {
        id: "sb-a1",
        statement: "Une scène par segment suffit pour ce spot 30s.",
        status: "explicit",
        affectsFields: ["scenes"],
      },
    ],
    ...options.overrides,
  };
}
