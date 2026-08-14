/**
 * Source-aware validation for Prompt Director (VHS-106).
 */

import type { VisualDirection } from "@/domain/art";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type { VideoScript } from "@/domain/script";
import type { StoryboardProject } from "@/domain/storyboard";
import { findConstraintContradictions } from "./constraints";
import {
  findingsToIssues,
  scanUntrustedText,
} from "./injection-safety";
import type {
  MissingInformation,
  PromptValidationIssue,
  PromptWarning,
} from "./errors";
import { PromptAnalysisCandidateSchema } from "./schemas";
import type { PromptAnalysisCandidate, ScenePackage } from "./scene-package";
import { assertProfilesVendorAgnostic } from "./capability-profiles";
import { buildBlocksForScene } from "./builders";

const TECHNICAL_KEYS = [
  "provider",
  "providerId",
  "modelId",
  "model",
  "costCents",
  "fallback",
  "generationPlan",
  "apiParams",
] as const;

function issue(code: string, message: string, field?: string): PromptValidationIssue {
  return { code, message, field };
}

export function assertNoTechnicalLeak(
  value: PromptAnalysisCandidate | Record<string, unknown>,
): PromptValidationIssue[] {
  const issues: PromptValidationIssue[] = [];
  const record = value as unknown as Record<string, unknown>;
  for (const key of TECHNICAL_KEYS) {
    if (key in record) {
      issues.push(issue("technical_leak", "Paramètre technique interdit.", key));
    }
  }
  return issues;
}

export function scanChainForInjection(
  brief: VideoProjectBrief,
  plan: MarketingPlan,
  concept: CreativeConcept,
  script: VideoScript,
  visual: VisualDirection,
  storyboard: StoryboardProject,
): { issues: PromptValidationIssue[]; warnings: PromptWarning[] } {
  const findings = [
    ...scanUntrustedText(brief.subjectDescription, "brief.subjectDescription"),
    ...scanUntrustedText(brief.brandConstraints, "brief.brandConstraints"),
    ...scanUntrustedText(brief.audienceDescription, "brief.audienceDescription"),
    ...scanUntrustedText(plan.mainBenefit, "marketingPlan.mainBenefit"),
    ...scanUntrustedText(plan.emotionalHook, "marketingPlan.emotionalHook"),
    ...scanUntrustedText(concept.bigIdea, "creativeConcept.bigIdea"),
    ...scanUntrustedText(concept.logline, "creativeConcept.logline"),
    ...visual.segments.flatMap((s) => [
      ...scanUntrustedText(s.location.description, `visual.segments.${s.id}.location`),
      ...scanUntrustedText(s.environment.description, `visual.segments.${s.id}.environment`),
    ]),
    ...storyboard.scenes.flatMap((sc) => [
      ...scanUntrustedText(sc.title, `storyboard.scenes.${sc.id}.title`),
      ...(sc.spokenContent.kind !== "none"
        ? scanUntrustedText(sc.spokenContent.sourceText, `storyboard.scenes.${sc.id}.spoken`)
        : []),
    ]),
  ];
  // Spoken dialogue is source of truth — injection patterns in dialogue are warnings only
  // unless they're structural system delimiters. Reclassify spoken-only role_override as warning.
  const adjusted = findings.map((f) => {
    if (f.field.includes(".spoken") && f.code === "role_override") {
      return { ...f, severity: "warning" as const, publicMessage: `Dialogue suspect (${f.code}).` };
    }
    return f;
  });
  return findingsToIssues(adjusted);
}

export function validatePackageCoverage(
  packages: ScenePackage[],
  storyboard: StoryboardProject,
): PromptValidationIssue[] {
  const issues: PromptValidationIssue[] = [];
  if (packages.length !== storyboard.scenes.length) {
    issues.push(
      issue(
        "coverage_violation",
        `Nombre de packages (${packages.length}) ≠ scènes (${storyboard.scenes.length}).`,
        "packages",
      ),
    );
  }
  const byId = new Map(packages.map((p) => [p.sceneId, p]));
  for (const sc of storyboard.scenes) {
    const pkg = byId.get(sc.id);
    if (!pkg) {
      issues.push(issue("coverage_violation", `Package manquant pour scène ${sc.id}`, "packages"));
      continue;
    }
    if (pkg.sceneOrder !== sc.order) {
      issues.push(
        issue("coverage_violation", `Ordre incorrect pour ${sc.id}`, `packages.${sc.id}`),
      );
    }
    if (pkg.projectId !== storyboard.projectId) {
      issues.push(
        issue("coverage_violation", "projectId différent du Storyboard.", `packages.${sc.id}`),
      );
    }
    if (pkg.storyboardRevisionId !== storyboard.id) {
      issues.push(
        issue(
          "coverage_violation",
          "storyboardRevisionId incorrect.",
          `packages.${sc.id}`,
        ),
      );
    }
    if (pkg.productionIntent !== sc.productionIntent) {
      issues.push(
        issue(
          "fidelity_violation",
          "productionIntent modifié.",
          `packages.${sc.id}.productionIntent`,
        ),
      );
    }
  }
  for (const pkg of packages) {
    if (!storyboard.scenes.some((s) => s.id === pkg.sceneId)) {
      issues.push(
        issue("coverage_violation", `Package supplémentaire ${pkg.sceneId}`, "packages"),
      );
    }
  }
  return issues;
}

export function validateFidelity(
  pkg: ScenePackage,
  storyboard: StoryboardProject,
  script: VideoScript,
  visual: VisualDirection,
): PromptValidationIssue[] {
  const issues: PromptValidationIssue[] = [];
  const scene = storyboard.scenes.find((s) => s.id === pkg.sceneId);
  if (!scene) return issues;

  if (scene.spokenContent.kind !== "none") {
    if (!pkg.dialogue || pkg.dialogue.text !== scene.spokenContent.sourceText) {
      issues.push(
        issue("fidelity_violation", "Dialogue non verbatim.", `packages.${pkg.sceneId}.dialogue`),
      );
    }
    if (pkg.dialogue && pkg.dialogue.fidelity !== "verbatim") {
      issues.push(issue("fidelity_violation", "fidelity doit être verbatim.", "dialogue"));
    }
  }

  if (scene.screenText && pkg.screenText?.text !== scene.screenText) {
    issues.push(
      issue("fidelity_violation", "Texte écran modifié.", `packages.${pkg.sceneId}.screenText`),
    );
  }

  const vd = visual.segments.find((v) => v.id === scene.visualDirectionSegmentId);
  if (vd) {
    if (pkg.camera.shotSize !== vd.camera.shotSize || pkg.camera.angle !== vd.camera.angle) {
      issues.push(issue("fidelity_violation", "Caméra modifiée.", `packages.${pkg.sceneId}.camera`));
    }
    if (pkg.lighting.source !== vd.lighting.source) {
      issues.push(
        issue("fidelity_violation", "Lumière modifiée.", `packages.${pkg.sceneId}.lighting`),
      );
    }
    if (pkg.style.style !== visual.globalStyle.style) {
      issues.push(issue("fidelity_violation", "Style modifié.", `packages.${pkg.sceneId}.style`));
    }
  }

  // References must be subset of storyboard scene refs
  const allowed = new Set(scene.references.map((r) => `${r.kind}:${r.sourceId}`));
  for (const ref of pkg.references) {
    if (!allowed.has(`${ref.kind}:${ref.sourceId}`)) {
      issues.push(
        issue(
          "fidelity_violation",
          "Référence absente du Storyboard.",
          `packages.${pkg.sceneId}.references`,
        ),
      );
    }
  }
  for (const ref of scene.references.filter((r) => r.required)) {
    if (!pkg.references.some((r) => r.kind === ref.kind && r.sourceId === ref.sourceId)) {
      issues.push(
        issue(
          "reference_unavailable",
          `Référence requise absente: ${ref.kind}:${ref.sourceId}`,
          `packages.${pkg.sceneId}.references`,
        ),
      );
    }
  }

  // No invented character
  if (pkg.subject.characterId && vd?.character?.characterId) {
    if (pkg.subject.characterId !== vd.character.characterId) {
      issues.push(
        issue("fidelity_violation", "Personnage ajouté/modifié.", `packages.${pkg.sceneId}.subject`),
      );
    }
  }

  void script;
  return issues;
}

export function validateCandidateAgainstSources(
  candidate: PromptAnalysisCandidate,
  brief: VideoProjectBrief,
  plan: MarketingPlan,
  concept: CreativeConcept,
  script: VideoScript,
  visual: VisualDirection,
  storyboard: StoryboardProject,
): {
  issues: PromptValidationIssue[];
  warnings: PromptWarning[];
  missingInformation: MissingInformation[];
} {
  const issues: PromptValidationIssue[] = [];
  const warnings: PromptWarning[] = [];
  const missingInformation: MissingInformation[] = [];

  const schema = PromptAnalysisCandidateSchema.safeParse(candidate);
  if (!schema.success) {
    for (const i of schema.error.issues) {
      issues.push({
        code: "invalid_candidate",
        field: i.path.join(".") || undefined,
        message: i.message,
      });
    }
    return { issues, warnings, missingInformation };
  }

  issues.push(...assertNoTechnicalLeak(candidate));

  const inj = scanChainForInjection(brief, plan, concept, script, visual, storyboard);
  issues.push(...inj.issues);
  warnings.push(...inj.warnings);

  // Chain links
  if (storyboard.visualDirectionRevisionId !== visual.id) {
    issues.push(
      issue(
        "incoherent_with_sources",
        "storyboard.visualDirectionRevisionId ≠ visual.id",
        "storyboardRevisionId",
      ),
    );
  }
  if (storyboard.videoScriptRevisionId !== script.id) {
    issues.push(
      issue(
        "incoherent_with_sources",
        "storyboard.videoScriptRevisionId ≠ script.id",
        "storyboardRevisionId",
      ),
    );
  }
  if (
    brief.projectId !== plan.projectId ||
    plan.projectId !== concept.projectId ||
    concept.projectId !== script.projectId ||
    script.projectId !== visual.projectId ||
    visual.projectId !== storyboard.projectId
  ) {
    issues.push(issue("incoherent_with_sources", "Projets incompatibles.", "projectId"));
  }

  // Probe rebuild + constraints for each scene
  for (const scene of storyboard.scenes) {
    const blocks = buildBlocksForScene({
      scene,
      brief,
      plan,
      script,
      visual,
      storyboard,
      candidate,
      concept,
    });
    const contradictions = findConstraintContradictions(blocks.constraints);
    for (const c of contradictions) {
      issues.push(issue(c.code, c.message, `scenes.${scene.id}.constraints`));
    }
    for (const ref of scene.references.filter((r) => r.required)) {
      if (!blocks.references.some((r) => r.kind === ref.kind && r.sourceId === ref.sourceId)) {
        missingInformation.push({
          code: "reference_unavailable",
          field: `scenes.${scene.id}.references`,
          message: `Référence requise introuvable: ${ref.kind}:${ref.sourceId}`,
          required: true,
        });
      }
    }
  }

  const corpus = [candidate.notes, ...(candidate.sceneHints ?? []).map((h) => h.notes)]
    .filter(Boolean)
    .join("\n");
  if (/\b(il est établi|it is a fact|prouvé que)\b/i.test(corpus)) {
    issues.push(
      issue("incoherent_with_sources", "Hypothèse transformée en fait refusée.", "notes"),
    );
  }
  if (/\b(change le dialogue|modifie le CTA|nouvel asset|ajoute un personnage)\b/i.test(corpus)) {
    issues.push(issue("incoherent_with_sources", "Modification de source refusée.", "notes"));
  }

  // Vendor leak in candidate text
  if (!assertProfilesVendorAgnostic([corpus])) {
    issues.push(
      issue("responsibility_leak", "Nom de provider/modèle détecté.", "notes"),
    );
  }

  const seen = new Set<string>();
  return {
    issues: issues.filter((i) => {
      const k = `${i.code}|${i.field}|${i.message}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }),
    warnings,
    missingInformation,
  };
}
