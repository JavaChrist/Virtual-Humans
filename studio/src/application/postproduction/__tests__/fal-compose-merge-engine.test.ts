/**
 * MergeEngine fal compose — fake client, no network (VHS-111B).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AT,
  EXPIRES,
  makePackages,
  makeProductionResultV1,
  makeStoryboard,
} from "@/domain/postproduction/__tests__/fixtures";
import { buildMergePlan } from "@/domain/postproduction";
import type {
  FalComposeClientPort,
  FalComposePayload,
} from "@/infrastructure/postproduction/fal-compose";
import {
  createFalComposeMergeEngine,
  FAL_COMPOSE_MERGE_CAPABILITIES,
  mapMergePlanToFalComposeInput,
  runPostProductionDryRun,
} from "../index";

const CTX = {
  correlationId: "corr-merge",
  requestedAt: AT,
};

function makePlan(over: Parameters<typeof buildMergePlan>[0] = {
  id: "mp-1",
  productionResult: makeProductionResultV1(),
  storyboard: makeStoryboard(),
  scenePackages: makePackages(),
  aspectRatio: "9:16",
  createdAt: AT,
  nowIso: AT,
}) {
  const built = buildMergePlan(over);
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error("plan");
  return built.plan;
}

function fakeClient(handlers: {
  submit?: FalComposeClientPort["submit"];
  poll?: NonNullable<FalComposeClientPort["poll"]>;
}): FalComposeClientPort {
  return {
    submit:
      handlers.submit ??
      (async () => ({ requestId: "req-1", modelId: "fal-ai/ffmpeg-api/compose" })),
    poll: handlers.poll,
  };
}

test("mapMergePlan — plan valide / ordre / durées / cut", () => {
  const plan = makePlan();
  const input = mapMergePlanToFalComposeInput(plan, AT);
  assert.equal(input.clips.length, 4);
  assert.deepEqual(
    input.clips.map((c) => c.durationSeconds),
    plan.timeline
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((t) => t.durationSeconds)
  );
  assert.equal(input.preserveEmbeddedAudio, plan.audio.preserveEmbeddedAudio);
  assert.ok(input.clips.every((c) => c.sourceUrl.startsWith("https://")));
});

test("mapMergePlan — transition unsupported / overlay / audio / expired / URL", () => {
  const plan = makePlan();
  const withFade = {
    ...plan,
    transitions: [
      {
        fromSceneId: plan.timeline[0]!.sceneId,
        toSceneId: plan.timeline[1]!.sceneId,
        kind: "fade" as const,
        durationSeconds: 0.3,
      },
    ],
  };
  assert.throws(
    () => mapMergePlanToFalComposeInput(withFade, AT),
    (e: Error & { code?: string }) => e.code === "unsupported_transition"
  );

  const withOverlay = {
    ...plan,
    overlays: [
      {
        kind: "text" as const,
        sceneId: plan.timeline[0]!.sceneId,
        text: "CTA",
        startSeconds: 0,
        durationSeconds: 1,
        safeAreaRequired: true,
        style: "default_safe" as const,
        source: "scene_package_screen_text" as const,
      },
    ],
  };
  assert.throws(
    () => mapMergePlanToFalComposeInput(withOverlay, AT),
    (e: Error & { code?: string }) => e.code === "unsupported_overlay"
  );

  const withMix = {
    ...plan,
    audio: {
      ...plan.audio,
      tracks: [
        ...plan.audio.tracks,
        {
          id: "vo-1",
          role: "voice_over" as const,
          assetId: "vo",
          startSeconds: 0,
          durationSeconds: 5,
        },
      ],
    },
  };
  assert.throws(
    () => mapMergePlanToFalComposeInput(withMix, AT),
    (e: Error & { code?: string }) => e.code === "unsupported_audio_mix"
  );

  const forced = {
    ...plan,
    timeline: plan.timeline.map((t, i) =>
      i === 0
        ? {
            ...t,
            source: {
              kind: "temporary_external" as const,
              url: "https://secret.example/leak.mp4",
              expiresAt: "2020-01-01T00:00:00.000Z",
            },
          }
        : t
    ),
  };
  try {
    mapMergePlanToFalComposeInput(forced, AT);
    assert.fail("expected throw");
  } catch (e) {
    assert.ok(e instanceof Error);
    const err = e as unknown as { code: string; publicMessage?: string };
    assert.equal(err.code, "expired_asset");
    assert.ok(!e.message.includes("secret.example"));
    assert.ok(!String(err.publicMessage).includes("secret"));
  }

  const badUrl = {
    ...plan,
    timeline: plan.timeline.map((t, i) =>
      i === 0
        ? {
            ...t,
            source: {
              kind: "temporary_external" as const,
              url: "ftp://bad",
              expiresAt: EXPIRES,
            },
          }
        : t
    ),
  };
  assert.throws(
    () => mapMergePlanToFalComposeInput(badUrl, AT),
    (e: Error & { code?: string }) => e.code === "invalid_plan"
  );
});

test("adapter — submit une fois + contexte + submitted", async () => {
  let submits = 0;
  let seenPayload: FalComposePayload | undefined;
  let seenCtx: { correlationId: string } | undefined;
  const engine = createFalComposeMergeEngine({
    client: fakeClient({
      submit: async (_m, payload, ctx) => {
        submits++;
        seenPayload = payload;
        seenCtx = ctx;
        return { requestId: "rid-42", modelId: "fal-ai/ffmpeg-api/compose" };
      },
      poll: async () => ({ status: "IN_PROGRESS", requestId: "rid-42" }),
    }),
  });
  const plan = makePlan();
  const result = await engine.execute(plan, CTX);
  assert.equal(submits, 1);
  assert.equal(seenCtx?.correlationId, "corr-merge");
  assert.equal(result.status, "submitted");
  if (result.status === "submitted") {
    assert.equal(result.job.externalJobId, "rid-42");
    assert.equal(result.job.providerId, "fal");
  }
  assert.ok(seenPayload?.tracks.some((t) => t.type === "video"));
  assert.equal(seenPayload?.tracks.length, plan.audio.preserveEmbeddedAudio ? 2 : 1);
});

test("adapter — poll processing / completed / failed / output invalide", async () => {
  const engine = createFalComposeMergeEngine({
    client: fakeClient({
      poll: async (_m, id) => {
        if (id === "proc") return { status: "IN_PROGRESS", requestId: id };
        if (id === "fail") return { status: "FAILED", requestId: id };
        if (id === "bad") return { status: "COMPLETED", requestId: id, videoUrl: "not-a-url" };
        return {
          status: "COMPLETED",
          requestId: id,
          videoUrl: "https://cdn.example.com/out.mp4",
        };
      },
    }),
    nextAssetId: () => "asset-final",
  });
  assert.ok(engine.poll);

  const jobBase = {
    providerId: "fal" as const,
    modelId: "fal-ai/ffmpeg-api/compose",
    externalJobId: "proc",
  };
  const processing = await engine.poll!(jobBase, CTX);
  assert.equal(processing.status, "processing");

  const failed = await engine.poll!({ ...jobBase, externalJobId: "fail" }, CTX);
  assert.equal(failed.status, "failed");

  const bad = await engine.poll!({ ...jobBase, externalJobId: "bad" }, CTX);
  assert.equal(bad.status, "failed");
  if (bad.status === "failed") assert.equal(bad.error.code, "output_invalid");

  const done = await engine.poll!({ ...jobBase, externalJobId: "ok" }, CTX);
  assert.equal(done.status, "completed");
  if (done.status === "completed") {
    assert.equal(done.asset.id, "asset-final");
    assert.equal(done.asset.kind, "video");
    assert.equal(done.asset.source.kind, "temporary_external");
  }
});

test("adapter — erreurs 429 / timeout / request ID invalide / poll absent", async () => {
  const limited = createFalComposeMergeEngine({
    client: fakeClient({
      submit: async () => {
        throw new Error("429 rate limit");
      },
    }),
  });
  const r1 = await limited.execute(makePlan(), CTX);
  assert.equal(r1.status, "failed");
  if (r1.status === "failed") {
    assert.equal(r1.error.code, "rate_limited");
    assert.equal(r1.error.retryable, true);
  }

  const timed = createFalComposeMergeEngine({
    client: fakeClient({
      submit: async () => {
        throw new Error("timed out waiting");
      },
      poll: async () => ({ status: "IN_PROGRESS", requestId: "x" }),
    }),
  });
  const r2 = await timed.execute(makePlan(), CTX);
  assert.equal(r2.status, "failed");
  if (r2.status === "failed") assert.equal(r2.error.code, "timeout");

  const withPoll = createFalComposeMergeEngine({
    client: fakeClient({
      poll: async () => ({ status: "IN_PROGRESS", requestId: "x" }),
    }),
  });
  const badJob = await withPoll.poll!(
    { providerId: "fal", modelId: "other-model", externalJobId: "x" },
    CTX
  );
  assert.equal(badJob.status, "failed");
  const emptyId = await withPoll.poll!(
    { providerId: "fal", modelId: "fal-ai/ffmpeg-api/compose", externalJobId: "  " },
    CTX
  );
  assert.equal(emptyId.status, "failed");

  const noPoll = createFalComposeMergeEngine({
    client: fakeClient({}),
  });
  assert.equal(noPoll.poll, undefined);
});

test("adapter — capacités réelles / refus explicites", () => {
  const caps = FAL_COMPOSE_MERGE_CAPABILITIES;
  assert.equal(caps.executionEnabled, true);
  assert.equal(caps.sequentialConcatenation, true);
  assert.deepEqual([...caps.supportedTransitions], ["cut", "none"]);
  assert.equal(caps.overlays, false);
  assert.equal(caps.multiTrackMix, false);
  assert.equal(caps.loudnessLufs, false);
  assert.equal(caps.cancellationSupported, false);
  assert.equal(caps.singleAudioMux, false);
  assert.equal(caps.asyncSubmitPoll, true);
});

test("dry-run — adapter configuré / providerCalled false / aucun submit", async () => {
  let submits = 0;
  const engine = createFalComposeMergeEngine({
    client: fakeClient({
      submit: async () => {
        submits++;
        return { requestId: "x", modelId: "fal-ai/ffmpeg-api/compose" };
      },
      poll: async () => ({ status: "IN_PROGRESS", requestId: "x" }),
    }),
  });
  const dry = runPostProductionDryRun({
    productionResult: makeProductionResultV1(),
    storyboard: makeStoryboard(),
    scenePackages: makePackages(),
    aspectRatio: "9:16",
    mergeEngine: engine,
    at: AT,
  });
  assert.equal(dry.providerCalled, false);
  assert.equal(submits, 0);
  assert.ok(dry.validations.some((v) => v.code === "merge_adapter_configured" && v.passed));
  assert.ok(dry.validations.some((v) => v.code === "polling_available" && v.passed));
  assert.ok(dry.validations.some((v) => v.code === "plan_fal_mappable" && v.passed));
});
