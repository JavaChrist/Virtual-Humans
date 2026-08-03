import { finalizeStoryboardProject } from "@/domain/storyboard";
import {
  makeStoryboardChain,
  makeValidStoryboardCandidate,
} from "@/domain/storyboard/__tests__/fixtures";
import type { PromptAnalysisCandidate } from "../scene-package";

export function makePromptChain(options: { withCharacter?: boolean } = {}) {
  const chain = makeStoryboardChain({ withCharacter: options.withCharacter });
  const sbCandidate = makeValidStoryboardCandidate(
    chain.videoScript,
    chain.visualDirection,
    { withCharacter: options.withCharacter },
  );
  const storyboard = finalizeStoryboardProject({
    brief: chain.brief,
    marketingPlan: chain.marketingPlan,
    creativeConcept: chain.creativeConcept,
    videoScript: chain.videoScript,
    visualDirection: chain.visualDirection,
    candidate: sbCandidate,
    metadata: {
      id: "sb-1",
      createdBy: "tester",
      correlationId: "corr-sb-1",
    },
  });
  return { ...chain, storyboard };
}

export function makeValidPromptCandidate(
  overrides: Partial<PromptAnalysisCandidate> = {},
): PromptAnalysisCandidate {
  return {
    sceneHints: [],
    assumptions: [
      {
        id: "p-a1",
        statement: "Hints optionnels uniquement — les blocs viennent des sources.",
        status: "explicit",
        affectsFields: ["action"],
      },
    ],
    ...overrides,
  };
}
