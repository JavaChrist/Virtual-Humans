/**
 * Director postproduction delivery persistence against LOCAL Supabase (VHS-125).
 * Fake merge engine only — no real fal/OpenAI/ElevenLabs/AICCOS calls.
 *
 * Simplifies the Phase 4 pipeline: seeds brief + storyboard + scene packages +
 * a terminal production_result directly, then runs quality -> human review ->
 * merge -> export end to end.
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { resolveLocalSupabaseGate } from "./local-integration.gate";
import { cleanupWorkspace, createLocalClients, randomUUID } from "./integration-harness";
import { createDirectorPersistenceStack } from "./director-server";
import { createSupabaseCreateProjectWithBriefPort } from "./repositories/create-project-with-brief";
import { BRIEF_SCHEMA_VERSION, finalizeBrief } from "@/domain/brief";
import {
  makePackages,
  makeProductionResultV1,
  makeStoryboard,
} from "@/domain/postproduction/__tests__/fixtures";
import { PRODUCTION_RESULT_SCHEMA_VERSION_V1 } from "@/domain/production";
import {
  PROMPT_RENDERER_VERSION,
  SCENE_PACKAGE_SET_ARTIFACT_TYPE,
  SCENE_PACKAGE_SET_SCHEMA_VERSION,
  type ScenePackage,
} from "@/domain/prompt";
import { createArtifactMetadata } from "@/domain/shared";
import {
  buildSyntheticFakeMp4Bytes,
  SYNTHETIC_FAKE_MP4_MARKER,
} from "@/application/postproduction/asset-content-port";

const gate = resolveLocalSupabaseGate();
if (!gate.ok) throw new Error(`VHS-125: ${gate.reason}`);

const { client } = createLocalClients(gate);
const workspaces: string[] = [];

after(async () => {
  for (const ws of workspaces) {
    await cleanupWorkspace(client, ws).catch(() => undefined);
  }
});

/**
 * `makePackages`/`makeMinimalPackage` predate the current EnvironmentBlock/CameraBlock/
 * LightingBlock/StyleBlock shapes — patch them here so the artifact round-trips through
 * `ScenePackageSetSchema.safeParse` inside `loadProductionContext`.
 */
function toValidPackage(pkg: ScenePackage): ScenePackage {
  return {
    ...pkg,
    environment: { kind: "interior", description: "Studio", continuityKey: "loc-1", mood: "calm" },
    camera: {
      shotSize: "medium",
      angle: "eye_level",
      movement: "static",
      depthOfField: "medium",
      intent: "establish",
    },
    lighting: {
      source: "soft",
      quality: "diffuse",
      temperature: "neutral",
      contrast: "medium",
      intent: "natural",
    },
    style: {
      style: "photoreal",
      realism: "high",
      colorIntent: "brand palette",
      brandAlignment: "on-brand",
      paletteRoles: ["primary"],
    },
  };
}

test("VHS-125 — quality -> human review -> merge -> export (fake merge only)", async () => {
  const workspaceId = randomUUID();
  workspaces.push(workspaceId);
  await client.from("workspaces").insert({
    id: workspaceId,
    slug: `s125-${workspaceId.slice(0, 8)}`,
    name: "Prd 125",
    mode: "single_workspace",
  });
  await client.from("workspace_budget_policies").insert({
    workspace_id: workspaceId,
    hard_limit_minor: 1_000_000,
    currency: "USD",
  });

  const projectId = randomUUID();
  const briefArtifactId = randomUUID();
  const brief = finalizeBrief(
    {
      draftVersion: "1.0.0",
      updatedAt: "2026-08-03T14:00:00.000Z",
      currentStep: 5,
      fields: {
        projectName: "Campagne 125",
        subjectType: "product",
        subjectName: "Widget",
        subjectDescription: "Produit de mobilité urbaine fiable pour navetteurs.",
        objective: "conversion",
        platform: "instagram",
        durationSeconds: 20,
        aspectRatio: "9:16",
        language: "fr",
        tone: "energetic",
        callToAction: "Téléchargez l'app et réservez",
        audienceDescription: "Navetteurs urbains pressés.",
        mediaReferences: [],
      },
    },
    {
      id: briefArtifactId,
      projectId,
      createdBy: "tester",
      correlationId: "corr-125-it",
      createdAt: "2026-08-03T14:00:00.000Z",
      revision: 1,
    },
  );

  await createSupabaseCreateProjectWithBriefPort({ client }).execute({
    workspaceId,
    projectId,
    artifactId: briefArtifactId,
    projectName: brief.projectName,
    brief: { ...brief } as unknown as Record<string, unknown>,
    schemaVersion: BRIEF_SCHEMA_VERSION,
    correlationId: "corr-125-it",
    actorType: "shared_password",
    actorId: "tester",
    createdBy: "tester",
  });

  const env = {
    DIRECTOR_V2_ENABLED: "1",
    DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  };
  const stack = createDirectorPersistenceStack({ client, workspaceId, env });
  const at = "2026-08-03T14:05:00.000Z";

  // --- Seed storyboard + scene packages + a terminal production_result directly ---
  const storyboard = makeStoryboard({ id: "sb-125", projectId, createdAt: at });
  const storyboardArtifactId = randomUUID();
  await stack.artifacts.append({
    id: storyboardArtifactId,
    workspaceId,
    projectId,
    artifactType: "storyboard_project",
    revision: 1,
    schemaVersion: storyboard.schemaVersion,
    parentRevisionId: null,
    value: storyboard,
    createdAt: at,
    createdBy: "tester",
    correlationId: "corr-125-sb",
  });
  await stack.artifacts.setActive({
    projectId,
    artifactType: "storyboard_project",
    artifactId: storyboardArtifactId,
    expectedRevision: 0,
    updatedBy: "tester",
  });

  const scenePackages = makePackages(false).map(toValidPackage);
  const packageSetArtifactId = randomUUID();
  await stack.artifacts.append({
    id: packageSetArtifactId,
    workspaceId,
    projectId,
    artifactType: "scene_package_set",
    revision: 1,
    schemaVersion: SCENE_PACKAGE_SET_SCHEMA_VERSION,
    parentRevisionId: null,
    value: {
      ...createArtifactMetadata({
        id: packageSetArtifactId,
        projectId,
        createdBy: "tester",
        correlationId: "corr-125-pkg",
        createdAt: at,
      }),
      artifactType: SCENE_PACKAGE_SET_ARTIFACT_TYPE,
      storyboardRevisionId: storyboard.id,
      rendererVersion: PROMPT_RENDERER_VERSION,
      packages: scenePackages,
    },
    createdAt: at,
    createdBy: "tester",
    correlationId: "corr-125-pkg",
  });
  await stack.artifacts.setActive({
    projectId,
    artifactType: "scene_package_set",
    artifactId: packageSetArtifactId,
    expectedRevision: 0,
    updatedBy: "tester",
  });

  const productionResult = makeProductionResultV1({
    id: `pr-${projectId.slice(0, 8)}`,
    projectId,
    createdAt: at,
    createdBy: "tester",
    correlationId: "corr-125-pr",
  });
  const productionResultArtifactId = randomUUID();
  await stack.artifacts.append({
    id: productionResultArtifactId,
    workspaceId,
    projectId,
    artifactType: "production_result",
    revision: 1,
    schemaVersion: PRODUCTION_RESULT_SCHEMA_VERSION_V1,
    parentRevisionId: null,
    value: productionResult,
    createdAt: at,
    createdBy: "tester",
    correlationId: "corr-125-pr",
  });
  await stack.artifacts.setActive({
    projectId,
    artifactType: "production_result",
    artifactId: productionResultArtifactId,
    expectedRevision: 0,
    updatedBy: "tester",
  });

  const ctx = { correlationId: "corr-125-qc", mode: "execute" as const, createdBy: "tester" };

  // --- 1. Quality evaluation ---
  const dryQc = await stack.evaluateQuality.dryRun({ projectId }, ctx);
  assert.equal(dryQc.providerCalled, false);
  assert.equal(dryQc.executable, true, JSON.stringify(dryQc));

  const qc = await stack.evaluateQuality.execute({ projectId, confirmation: true }, ctx);
  assert.equal(qc.status, "completed", JSON.stringify(qc));
  if (qc.status !== "completed" && qc.status !== "existing") return;
  assert.equal(qc.humanReviewRequired, true, "unmeasurable checks force needs_review");

  const { data: qualityRun } = await client
    .from("director_runs")
    .select("cost_status, provider_id, status")
    .eq("project_id", projectId)
    .eq("director_type", "quality")
    .maybeSingle();
  assert.equal(qualityRun?.cost_status, "none");
  assert.equal(qualityRun?.status, "completed");

  const qrActive = await stack.artifacts.getActive(projectId, "quality_report");
  const prAfterQc = await stack.artifacts.getActive(projectId, "production_result");
  assert.ok(qrActive && prAfterQc);

  // --- 2. Human review (append-only) ---
  const review = await stack.recordQualityReview.execute(
    {
      projectId,
      decision: "approved",
      reviewedIssueCodes: [],
      comment: "Validated by human reviewer.",
      expectedQualityReportRevision: qrActive!.revision,
      expectedProductionResultRevision: prAfterQc!.revision,
      confirmation: true,
    },
    { ...ctx, correlationId: "corr-125-review" },
  );
  assert.equal(review.status, "recorded", JSON.stringify(review));

  const { count: reviewCount } = await client
    .from("human_review_decisions")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);
  assert.equal(reviewCount, 1, "exactly one append-only review row");

  const prAfterReview = await stack.artifacts.getActive(projectId, "production_result");
  const prAfterReviewArtifact = await stack.artifacts.load(prAfterReview!.artifactId);
  assert.equal(
    (prAfterReviewArtifact!.value as { delivery?: { status?: string } }).delivery?.status,
    "merge_ready",
  );

  // --- 3-4. Merge (fake sync engine only) ---
  const dryPrepMerge = await stack.prepareMerge.dryRun({ projectId }, { ...ctx, correlationId: "corr-125-mrgp-dry" });
  assert.equal(dryPrepMerge.providerCalled, false);
  assert.equal(dryPrepMerge.executable, true, JSON.stringify(dryPrepMerge));

  const prepMerge = await stack.prepareMerge.execute(
    { projectId, confirmation: true },
    { ...ctx, correlationId: "corr-125-mrgp" },
  );
  assert.equal(prepMerge.status, "prepared", JSON.stringify(prepMerge));

  const dryExecMerge = await stack.executeMerge.dryRun({ projectId }, { ...ctx, correlationId: "corr-125-mrge-dry" });
  assert.equal(dryExecMerge.providerCalled, false);
  assert.equal(dryExecMerge.executable, true, JSON.stringify(dryExecMerge));

  const execMerge = await stack.executeMerge.execute(
    { projectId, confirmation: true },
    { ...ctx, correlationId: "corr-125-mrge" },
  );
  assert.equal(execMerge.status, "completed", JSON.stringify(execMerge));
  if (execMerge.status !== "completed" && execMerge.status !== "existing") return;
  assert.equal(execMerge.finalAsset.source.kind, "internal", "fake merge never returns external URLs");
  if (execMerge.finalAsset.source.kind === "internal") {
    assert.match(
      execMerge.finalAsset.source.storagePath,
      /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.mp4$/i,
      "durable Storage path after merge",
    );
    assert.equal(execMerge.finalAsset.source.storagePath.includes("fake-merge/"), false);
  }

  // prepare + execute each create a merge director_run — assert the latest completed one.
  const { data: mergeRuns } = await client
    .from("director_runs")
    .select("cost_status, provider_id, status, created_at")
    .eq("project_id", projectId)
    .eq("director_type", "merge")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1);
  const mergeRun = mergeRuns?.[0];
  assert.ok(mergeRun, "at least one completed merge director_run expected");
  assert.equal(mergeRun.cost_status, "none");
  assert.equal(mergeRun.provider_id, "deterministic");

  // --- 5. Export ---
  const dryExport = await stack.prepareExport.dryRun({ projectId }, { ...ctx, correlationId: "corr-125-exp-dry" });
  assert.equal(dryExport.providerCalled, false);
  assert.equal(dryExport.executable, true, JSON.stringify(dryExport));

  const exportResult = await stack.prepareExport.execute(
    { projectId, confirmation: true },
    { ...ctx, correlationId: "corr-125-exp" },
  );
  assert.equal(exportResult.status, "prepared", JSON.stringify(exportResult));
  if (exportResult.status !== "prepared" && exportResult.status !== "existing") return;
  assert.equal(exportResult.exportPackage.finalAsset.source.kind, "internal");

  // No secrets / signed URLs anywhere in the persisted export_package.
  const exportSerialized = JSON.stringify(exportResult.exportPackage);
  assert.equal(exportSerialized.includes("https://"), false, "no external/signed URL leaked");
  assert.equal(/sk-[a-zA-Z0-9]/.test(exportSerialized), false, "no API key leaked");

  const { data: exportRow } = await client
    .from("project_artifacts")
    .select("value")
    .eq("project_id", projectId)
    .eq("artifact_type", "export_package")
    .maybeSingle();
  const exportRowSerialized = JSON.stringify(exportRow?.value ?? {});
  assert.equal(exportRowSerialized.includes("https://"), false);

  const { data: exportRun } = await client
    .from("director_runs")
    .select("cost_status, provider_id, status")
    .eq("project_id", projectId)
    .eq("director_type", "export")
    .maybeSingle();
  assert.equal(exportRun?.cost_status, "none");
  assert.equal(exportRun?.status, "completed");

  const finalPr = await stack.artifacts.getActive(projectId, "production_result");
  const finalPrArtifact = await stack.artifacts.load(finalPr!.artifactId);
  assert.equal(
    (finalPrArtifact!.value as { delivery?: { status?: string } }).delivery?.status,
    "export_ready",
  );

  // --- 6. Real media download (bytes ≠ JSON manifest) ---
  const expectedBytes = buildSyntheticFakeMp4Bytes("director-local");
  const media = await stack.downloadFinalAsset.execute({ projectId });
  assert.equal(media.status, "ok", JSON.stringify(media));
  if (media.status !== "ok") return;
  assert.deepEqual(Buffer.from(media.bytes), Buffer.from(expectedBytes));
  assert.ok(Buffer.from(media.bytes).includes(Buffer.from(SYNTHETIC_FAKE_MP4_MARKER)));
  assert.equal(media.headers["Content-Type"], "video/mp4");
  assert.match(media.headers["Content-Disposition"], /^attachment; filename="/);
  assert.equal(media.headers["Content-Length"], String(expectedBytes.byteLength));
  assert.equal(media.headers["Cache-Control"], "private, no-store");
  assert.equal(media.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(JSON.stringify(media.headers).includes("https://"), false);

  // --- Audit trail sanity (merge emits prepare + execute completions) ---
  for (const [action, minCount] of [
    ["director.quality.completed", 1],
    ["director.quality.review_recorded", 1],
    ["director.merge.completed", 2],
    ["director.export.completed", 1],
  ] as const) {
    const { count } = await client
      .from("audit_log")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("action", action);
    assert.ok(
      (count ?? 0) >= minCount,
      `expected >= ${minCount} audit_log row(s) for ${action}, got ${count}`,
    );
  }
});
