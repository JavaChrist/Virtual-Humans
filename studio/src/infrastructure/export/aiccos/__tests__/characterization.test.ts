/**
 * Characterization — historical /api/aiccos/send pipeline behavior (VHS-111C).
 * Expectations lock pre-extraction behavior; fakes only — no network.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AICCOS_MAX_BYTES,
  createAiccosExportPipeline,
  createFetchAiccosImportClient,
  createFetchAiccosStorageUploader,
  createFetchSourceDownloader,
  fileNameFromUrl,
  mapPipelineResultToHistoricalHttp,
  parseHistoricalAiccosBody,
  resolveHistoricalMime,
  type FetchLike,
} from "../index";

const TOKEN = "test-token-not-real";
const BASE = "https://aiccos.test";
const NOW = 1_700_000_000_000;
const AT = "2026-08-02T12:00:00.000Z";
const CTX = {
  correlationId: "corr-aiccos",
  timeoutMs: 30_000,
  requestedAt: AT,
};

type Call = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array | ArrayBuffer;
};

function makeHarness(opts: {
  videoBytes?: Uint8Array;
  videoStatus?: number;
  contentType?: string | null;
  contentLength?: string | null;
  importStatus?: number;
  importBody?: Record<string, unknown>;
  uploadStatus?: number;
  uploadBodyText?: string;
  completeStatus?: number;
  completeBody?: Record<string, unknown>;
}) {
  const calls: Call[] = [];
  const bytes = opts.videoBytes ?? new Uint8Array([1, 2, 3, 4]);
  const fetchImpl: FetchLike = async (url, init) => {
    const method = init?.method ?? "GET";
    calls.push({
      url,
      method,
      headers: init?.headers,
      body: init?.body as string | Uint8Array | ArrayBuffer | undefined,
    });

    if (url.startsWith("https://cdn.example/") || url.startsWith("http://cdn.example/")) {
      const status = opts.videoStatus ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
          get(name: string) {
            if (name.toLowerCase() === "content-type") {
              return opts.contentType === undefined ? "video/mp4" : opts.contentType;
            }
            if (name.toLowerCase() === "content-length") {
              return opts.contentLength ?? String(bytes.byteLength);
            }
            return null;
          },
        },
        arrayBuffer: async () => {
          const copy = new Uint8Array(bytes.byteLength);
          copy.set(bytes);
          return copy.buffer;
        },
        text: async () => "",
        json: async () => ({}),
      };
    }

    if (url.endsWith("/api/clips/import") && !url.includes("complete")) {
      const status = opts.importStatus ?? 200;
      const body = opts.importBody ?? {
        path: "imports/clip.mp4",
        signedUrl: "https://storage.example/upload-signed",
      };
      return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => null },
        arrayBuffer: async () => new ArrayBuffer(0),
        text: async () => JSON.stringify(body),
        json: async () => body,
      };
    }

    if (url === "https://storage.example/upload-signed") {
      const status = opts.uploadStatus ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => null },
        arrayBuffer: async () => new ArrayBuffer(0),
        text: async () => opts.uploadBodyText ?? "",
        json: async () => ({}),
      };
    }

    if (url.endsWith("/api/clips/import/complete")) {
      const status = opts.completeStatus ?? 200;
      const body =
        opts.completeBody ?? {
          clip: {
            id: "clip-1",
            publicUrl: "https://aiccos.test/public/clip-1.mp4",
            title: "Mon clip",
          },
        };
      return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => null },
        arrayBuffer: async () => new ArrayBuffer(0),
        text: async () => JSON.stringify(body),
        json: async () => body,
      };
    }

    throw new Error(`Unexpected URL in fake fetch: ${url}`);
  };

  const pipeline = createAiccosExportPipeline({
    downloader: createFetchSourceDownloader({ fetchImpl }),
    importClient: createFetchAiccosImportClient({
      baseUrl: BASE,
      importToken: TOKEN,
      fetchImpl,
    }),
    uploader: createFetchAiccosStorageUploader({ fetchImpl }),
    nowMs: () => NOW,
  });

  return { pipeline, calls, fetchImpl };
}

test("caractérisation — entrée minimale + happy path + ordre 4 ops", async () => {
  const { pipeline, calls } = makeHarness({});
  const result = await pipeline.send(
    { videoUrl: "https://cdn.example/a.mp4", title: "Mon clip" },
    CTX
  );
  assert.equal(result.status, "delivered");
  if (result.status !== "delivered") return;
  assert.equal(result.externalId, "clip-1");
  assert.equal(result.publicUrl, "https://aiccos.test/public/clip-1.mp4");

  assert.equal(calls.length, 4);
  assert.equal(calls[0]!.method, "GET");
  assert.ok(calls[0]!.url.startsWith("https://cdn.example/"));
  assert.equal(calls[1]!.method, "POST");
  assert.equal(calls[1]!.url, `${BASE}/api/clips/import`);
  assert.equal(calls[2]!.method, "PUT");
  assert.equal(calls[2]!.url, "https://storage.example/upload-signed");
  assert.equal(calls[3]!.method, "POST");
  assert.equal(calls[3]!.url, `${BASE}/api/clips/import/complete`);

  const importBody = JSON.parse(String(calls[1]!.body));
  assert.deepEqual(importBody, {
    fileName: "a.mp4",
    mimeType: "video/mp4",
    sizeBytes: 4,
    productSlug: null,
  });
  assert.equal(calls[1]!.headers?.Authorization, `Bearer ${TOKEN}`);

  assert.deepEqual(calls[2]!.headers, {
    "Content-Type": "video/mp4",
    "x-upsert": "true",
  });

  const completeBody = JSON.parse(String(calls[3]!.body));
  assert.deepEqual(completeBody, {
    filePath: "imports/clip.mp4",
    mimeType: "video/mp4",
    sizeBytes: 4,
    title: "Mon clip",
    productSlug: null,
  });

  const http = mapPipelineResultToHistoricalHttp(result);
  assert.equal(http.status, 200);
  assert.deepEqual(http.body, {
    clip: {
      id: "clip-1",
      publicUrl: "https://aiccos.test/public/clip-1.mp4",
      title: "Mon clip",
    },
  });

  // Token must not appear outside Authorization header snapshots we assert explicitly
  const safeSnap = JSON.stringify({ result, http, importBody, completeBody });
  assert.ok(!safeSnap.includes(TOKEN));
});

test("caractérisation — productSlug présent / absent", async () => {
  const withSlug = makeHarness({});
  await withSlug.pipeline.send(
    {
      videoUrl: "https://cdn.example/a.mp4",
      title: "T",
      productSlug: "prod-1",
    },
    CTX
  );
  assert.equal(JSON.parse(String(withSlug.calls[1]!.body)).productSlug, "prod-1");
  assert.equal(JSON.parse(String(withSlug.calls[3]!.body)).productSlug, "prod-1");

  const parsed = parseHistoricalAiccosBody({
    videoUrl: "https://cdn.example/a.mp4",
    title: "T",
    productSlug: "  ",
  });
  assert.equal(parsed.productSlug, null);
});

test("caractérisation — MIME header + fallback historique", () => {
  assert.equal(resolveHistoricalMime("video/webm; charset=binary"), "video/webm");
  assert.equal(resolveHistoricalMime(null), "video/mp4");
  assert.equal(resolveHistoricalMime(undefined), "video/mp4");
  assert.equal(resolveHistoricalMime(""), "video/mp4");
});

test("caractérisation — taille limite / dépassement / vide", async () => {
  const { assertSizeWithinLimit } = await import("../validation");
  assert.doesNotThrow(() => assertSizeWithinLimit(AICCOS_MAX_BYTES));
  assert.throws(
    () => assertSizeWithinLimit(AICCOS_MAX_BYTES + 1),
    (e: { code?: string }) => e.code === "source_too_large"
  );

  // Early reject via Content-Length (pas d'allocation 50 Mo en test)
  const over = makeHarness({
    videoBytes: new Uint8Array([1]),
    contentLength: String(AICCOS_MAX_BYTES + 1),
  });
  const tooBig = await over.pipeline.send(
    { videoUrl: "https://cdn.example/a.mp4", title: "T" },
    CTX
  );
  assert.equal(tooBig.status, "failed");
  if (tooBig.status === "failed") {
    assert.equal(tooBig.error.code, "source_too_large");
    const http = mapPipelineResultToHistoricalHttp(tooBig);
    assert.equal(http.status, 400);
    assert.match(String(http.body.error), /max 50 Mo/);
  }
  assert.equal(over.calls.length, 1);

  const empty = makeHarness({ videoBytes: new Uint8Array(0), contentLength: "0" });
  const emptyRes = await empty.pipeline.send(
    { videoUrl: "https://cdn.example/a.mp4", title: "T" },
    CTX
  );
  assert.equal(emptyRes.status, "failed");
  if (emptyRes.status === "failed") {
    assert.equal(mapPipelineResultToHistoricalHttp(emptyRes).status, 502);
  }
});

test("caractérisation — HTTP et HTTPS source ; schéma invalide ; titre", () => {
  assert.doesNotThrow(() =>
    parseHistoricalAiccosBody({ videoUrl: "http://cdn.example/a.mp4", title: "T" })
  );
  assert.doesNotThrow(() =>
    parseHistoricalAiccosBody({ videoUrl: "https://cdn.example/a.mp4", title: "T" })
  );
  assert.throws(
    () => parseHistoricalAiccosBody({ videoUrl: "ftp://x", title: "T" }),
    (e: { code?: string }) => e.code === "invalid_source_url"
  );
  assert.throws(
    () => parseHistoricalAiccosBody({ videoUrl: "https://x", title: "  " }),
    (e: { publicMessage?: string }) => e.publicMessage === "Un titre est requis."
  );
});

test("caractérisation — erreurs download / import / upload / complete + HTTP", async () => {
  const dl = makeHarness({ videoStatus: 404 });
  const r1 = await dl.pipeline.send(
    { videoUrl: "https://cdn.example/a.mp4", title: "T" },
    CTX
  );
  assert.equal(r1.status, "failed");
  assert.deepEqual(mapPipelineResultToHistoricalHttp(r1), {
    status: 502,
    body: { error: "Téléchargement de la vidéo impossible (404)." },
  });
  assert.equal(dl.calls.length, 1);

  const imp = makeHarness({ importStatus: 403, importBody: { error: "forbidden" } });
  const r2 = await imp.pipeline.send(
    { videoUrl: "https://cdn.example/a.mp4", title: "T" },
    CTX
  );
  assert.equal(mapPipelineResultToHistoricalHttp(r2).body.error, "forbidden");
  assert.equal(imp.calls.length, 2);

  const up = makeHarness({ uploadStatus: 500, uploadBodyText: "storage boom" });
  const r3 = await up.pipeline.send(
    { videoUrl: "https://cdn.example/a.mp4", title: "T" },
    CTX
  );
  assert.equal(
    mapPipelineResultToHistoricalHttp(r3).body.error,
    "L'upload du clip a échoué (500). storage boom"
  );
  assert.equal(up.calls.length, 3);

  const done = makeHarness({
    completeStatus: 502,
    completeBody: { error: "complete no" },
  });
  const r4 = await done.pipeline.send(
    { videoUrl: "https://cdn.example/a.mp4", title: "T" },
    CTX
  );
  assert.equal(mapPipelineResultToHistoricalHttp(r4).body.error, "complete no");
  assert.equal(done.calls.length, 4);
});

test("caractérisation — fileNameFromUrl + fallback clock", () => {
  assert.equal(fileNameFromUrl("https://cdn.example/path/clip.webm", NOW), "clip.webm");
  assert.equal(fileNameFromUrl("https://cdn.example/path/noext", NOW), `clip-${NOW}.mp4`);
});

test("caractérisation — MIME custom propagé au PUT", async () => {
  const { pipeline, calls } = makeHarness({ contentType: "video/webm; codecs=vp9" });
  await pipeline.send({ videoUrl: "https://cdn.example/a.webm", title: "T" }, CTX);
  assert.equal(JSON.parse(String(calls[1]!.body)).mimeType, "video/webm");
  assert.equal(calls[2]!.headers?.["Content-Type"], "video/webm");
});
