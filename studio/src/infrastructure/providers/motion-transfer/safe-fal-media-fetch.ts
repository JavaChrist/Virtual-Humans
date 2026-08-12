/**
 * MT-013K-OUTPUT-TRANSPORT — SSRF-safe fal/CDN media download.
 * URL is never logged with credentials; hosts must match allowlist.
 * Single network attempt per step — no automatic retry.
 */

import { lookup } from "node:dns/promises";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MotionTransferDomainError } from "@/domain/motion";
import { MOTION_ASSET_MAX_BYTES } from "@/application/motion/motion-asset-path";

export const SAFE_FAL_MEDIA_FETCH_VERSION = "mt013k-safe-fetch-1.0.0" as const;

/** Official fal CDN / media hosts (hostname suffix match). */
export const FAL_MEDIA_ALLOWED_HOST_SUFFIXES = [
  "fal.media",
  "fal.ai",
] as const;

export const FAL_MEDIA_DOWNLOAD_TIMEOUT_MS = 60_000;
export const FAL_MEDIA_MAX_REDIRECTS = 3;

export type SafeFetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    redirect?: "manual" | "error" | "follow";
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  url?: string;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
  body?: ReadableStream<Uint8Array> | null;
}>;

export type SafeFalMediaFetchResult = {
  bytes: Uint8Array;
  mimeType: "video/mp4";
  sizeBytes: number;
  /** Redacted origin label only — never full URL. */
  originLabel: string;
  /** True when temp file was cleaned in finally. */
  tempCleaned: boolean;
};

function isIpv4Private(hostname: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!m) return false;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isIpv6Blocked(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "::1") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // ULA
  if (h.startsWith("fe80")) return true; // link-local
  return false;
}

export function isBlockedHostnameOrIp(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) {
    return true;
  }
  if (h === "metadata" || h === "metadata.google.internal") return true;
  if (isIpv4Private(h)) return true;
  if (isIpv6Blocked(h)) return true;
  return false;
}

export function isFalMediaHostAllowed(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!h || isBlockedHostnameOrIp(h)) return false;
  return FAL_MEDIA_ALLOWED_HOST_SUFFIXES.some(
    (suffix) => h === suffix || h.endsWith(`.${suffix}`),
  );
}

/** Origin label safe for logs — hostname only, no query/credentials. */
export function falMediaOriginLabel(urlString: string): string {
  try {
    const u = new URL(urlString);
    return u.hostname.toLowerCase();
  } catch {
    return "invalid-url";
  }
}

export function assertSafeFalMediaUrl(urlString: string): URL {
  let u: URL;
  try {
    u = new URL(urlString);
  } catch {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "URL média fal invalide.",
    );
  }
  if (u.protocol !== "https:") {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "URL média fal — HTTPS obligatoire.",
    );
  }
  if (u.username || u.password) {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "URL média fal — credentials interdits.",
    );
  }
  if (/^data:/i.test(urlString) || urlString.includes(";base64,")) {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "data URL / base64 interdit.",
    );
  }
  if (!isFalMediaHostAllowed(u.hostname)) {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "Host média fal non autorisé.",
      { diagnostic: `host=${falMediaOriginLabel(urlString)}` },
    );
  }
  return u;
}

async function assertDnsNotPrivate(
  hostname: string,
  dnsLookup: typeof lookup = lookup,
): Promise<void> {
  if (isBlockedHostnameOrIp(hostname)) {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "Host média fal bloqué (loopback/privé).",
    );
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")) {
    return;
  }
  try {
    const results = await dnsLookup(hostname, { all: true });
    for (const r of results) {
      if (isBlockedHostnameOrIp(r.address)) {
        throw new MotionTransferDomainError(
          "provider_output_invalid",
          "DNS média fal résout vers IP privée (rebind).",
          { diagnostic: `host=${hostname}` },
        );
      }
    }
  } catch (err) {
    if (err instanceof MotionTransferDomainError) throw err;
    // DNS unavailable in some test envs — hostname allowlist still enforced.
  }
}

function mergeAbortSignals(
  timeoutMs: number,
  outer?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const onOuter = () => controller.abort();
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", onOuter, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onOuter);
    },
  };
}

export type SafeFalMediaFetchOptions = {
  fetchImpl?: SafeFetchLike;
  dnsLookup?: typeof lookup;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** When true, skip DNS resolution (unit tests with fake fetch). */
  skipDnsLookup?: boolean;
  /** TEST ONLY — observe temp cleanup. */
  onTempCleaned?: () => void;
};

/**
 * Download exactly one media body from an ephemeral fal URL (memory-only).
 * Writes a bounded temp file then cleans it in `finally`.
 * Single attempt — no automatic retry.
 */
export async function safeFetchFalMedia(
  urlString: string,
  options: SafeFalMediaFetchOptions & { signal?: AbortSignal } = {},
): Promise<SafeFalMediaFetchResult> {
  const maxBytes = options.maxBytes ?? MOTION_ASSET_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? FAL_MEDIA_MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? FAL_MEDIA_DOWNLOAD_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as SafeFetchLike);

  let current = assertSafeFalMediaUrl(urlString);
  if (!options.skipDnsLookup) {
    await assertDnsNotPrivate(current.hostname, options.dnsLookup);
  }

  const { signal, cleanup } = mergeAbortSignals(timeoutMs, options.signal);
  let redirectCount = 0;
  let tempDir: string | undefined;
  const outcome: { value?: SafeFalMediaFetchResult } = {};

  try {
    while (true) {
      let response;
      try {
        response = await fetchImpl(current.toString(), {
          method: "GET",
          redirect: "manual",
          signal,
          headers: {
            Accept: "video/mp4",
          },
        });
      } catch (err) {
        if (signal.aborted) {
          throw new MotionTransferDomainError(
            "provider_timeout",
            "Timeout téléchargement média fal.",
          );
        }
        throw new MotionTransferDomainError(
          "provider_failed",
          "Échec téléchargement média fal.",
          {
            diagnostic: err instanceof Error ? err.name : "fetch_error",
          },
        );
      }

      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get("location")
      ) {
        redirectCount += 1;
        if (redirectCount > maxRedirects) {
          throw new MotionTransferDomainError(
            "provider_output_invalid",
            "Trop de redirects média fal.",
          );
        }
        const loc = response.headers.get("location")!;
        const next = new URL(loc, current);
        current = assertSafeFalMediaUrl(next.toString());
        if (!options.skipDnsLookup) {
          await assertDnsNotPrivate(current.hostname, options.dnsLookup);
        }
        continue;
      }

      if (!response.ok) {
        throw new MotionTransferDomainError(
          "provider_failed",
          "Téléchargement média fal HTTP non OK.",
          { diagnostic: `http=${response.status}` },
        );
      }

      const contentType = (response.headers.get("content-type") ?? "")
        .split(";")[0]
        ?.trim()
        .toLowerCase();
      if (contentType && contentType !== "video/mp4") {
        throw new MotionTransferDomainError(
          "provider_output_invalid",
          "MIME média fal non autorisé.",
          { diagnostic: `mime=${contentType}` },
        );
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        const declared = Number(contentLength);
        if (Number.isFinite(declared) && declared > maxBytes) {
          throw new MotionTransferDomainError(
            "provider_output_invalid",
            "Content-Length média fal trop grand.",
          );
        }
        if (Number.isFinite(declared) && declared <= 0) {
          throw new MotionTransferDomainError(
            "provider_output_invalid",
            "Fichier média fal vide (Content-Length).",
          );
        }
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > maxBytes) {
        throw new MotionTransferDomainError(
          "provider_output_invalid",
          "Stream média fal dépasse la limite.",
        );
      }
      if (buffer.byteLength === 0) {
        throw new MotionTransferDomainError(
          "provider_output_invalid",
          "Fichier média fal vide.",
        );
      }

      const bytes = new Uint8Array(buffer);
      tempDir = await mkdtemp(join(tmpdir(), "mt-fal-media-"));
      const tempFile = join(tempDir, "output.mp4");
      await writeFile(tempFile, bytes);
      const fromDisk = await readFile(tempFile);
      if (fromDisk.byteLength !== bytes.byteLength) {
        throw new MotionTransferDomainError(
          "provider_failed",
          "Écriture temporaire média fal incohérente.",
        );
      }

      outcome.value = {
        bytes: new Uint8Array(fromDisk),
        mimeType: "video/mp4",
        sizeBytes: fromDisk.byteLength,
        originLabel: falMediaOriginLabel(current.toString()),
        tempCleaned: false,
      };
      break;
    }
  } finally {
    cleanup();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      if (outcome.value) outcome.value.tempCleaned = true;
      options.onTempCleaned?.();
    }
  }

  if (!outcome.value) {
    throw new MotionTransferDomainError(
      "provider_failed",
      "Téléchargement média fal sans résultat.",
    );
  }
  return outcome.value;
}
