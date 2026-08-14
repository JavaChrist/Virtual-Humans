/**
 * Memory-only scene-2 ScenePackageSet with visual/copy separation.
 * Does not persist or mutate the active Production artifact.
 */

import { createHash } from "node:crypto";
import { createArtifactMetadata } from "@/domain/shared";
import {
  PROMPT_RENDERER_VERSION,
  SCENE_PACKAGE_SET_ARTIFACT_TYPE,
  SCENE_PACKAGE_SET_SCHEMA_VERSION,
  ScenePackageSetSchema,
  type ScenePackage,
  type ScenePackageSet,
} from "@/domain/prompt";
import {
  fingerprintImageTextOverlaySpec,
  type ImageTextOverlaySpec,
} from "@/domain/production/image-text-overlay";
import {
  fingerprintImageVisualVariant,
  type ImageVisualVariant,
} from "@/domain/production/image-visual-variant";
import { overlayCopyFromSpec } from "@/domain/production/overlay-copy-leak";
import { PHASE_11A_SMOKE_SCENE_ID } from "./phase-11a-openai-image-allowlist";
import { separatePhase11AVisualAndText } from "./phase-11a-visual-text-separation";

export const PHASE_11A_SCENE2_VISUAL_PACKAGE_VERSION =
  "phase-11a-scene2-visual-package-1.0.0" as const;

export type Phase11AScene2VisualPackageSet = {
  persist: false;
  mutateActiveProductionArtifact: false;
  sceneId: typeof PHASE_11A_SMOKE_SCENE_ID;
  scenePackageSet: ScenePackageSet;
  visualVariant: ImageVisualVariant;
  textOverlaySpec: ImageTextOverlaySpec;
  visualVariantFingerprint: string;
  overlayFingerprint: string;
  fingerprint: string;
};

function assertNoInlineMedia(blob: string): void {
  if (/https?:\/\/|data:image\/|base64,/i.test(blob)) {
    throw new Error("Phase 11A ScenePackageSet must not contain URLs or inline media.");
  }
}

export function fingerprintPhase11AScene2VisualPackage(input: {
  visualVariantFingerprint: string;
  overlayFingerprint: string;
  scenePackageId: string;
  rendererVersion: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        v: PHASE_11A_SCENE2_VISUAL_PACKAGE_VERSION,
        sceneId: PHASE_11A_SMOKE_SCENE_ID,
        visualVariantFingerprint: input.visualVariantFingerprint,
        overlayFingerprint: input.overlayFingerprint,
        scenePackageId: input.scenePackageId,
        rendererVersion: input.rendererVersion,
      }),
      "utf8",
    )
    .digest("hex");
}

export function buildPhase11AScene2VisualPackageSet(input: {
  scenePackage: ScenePackage;
  overlay: ImageTextOverlaySpec;
  projectId: string;
  createdBy: string;
  correlationId: string;
  setId?: string;
}): Phase11AScene2VisualPackageSet {
  const pkg: ScenePackage = {
    ...input.scenePackage,
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    sceneOrder: 2,
    productionIntent: "text_motion",
  };
  const sep = separatePhase11AVisualAndText({ pkg, overlay: input.overlay });
  const copy = overlayCopyFromSpec(input.overlay);
  const variantBlob = JSON.stringify(pkg.variants);
  for (const s of copy) {
    if (s.length >= 8 && variantBlob.includes(s)) {
      throw new Error("Phase 11A ScenePackageSet: overlay copy present in visual variants.");
    }
  }

  const metadata = createArtifactMetadata({
    id: input.setId ?? `pkgset-11a-scene2-${pkg.id}`.slice(0, 64),
    projectId: input.projectId,
    createdBy: input.createdBy,
    correlationId: input.correlationId,
    schemaVersion: SCENE_PACKAGE_SET_SCHEMA_VERSION,
  });
  const scenePackageSet = ScenePackageSetSchema.parse({
    ...metadata,
    artifactType: SCENE_PACKAGE_SET_ARTIFACT_TYPE,
    storyboardRevisionId: pkg.storyboardRevisionId,
    rendererVersion: PROMPT_RENDERER_VERSION,
    packages: [pkg],
  });
  assertNoInlineMedia(JSON.stringify(scenePackageSet));
  assertNoInlineMedia(JSON.stringify(sep.visualVariant));

  const overlayFingerprint = fingerprintImageTextOverlaySpec(input.overlay);
  const visualVariantFingerprint = fingerprintImageVisualVariant(sep.visualVariant);
  const fingerprint = fingerprintPhase11AScene2VisualPackage({
    visualVariantFingerprint,
    overlayFingerprint,
    scenePackageId: pkg.id,
    rendererVersion: PROMPT_RENDERER_VERSION,
  });

  return {
    persist: false,
    mutateActiveProductionArtifact: false,
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    scenePackageSet,
    visualVariant: sep.visualVariant,
    textOverlaySpec: input.overlay,
    visualVariantFingerprint,
    overlayFingerprint,
    fingerprint,
  };
}
