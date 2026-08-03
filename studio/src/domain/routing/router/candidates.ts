/**
 * Strategy candidate construction and model resolution (VHS-108).
 */

import type { MediaAction } from "@/domain/cost";
import type { CapabilityProfile, ScenePackage } from "@/domain/prompt";
import {
  assertSnapshotFresh,
  evaluateEligibility,
  findProvider,
  listModelsForProfile,
  type CapabilityRegistrySnapshot,
  type CapabilityRequirements,
  type MediaOutputType,
  type ModelCapabilities,
} from "@/domain/routing/capabilities";
import type { StoryboardProject } from "@/domain/storyboard";
import { combinationKey, stepId } from "./deterministic-id";
import { RoutingDomainError } from "./errors";
import type { RoutingPolicy } from "./policy";
import type { StrategyDefinition, StrategyStepTemplate } from "./strategies";
import { strategiesForIntent } from "./strategy-library";

export type StepModelCandidate = {
  model: ModelCapabilities;
  eligibilityEvidence: string[];
};

export type InstantiatedStrategy = {
  strategy: StrategyDefinition;
  steps: Array<{
    template: StrategyStepTemplate;
    stepId: string;
    candidates: StepModelCandidate[];
  }>;
};

/**
 * Adapt full-scene requirements to a single strategy step.
 * Unknowns remain unknown — never invent capabilities.
 * Irrelevant identity / start-frame constraints are not applied to audio/t2v steps.
 */
export function requirementsForStep(
  base: CapabilityRequirements,
  template: StrategyStepTemplate,
): CapabilityRequirements {
  const profile = template.capabilityProfile;

  if (profile === "audio.voice") {
    return {
      ...base,
      requiredProfiles: [profile],
      expectedOutput: template.expectedOutput,
      mediaInputs: ["text"],
      requiredReferences: base.requiredReferences.filter((r) => r.kind === "voice"),
      needsDialogue: false,
      needsNativeAudio: true,
      identityPriority: "low",
      characterCount: 0,
    };
  }

  if (profile === "audio.lipsync") {
    return {
      ...base,
      requiredProfiles: [profile],
      expectedOutput: template.expectedOutput,
      mediaInputs: ["video", "audio"],
      requiredReferences: [],
      needsDialogue: base.needsDialogue,
      needsNativeAudio: false,
      identityPriority: "low",
      characterCount: base.characterCount,
    };
  }

  if (profile === "video.text_to_video" || profile === "motion.carousel") {
    return {
      ...base,
      requiredProfiles: [profile],
      expectedOutput: template.expectedOutput,
      mediaInputs: profile === "motion.carousel" ? ["image"] : ["text"],
      requiredReferences: [],
      needsDialogue: false,
      needsNativeAudio: false,
      identityPriority: "low",
      characterCount: 0,
    };
  }

  if (profile === "image.text_to_image") {
    return {
      ...base,
      requiredProfiles: [profile],
      expectedOutput: template.expectedOutput,
      mediaInputs: ["text"],
      requiredReferences: base.requiredReferences.filter(
        (r) => r.kind === "product" || r.kind === "brand" || r.kind === "screen",
      ),
      needsDialogue: false,
      needsNativeAudio: false,
      identityPriority: "low",
      characterCount: 0,
    };
  }

  // Identity-preserving image / i2v / multi-character / dialogue video
  return {
    ...base,
    requiredProfiles: [profile],
    expectedOutput: template.expectedOutput,
    needsDialogue: profile === "video.dialogue",
    needsNativeAudio: profile === "video.dialogue",
    identityPriority:
      profile === "image.reference_identity" ||
      profile === "video.image_to_video" ||
      profile === "video.multi_character" ||
      profile === "video.dialogue"
        ? base.identityPriority === "low"
          ? "medium"
          : base.identityPriority
        : "low",
  };
}

function sortModels(models: ModelCapabilities[]): ModelCapabilities[] {
  return [...models].sort((a, b) => {
    const c = a.providerId.localeCompare(b.providerId);
    return c !== 0 ? c : a.modelId.localeCompare(b.modelId);
  });
}

export function collectStepCandidates(input: {
  registry: CapabilityRegistrySnapshot;
  requirements: CapabilityRequirements;
  template: StrategyStepTemplate;
  policy: RoutingPolicy;
  at: string;
}): StepModelCandidate[] {
  const stepReq = requirementsForStep(input.requirements, input.template);
  const listed = listModelsForProfile(input.registry, input.template.capabilityProfile);
  const sorted = sortModels(listed);
  const out: StepModelCandidate[] = [];

  for (const model of sorted) {
    const provider = findProvider(input.registry, model.providerId);
    const verdict = evaluateEligibility(model, stepReq, input.at, provider);
    if (!verdict.eligible) continue;
    out.push({
      model,
      eligibilityEvidence: [
        `profile:${input.template.capabilityProfile}`,
        `status:${model.status}`,
        ...verdict.warnings.map((w) => `warn:${w.code}`),
      ],
    });
    if (out.length >= input.policy.maximumCandidatesPerStep) break;
  }
  return out;
}

export function instantiateStrategiesForScene(input: {
  scenePackage: ScenePackage;
  storyboard: StoryboardProject;
  requirements: CapabilityRequirements;
  registry: CapabilityRegistrySnapshot;
  policy: RoutingPolicy;
  at: string;
}): InstantiatedStrategy[] {
  assertSnapshotFresh(input.registry, input.at);
  const intent = input.scenePackage.productionIntent;
  const strategies = strategiesForIntent(intent).sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  const result: InstantiatedStrategy[] = [];
  for (const strategy of strategies) {
    const steps: InstantiatedStrategy["steps"] = [];
    let viable = true;
    for (const template of [...strategy.steps].sort((a, b) => a.order - b.order)) {
      const candidates = collectStepCandidates({
        registry: input.registry,
        requirements: input.requirements,
        template,
        policy: input.policy,
        at: input.at,
      });
      if (candidates.length === 0) {
        viable = false;
        break;
      }
      steps.push({
        template,
        stepId: stepId({
          sceneId: input.scenePackage.sceneId,
          strategyId: strategy.id,
          order: template.order,
          profile: template.capabilityProfile,
        }),
        candidates,
      });
    }
    if (viable) {
      result.push({ strategy, steps });
    }
  }
  return result;
}

export type ModelPick = {
  providerId: string;
  modelId: string;
  model: ModelCapabilities;
  eligibilityEvidence: string[];
};

export type StrategyCombination = {
  strategy: StrategyDefinition;
  key: string;
  picks: ModelPick[];
  stepIds: string[];
  templates: StrategyStepTemplate[];
};

/**
 * Bounded cartesian product of step candidates.
 * Order of exploration is lexical by provider/model (candidates already sorted).
 */
export function enumerateCombinations(
  instantiated: InstantiatedStrategy,
  maxCombinations: number,
): StrategyCombination[] {
  const steps = instantiated.steps;
  if (steps.length === 0) return [];

  let projected = 1;
  for (const s of steps) {
    projected *= s.candidates.length;
    if (projected > maxCombinations) {
      throw new RoutingDomainError(
        "combination_limit",
        "Strategy combination limit exceeded.",
        `${instantiated.strategy.id}:${projected}>${maxCombinations}`,
      );
    }
  }

  const combos: StrategyCombination[] = [];

  const walk = (index: number, acc: ModelPick[]) => {
    if (index >= steps.length) {
      const picks = acc.slice();
      combos.push({
        strategy: instantiated.strategy,
        key: combinationKey(
          instantiated.strategy.id,
          picks.map((p) => ({ providerId: p.providerId, modelId: p.modelId })),
        ),
        picks,
        stepIds: steps.map((s) => s.stepId),
        templates: steps.map((s) => s.template),
      });
      return;
    }
    const step = steps[index]!;
    for (const c of step.candidates) {
      walk(index + 1, [
        ...acc,
        {
          providerId: c.model.providerId,
          modelId: c.model.modelId,
          model: c.model,
          eligibilityEvidence: c.eligibilityEvidence,
        },
      ]);
    }
  };

  walk(0, []);
  return combos;
}

export function promptVariantIdFor(
  scenePackage: ScenePackage,
  profile: CapabilityProfile,
): string | undefined {
  const v = scenePackage.variants.find((x) => x.capabilityProfile === profile);
  return v?.id;
}

export function inputRefsForStep(
  scenePackage: ScenePackage,
  template: StrategyStepTemplate,
  priorStepIds: string[],
): Array<{ kind: "scene_reference" | "step_output" | "prompt_variant"; id: string; role: string }> {
  const refs: Array<{
    kind: "scene_reference" | "step_output" | "prompt_variant";
    id: string;
    role: string;
  }> = [];
  for (const r of scenePackage.references.filter((x) => x.required)) {
    refs.push({ kind: "scene_reference", id: r.id, role: r.role });
  }
  const variantId = promptVariantIdFor(scenePackage, template.capabilityProfile);
  if (variantId) {
    refs.push({ kind: "prompt_variant", id: variantId, role: "prompt" });
  }
  for (const depOrder of template.dependsOnOrders) {
    const dep = priorStepIds[depOrder - 1];
    if (dep) refs.push({ kind: "step_output", id: dep, role: `from_step_${depOrder}` });
  }
  return refs;
}

export type { MediaAction, MediaOutputType };
