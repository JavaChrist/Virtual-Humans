/**
 * MT-013K-OUTPUT-TRANSPORT — fal result fetch + SSRF-safe media + gated Production.
 * Zero real network · never reads FAL_KEY · no MV-001 media.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MotionTransferDomainError } from "@/domain/motion";
import { createFakeFalMotionControlTransport } from "@/infrastructure/providers/motion-transfer/fal-motion-control-transport";
import {
  assertSafeFalMediaUrl,
  isBlockedHostnameOrIp,
  isFalMediaHostAllowed,
  safeFetchFalMedia,
  type SafeFetchLike,
} from "@/infrastructure/providers/motion-transfer/safe-fal-media-fetch";
import { assertValidatedFalTerminalVideo } from "@/infrastructure/providers/motion-transfer/fal-terminal-result";
import { createFalMotionOutputDownloadPort } from "../fal-motion-output-download-port";
import {
  evaluateMotionOutputTransportGates,
  resolveProductionMotionOutputDownloadPort,
} from "../gated-motion-output-download";
import {
  advanceMotionOutputDrain,
  createMotionDrainCounters,
  createProductionMotionOutputDrainDeps,
} from "../motion-output-drain";
import { createMemoryAssetContentPort } from "@/application/postproduction/asset-content-port";
import { createMemoryMotionPersistencePort } from "../motion-persistence-port";
import type { ClaimedProductionJob } from "@/application/production/enqueue";
import type { ProductionExecutionContext } from "@/application/production/production-director";
import type { MotionDrainStepResult } from "../motion-output-drain";
import type { MotionTransferAttemptRecord } from "../motion-transfer-worker-orchestrator";
import { buildSyntheticFakeMp4Bytes } from "@/application/postproduction/asset-content-port";

const PROJ = "390c25db-69e1-403a-83c5-7afcb4b85e84";
const WS = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const NOW = "2026-08-12T12:00:00.000Z";

const FLAGS_ON = {
  MOTION_TRANSFER_ENABLED: "1",
  MOTION_TRANSFER_PAID_ENABLED: "1",
  MOTION_TRANSFER_FAL_ENABLED: "1",
  MOTION_TRANSFER_WORKER_ENABLED: "1",
  MV001_PRIVACY_PACK_ACCEPTED: "1",
  MV001_PRIVACY_EXPIRES_AT: "2026-09-10T21:59:59.999Z",
  MV001_PROJECT_ID: PROJ,
  MV001_BENCHMARK_ID: "MV-001",
} as const;

function mp4Bytes(id = "out"): Uint8Array {
  return buildSyntheticFakeMp4Bytes(id);
}

function makeFetch(handlers: {
  url?: string;
  status?: number;
  headers?: Record<string, string>;
  body?: Uint8Array;
  redirectTo?: string;
  redirects?: Array<{ fromHost?: string; to: string }>;
  delayMs?: number;
  capture?: { urls: string[]; headers: Array<Record<string, string> | undefined> };
}): SafeFetchLike {
  let redirectIdx = 0;
  return async (input, init) => {
    handlers.capture?.urls.push(input);
    handlers.capture?.headers.push(init?.headers);
    if (handlers.delayMs) {
      await new Promise((r) => setTimeout(r, handlers.delayMs));
    }
    if (init?.signal?.aborted) {
      const err = new Error("Aborted");
      err.name = "AbortError";
      throw err;
    }

    if (handlers.redirects && redirectIdx < handlers.redirects.length) {
      const hop = handlers.redirects[redirectIdx++]!;
      return {
        ok: false,
        status: 302,
        headers: {
          get: (n: string) =>
            n.toLowerCase() === "location" ? hop.to : null,
        },
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    }
    if (handlers.redirectTo) {
      const to = handlers.redirectTo;
      handlers.redirectTo = undefined;
      return {
        ok: false,
        status: 302,
        headers: {
          get: (n: string) => (n.toLowerCase() === "location" ? to : null),
        },
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    }

    const body = handlers.body ?? mp4Bytes();
    const headers: Record<string, string> = {
      "content-type": "video/mp4",
      ...handlers.headers,
    };
    if (!("content-length" in headers) && !("Content-Length" in headers)) {
      headers["content-length"] = String(body.byteLength);
    }
    // Allow tests to omit Content-Length by setting empty string
    if (headers["content-length"] === "" || headers["Content-Length"] === "") {
      delete headers["content-length"];
      delete headers["Content-Length"];
    }
    const copy = new Uint8Array(body.byteLength);
    copy.set(body);
    return {
      ok: (handlers.status ?? 200) >= 200 && (handlers.status ?? 200) < 300,
      status: handlers.status ?? 200,
      headers: {
        get: (n: string): string | null =>
          headers[n.toLowerCase()] ?? headers[n] ?? null,
      },
      arrayBuffer: async (): Promise<ArrayBuffer> => copy.buffer,
    };
  };
}

function downloadContext(
  overrides: Partial<Parameters<
    ReturnType<typeof createFalMotionOutputDownloadPort>["download"]
  >[1]> = {},
) {
  return {
    correlationId: "corr-ot",
    workspaceId: WS,
    projectId: PROJ,
    runId: "run-ot",
    jobId: "job-ot",
    attemptId: "att-ot",
    nowIso: NOW,
    drainAuthorized: true,
    terminalProviderSuccess: true,
    privateStorageValidated: true,
    admissionOpen: false,
    submitAllowed: false,
    benchmarkId: "MV-001",
    expectedDurationSeconds: 8,
    ...overrides,
  };
}

test("safeFetch — host allowlist / hostile / loopback / private", () => {
  assert.equal(isFalMediaHostAllowed("v3b.fal.media"), true);
  assert.equal(isFalMediaHostAllowed("fal.ai"), true);
  assert.equal(isFalMediaHostAllowed("evil.com"), false);
  assert.equal(isBlockedHostnameOrIp("localhost"), true);
  assert.equal(isBlockedHostnameOrIp("127.0.0.1"), true);
  assert.equal(isBlockedHostnameOrIp("::1"), true);
  assert.equal(isBlockedHostnameOrIp("10.0.0.1"), true);
  assert.equal(isBlockedHostnameOrIp("169.254.1.1"), true);
  assert.equal(isBlockedHostnameOrIp("192.168.1.1"), true);

  assert.throws(
    () => assertSafeFalMediaUrl("http://v3b.fal.media/x.mp4"),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.publicMessage.includes("HTTPS"),
  );
  assert.throws(
    () => assertSafeFalMediaUrl("https://evil.com/x.mp4"),
    (e: unknown) => e instanceof MotionTransferDomainError,
  );
  assert.throws(
    () => assertSafeFalMediaUrl("https://127.0.0.1/x.mp4"),
    (e: unknown) => e instanceof MotionTransferDomainError,
  );
  assert.throws(
    () => assertSafeFalMediaUrl("https://localhost/x.mp4"),
    (e: unknown) => e instanceof MotionTransferDomainError,
  );
});

test("safeFetch — redirect forbidden host / too many redirects", async () => {
  await assert.rejects(
    () =>
      safeFetchFalMedia("https://v3b.fal.media/a.mp4", {
        skipDnsLookup: true,
        fetchImpl: makeFetch({
          redirectTo: "https://evil.com/steal.mp4",
        }),
      }),
    (e: unknown) => e instanceof MotionTransferDomainError,
  );

  await assert.rejects(
    () =>
      safeFetchFalMedia("https://v3b.fal.media/a.mp4", {
        skipDnsLookup: true,
        maxRedirects: 2,
        fetchImpl: makeFetch({
          redirects: [
            { to: "https://v3b.fal.media/b.mp4" },
            { to: "https://v3b.fal.media/c.mp4" },
            { to: "https://v3b.fal.media/d.mp4" },
          ],
        }),
      }),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.publicMessage.includes("Trop de redirects"),
  );
});

test("safeFetch — MIME / Content-Length / stream limit / empty / timeout / temp cleanup", async () => {
  await assert.rejects(
    () =>
      safeFetchFalMedia("https://v3b.fal.media/a.mp4", {
        skipDnsLookup: true,
        fetchImpl: makeFetch({
          headers: { "content-type": "image/png", "content-length": "10" },
          body: new Uint8Array([1, 2, 3]),
        }),
      }),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.publicMessage.includes("MIME"),
  );

  await assert.rejects(
    () =>
      safeFetchFalMedia("https://v3b.fal.media/a.mp4", {
        skipDnsLookup: true,
        maxBytes: 100,
        fetchImpl: makeFetch({
          headers: {
            "content-type": "video/mp4",
            "content-length": "999999",
          },
          body: mp4Bytes(),
        }),
      }),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.publicMessage.includes("Content-Length"),
  );

  await assert.rejects(
    () =>
      safeFetchFalMedia("https://v3b.fal.media/a.mp4", {
        skipDnsLookup: true,
        maxBytes: 8,
        fetchImpl: makeFetch({
          headers: { "content-type": "video/mp4", "content-length": "" },
          body: new Uint8Array(32),
        }),
      }),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.publicMessage.includes("dépasse"),
  );

  await assert.rejects(
    () =>
      safeFetchFalMedia("https://v3b.fal.media/a.mp4", {
        skipDnsLookup: true,
        fetchImpl: makeFetch({
          headers: { "content-type": "video/mp4", "content-length": "0" },
          body: new Uint8Array(0),
        }),
      }),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.publicMessage.toLowerCase().includes("vide"),
  );

  const ac = new AbortController();
  ac.abort();
  await assert.rejects(
    () =>
      safeFetchFalMedia("https://v3b.fal.media/a.mp4", {
        skipDnsLookup: true,
        signal: ac.signal,
        fetchImpl: makeFetch({ delayMs: 5 }),
      }),
    (e: unknown) =>
      e instanceof MotionTransferDomainError && e.code === "provider_timeout",
  );

  let cleaned = 0;
  const ok = await safeFetchFalMedia("https://v3b.fal.media/a.mp4", {
    skipDnsLookup: true,
    fetchImpl: makeFetch({ body: mp4Bytes("clean") }),
    onTempCleaned: () => {
      cleaned += 1;
    },
  });
  assert.equal(ok.tempCleaned, true);
  assert.equal(cleaned, 1);
  assert.equal(ok.mimeType, "video/mp4");
  assert.ok(ok.sizeBytes > 0);
});

test("terminal result — multi output / malformed / COMPLETED exact", () => {
  assert.throws(
    () =>
      assertValidatedFalTerminalVideo({
        status: "COMPLETED",
        requestId: "r1",
        result: {
          videoUrl: "https://v3b.fal.media/a.mp4",
          contentType: "video/mp4",
          videos: [{}, {}],
          outputCount: 2,
        },
      }),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.publicMessage.includes("plusieurs"),
  );

  assert.throws(
    () =>
      assertValidatedFalTerminalVideo({
        status: "IN_PROGRESS",
        requestId: "r1",
      }),
    (e: unknown) => e instanceof MotionTransferDomainError,
  );

  assert.throws(
    () =>
      assertValidatedFalTerminalVideo({
        status: "COMPLETED",
        requestId: "r1",
        result: {},
      }),
    (e: unknown) => e instanceof MotionTransferDomainError,
  );

  const ok = assertValidatedFalTerminalVideo({
    status: "COMPLETED",
    requestId: "r1",
    result: {
      videoUrl: "https://v3b.fal.media/a.mp4",
      contentType: "video/mp4",
      durationSeconds: 8,
      width: 1080,
      height: 1920,
      fps: 24,
      fileSize: 1000,
    },
  });
  assert.equal(ok.mimeType, "video/mp4");
  assert.equal(ok.originLabel, "v3b.fal.media");
});

test("download port — terminal → memory URL → download → checksum; fresh process getResult", async () => {
  const transport = createFakeFalMotionControlTransport({
    completedVideoUrl: "https://v3b.fal.media/files/fake/job-1.mp4",
  });
  const sub = await transport.submit({
    endpointId: "fal-ai/kling-video/v3/pro/motion-control",
    input: { x: 1 },
  });
  assert.equal(transport.submitCount, 1);
  // Advance to COMPLETED via polls
  await transport.getStatus({
    endpointId: "fal-ai/kling-video/v3/pro/motion-control",
    requestId: sub.requestId,
  });
  await transport.getStatus({
    endpointId: "fal-ai/kling-video/v3/pro/motion-control",
    requestId: sub.requestId,
  });
  await transport.getStatus({
    endpointId: "fal-ai/kling-video/v3/pro/motion-control",
    requestId: sub.requestId,
  });
  assert.equal(transport.pollCount, 3);

  const capture = { urls: [] as string[], headers: [] as Array<Record<string, string> | undefined> };
  const port = createFalMotionOutputDownloadPort({
    transport,
    skipDnsLookup: true,
    fetchImpl: makeFetch({ body: mp4Bytes(sub.requestId), capture }),
  });

  const result = await port.download(
    {
      providerJobId: sub.requestId,
      providerOutputRef: `fal-out:${sub.requestId}`,
      expectedMimeType: "video/mp4",
    },
    downloadContext(),
  );
  assert.equal(transport.submitCount, 1);
  assert.ok(transport.resultFetchCount >= 1);
  assert.equal(port.mediaDownloadCount, 1);
  assert.ok(result.checksumSha256.length === 64);
  assert.ok(result.sizeBytes > 0);
  // URL may appear in fake fetch capture (in-memory) but must not be in durable surfaces —
  // assert we only hit allowlisted host and never log credentials.
  assert.ok(capture.urls[0]?.startsWith("https://v3b.fal.media/"));
  assert.ok(!capture.urls[0]?.includes("@"));

  // Fresh process: new transport with seed only — getResult, no submit
  const fresh = createFakeFalMotionControlTransport({
    completedVideoUrl: "https://v3b.fal.media/files/fake/job-1.mp4",
  });
  fresh.seedTerminalCompleted(sub.requestId);
  assert.equal(fresh.submitCount, 0);
  const port2 = createFalMotionOutputDownloadPort({
    transport: fresh,
    skipDnsLookup: true,
    fetchImpl: makeFetch({ body: mp4Bytes(sub.requestId) }),
  });
  const again = await port2.download(
    {
      providerJobId: sub.requestId,
      providerOutputRef: `fal-out:${sub.requestId}`,
      expectedMimeType: "video/mp4",
    },
    downloadContext(),
  );
  assert.equal(fresh.submitCount, 0);
  assert.equal(fresh.resultFetchCount, 1);
  assert.equal(again.checksumSha256, result.checksumSha256);
});

test("getResult never resubmits; URL absent from errors/diagnostics", async () => {
  const secretUrl =
    "https://user:pass@v3b.fal.media/files/secret-token-xyz.mp4";
  const transport = createFakeFalMotionControlTransport({
    completedVideoUrl: secretUrl,
  });
  // credentials in URL rejected by assertSafeFalMediaUrl
  transport.seedTerminalCompleted("job-sec");
  const port = createFalMotionOutputDownloadPort({
    transport,
    skipDnsLookup: true,
    fetchImpl: makeFetch({}),
  });
  await assert.rejects(
    () =>
      port.download(
        {
          providerJobId: "job-sec",
          providerOutputRef: "fal-out:job-sec",
          expectedMimeType: "video/mp4",
        },
        downloadContext(),
      ),
    (e: unknown) => {
      assert.ok(e instanceof MotionTransferDomainError);
      const blob = `${e.publicMessage} ${e.message}`;
      assert.equal(blob.includes("secret-token"), false);
      assert.equal(blob.includes("user:pass"), false);
      assert.equal(/https?:\/\/\S+/i.test(blob), false);
      return true;
    },
  );
  assert.equal(transport.submitCount, 0);
});

test("Production gates — disabled by default; fake Production blocked", () => {
  const gatesOff = evaluateMotionOutputTransportGates({
    env: { MV001_PROJECT_ID: PROJ },
    context: downloadContext(),
    request: {
      providerJobId: "j1",
      providerOutputRef: "fal-out:j1",
      expectedMimeType: "video/mp4",
    },
    nowIso: NOW,
    transportReady: false,
  });
  assert.equal(gatesOff.ok, false);
  assert.ok(gatesOff.missing.includes("fal_result_transport_flags"));
  assert.ok(gatesOff.missing.includes("privacy_pack_5_of_5"));

  assert.throws(
    () =>
      resolveProductionMotionOutputDownloadPort(
        { VERCEL: "1", NODE_ENV: "production", ...FLAGS_ON },
        {
          testTransport: createFakeFalMotionControlTransport({}),
        },
      ),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      (e.message.includes("fake_forbidden") ||
        e.publicMessage.toLowerCase().includes("fake")),
  );
});

test("gated resolver — flags OFF never arms download; flags ON + fake fetch OK", async () => {
  const blocked = resolveProductionMotionOutputDownloadPort(
    { NODE_ENV: "test", MV001_PROJECT_ID: PROJ },
    {
      testTransport: createFakeFalMotionControlTransport({}),
      testFetch: makeFetch({}),
      skipDnsLookup: true,
      nowIso: () => NOW,
    },
  );
  await assert.rejects(
    () =>
      blocked.download(
        {
          providerJobId: "j1",
          providerOutputRef: "fal-out:j1",
          expectedMimeType: "video/mp4",
        },
        downloadContext(),
      ),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.code === "provider_not_configured",
  );

  const transport = createFakeFalMotionControlTransport({
    completedVideoUrl: "https://v3b.fal.media/files/ok.mp4",
  });
  transport.seedTerminalCompleted("j-live");
  const armed = resolveProductionMotionOutputDownloadPort(
    { NODE_ENV: "test", ...FLAGS_ON },
    {
      testTransport: transport,
      testFetch: makeFetch({ body: mp4Bytes("j-live") }),
      skipDnsLookup: true,
      nowIso: () => NOW,
    },
  );
  const out = await armed.download(
    {
      providerJobId: "j-live",
      providerOutputRef: "fal-out:j-live",
      expectedMimeType: "video/mp4",
    },
    downloadContext(),
  );
  assert.ok(out.checksumSha256);
  assert.equal(transport.submitCount, 0);
  assert.equal(transport.resultFetchCount, 1);
});

test("drain integration — fal download → private ingest idempotent; crash recovery", async () => {
  const transport = createFakeFalMotionControlTransport({
    completedVideoUrl: "https://v3b.fal.media/files/drain.mp4",
  });
  transport.seedTerminalCompleted("prov-drain-1");
  const download = createFalMotionOutputDownloadPort({
    transport,
    skipDnsLookup: true,
    fetchImpl: makeFetch({ body: mp4Bytes("prov-drain-1") }),
  });
  const content = createMemoryAssetContentPort();
  const persistence = createMemoryMotionPersistencePort();
  const counters = createMotionDrainCounters();
  const deps = createProductionMotionOutputDrainDeps({
    download,
    content,
    persistence,
    simulateCrashAfterDownloadBeforeIngest: true,
  });

  const job = {
    jobId: "job-d1",
    runId: "run-d1",
    attemptId: "att-d1",
    projectId: PROJ,
    workspaceId: WS,
    type: "motion_transfer",
    payload: {
      mode: "drain",
      externalJobId: "prov-drain-1",
      motion: {
        phase: "provider_completed",
        providerOutputRef: "fal-out:prov-drain-1",
        outputMimeType: "video/mp4",
        outputDurationSeconds: 8,
        outputWidth: 1080,
        outputHeight: 1920,
        outputFps: 24,
        outputCompletedAt: NOW,
        downloadStatus: "intent",
      },
    },
  } as unknown as ClaimedProductionJob;

  const record = {
    attemptId: "att-d1",
    runId: "run-d1",
    jobId: "job-d1",
    projectId: PROJ,
    phase: "provider_completed",
    providerJobId: "prov-drain-1",
    submitCount: 1,
    resubmitCount: 0,
    terminal: false,
    downloadStatus: "intent",
    ingestStatus: "none",
    qcStatus: "none",
    humanReviewHandoffStatus: "none",
    outputLifecycle: "provider_completed",
    outputDescriptor: {
      providerOutputRef: "fal-out:prov-drain-1",
      mimeType: "video/mp4",
      durationSeconds: 8,
      width: 1080,
      height: 1920,
      fps: 24,
      completedAt: NOW,
    },
    motionInput: {
      motion: { fidelity: "critical" },
    },
  } as unknown as MotionTransferAttemptRecord;

  const ctx: ProductionExecutionContext = {
    correlationId: "c",
    actorId: "ot-test",
    nowIso: () => NOW,
    nextId: () => "id-ot",
    signal: undefined,
  };

  const step1 = await advanceMotionOutputDrain({
    job,
    record,
    context: ctx,
    deps,
    counters,
  });
  assert.equal(step1.status, "reschedule");
  assert.equal(record.downloadStatus, "completed");
  assert.ok(record.downloadChecksum);
  assert.equal(transport.submitCount, 0);
  assert.equal(download.mediaDownloadCount, 1);

  // Resume without crash flag — may re-call download port (idempotent bytes)
  const deps2 = createProductionMotionOutputDrainDeps({
    download,
    content,
    persistence,
  });
  // Need another drain steps: intent already completed download — ingest path
  let guard = 0;
  let last: MotionDrainStepResult = step1;
  while (
    last.status === "reschedule" &&
    record.humanReviewHandoffStatus !== "seeded" &&
    guard < 12
  ) {
    guard += 1;
    last = await advanceMotionOutputDrain({
      job,
      record,
      context: ctx,
      deps: deps2,
      counters,
    });
  }
  assert.ok(
    record.ingestStatus === "completed" || last.status === "needs_review",
  );
  assert.ok(counters.storageObjectCount <= 1);
  assert.equal(transport.submitCount, 0);

  const dumped = JSON.stringify({
    record,
    job,
    events: [last],
  });
  assert.equal(/v3b\.fal\.media/i.test(dumped), false);
  assert.equal(/https?:\/\/\S+/i.test(dumped), false);
});

test("headers/secrets redacted — no secret headers forwarded to media host", async () => {
  const capture = {
    urls: [] as string[],
    headers: [] as Array<Record<string, string> | undefined>,
  };
  const transport = createFakeFalMotionControlTransport({
    completedVideoUrl: "https://v3b.fal.media/files/h.mp4",
  });
  transport.seedTerminalCompleted("job-h");
  const port = createFalMotionOutputDownloadPort({
    transport,
    skipDnsLookup: true,
    fetchImpl: makeFetch({ capture, body: mp4Bytes("h") }),
  });
  await port.download(
    {
      providerJobId: "job-h",
      providerOutputRef: "fal-out:job-h",
      expectedMimeType: "video/mp4",
    },
    downloadContext(),
  );
  const hdr = capture.headers[0] ?? {};
  assert.equal(hdr.Authorization, undefined);
  assert.equal(hdr["X-Api-Key"], undefined);
  assert.equal(hdr["fal-key"], undefined);
});

test("source files never embed FAL_KEY reads at module scope for output transport", () => {
  const gated = readFileSync(
    new URL("../gated-motion-output-download.ts", import.meta.url),
    "utf8",
  );
  // Lazy only inside resolveInner after gates — no top-level process.env.FAL_KEY
  assert.equal(/^[^]*process\.env\.FAL_KEY/m.test(gated.split("createGated")[0]!), false);
  const sdk = readFileSync(
    new URL(
      "../../../infrastructure/providers/motion-transfer/fal-sdk-motion-control-transport.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(sdk.includes("env.FAL_KEY"));
  assert.ok(sdk.includes("createFalSdkMotionControlTransport"));
});
