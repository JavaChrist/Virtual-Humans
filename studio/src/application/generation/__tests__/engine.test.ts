import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createElevenLabsVoiceAdapter,
  createFalAdapter,
  createOpenAIImageAdapter,
  type ElevenLabsVoiceClientPort,
  type FalClientPort,
  type OpenAIImageClientPort,
} from "@/infrastructure/providers";
import {
  createGenerationEngine,
  createProviderAdapterRegistry,
  runGenerationEngineDryRun,
} from "../index";
import {
  AT,
  makeCommand,
  makeMinimalPackage,
  makeResolved,
  makeStep,
} from "@/domain/generation/__tests__/fixtures";

function fakeFal(over: Partial<FalClientPort> = {}): FalClientPort {
  return {
    async submitJob() {
      return "job-123";
    },
    async checkJob() {
      return {
        status: "COMPLETED",
        videoUrl: "https://cdn.example.com/out.mp4",
      };
    },
    async generateIdentityImage() {
      return "https://cdn.example.com/id.png";
    },
    ...over,
  };
}

function fakeOpenAI(): OpenAIImageClientPort {
  return {
    async generateImage() {
      return {
        dataUrl: "data:image/png;base64,AAAA",
        size: "1024x1024",
        quality: "medium",
      };
    },
  };
}

function fakeEleven(): ElevenLabsVoiceClientPort {
  return {
    async generateVoice() {
      return { dataUrl: "data:audio/mpeg;base64,AAAA", mime: "audio/mpeg" };
    },
  };
}

function registry() {
  return createProviderAdapterRegistry([
    createFalAdapter(fakeFal()),
    createOpenAIImageAdapter(fakeOpenAI()),
    createElevenLabsVoiceAdapter(fakeEleven()),
  ]);
}

test("adapter registry — résolution / inconnu / doublon", () => {
  const reg = registry();
  assert.equal(reg.resolve("fal", "fal-ai/kling-video/v2/master/text-to-video", "video").providerId, "fal");
  assert.throws(() => reg.resolve("missing", "m", "video"));
  assert.throws(() => reg.resolve("openai", "gpt-image-1", "voice"));
  assert.throws(() =>
    createProviderAdapterRegistry([
      createFalAdapter(fakeFal()),
      createFalAdapter(fakeFal()),
    ]),
  );
});

test("execute async submit + poll — fallback ignoré", async () => {
  const engine = createGenerationEngine({ registry: registry() });
  const command = makeCommand();
  // Mutate guard
  const fbBefore = command.step.fallbacks.length;
  const result = await engine.execute(command, {
    correlationId: "c1",
    requestedAt: AT,
  });
  assert.equal(result.status, "submitted");
  if (result.status === "submitted") {
    assert.equal(result.providerJob.externalJobId, "job-123");
    const polled = await engine.poll(result.providerJob, { correlationId: "c1", requestedAt: AT }, {
      providerId: "fal",
      modelId: command.step.modelId,
      action: "video",
    });
    assert.equal(polled.status, "completed");
  }
  assert.equal(command.step.fallbacks.length, fbBefore);
  assert.equal(command.step.fallbacks[0]!.modelId, "other-should-be-ignored");
});

test("execute synchrone openai image", async () => {
  const engine = createGenerationEngine({ registry: registry() });
  const command = makeCommand({
    step: makeStep({
      id: "step:sc-1:product_demo:1:image.text_to_image",
      action: "image",
      capabilityProfile: "image.text_to_image",
      providerId: "openai",
      modelId: "gpt-image-1",
      promptVariantId: "var-img",
      expectedOutput: { mediaType: "image" },
      fallbacks: [],
    }),
  });
  const result = await engine.execute(command, {
    correlationId: "c1",
    requestedAt: AT,
  });
  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.output.kind, "image");
  }
});

test("execute voice avec asset — cancel unsupported", async () => {
  const engine = createGenerationEngine({ registry: registry() });
  const command = makeCommand({
    step: makeStep({
      id: "step:sc-1:voice_over:2:audio.voice",
      action: "voice",
      capabilityProfile: "audio.voice",
      providerId: "elevenlabs",
      modelId: "eleven_multilingual_v2",
      promptVariantId: "var-voice",
      expectedOutput: { mediaType: "audio" },
      fallbacks: [],
    }),
    scenePackage: makeMinimalPackage({
      dialogue: {
        kind: "voice_over",
        text: "Bonjour",
        language: "fr",
        emotion: "neutral",
        pronunciationNotes: [],
        fidelity: "verbatim",
      },
    }),
    resolvedInputs: [
      makeResolved({
        assetId: "voice-abc",
        role: "voice",
        asset: {
          assetId: "voice-abc",
          kind: "voice",
          access: {
            kind: "internal",
            storagePath: "voices/abc",
          },
        },
      }),
    ],
  });
  const result = await engine.execute(command, {
    correlationId: "c1",
    requestedAt: AT,
  });
  assert.equal(result.status, "completed");

  const cancel = await engine.cancel(
    { providerId: "elevenlabs", modelId: "eleven_multilingual_v2", externalJobId: "x" },
    { correlationId: "c1", requestedAt: AT },
    { providerId: "elevenlabs", modelId: "eleven_multilingual_v2" },
  );
  assert.equal(cancel.status, "failed");
  if (cancel.status === "failed") {
    assert.equal(cancel.error.code, "cancellation_unsupported");
  }
});

test("erreur adapter normalisée — timeout", async () => {
  const reg = createProviderAdapterRegistry([
    createFalAdapter(
      fakeFal({
        async submitJob() {
          throw new Error("connection timed out");
        },
      }),
    ),
  ]);
  const engine = createGenerationEngine({ registry: reg });
  const result = await engine.execute(makeCommand(), {
    correlationId: "c1",
    requestedAt: AT,
  });
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.error.code, "timeout");
    assert.equal(result.error.retryable, true);
    assert.equal(result.error.publicMessage.includes("http"), false);
  }
});

test("dry-run — providerCalled false", () => {
  const dry = runGenerationEngineDryRun({
    command: makeCommand(),
    registry: registry(),
  });
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.executable, true);
  assert.equal(dry.adapterResolved, true);
  assert.ok(dry.fingerprint);
});

test("dry-run adapter absent", () => {
  const dry = runGenerationEngineDryRun({
    command: makeCommand(),
    registry: createProviderAdapterRegistry([]),
  });
  assert.equal(dry.executable, false);
  assert.equal(dry.adapterResolved, false);
  assert.equal(dry.providerCalled, false);
});
