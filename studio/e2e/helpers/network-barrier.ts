import type { BrowserContext, Page, Request, Route } from "@playwright/test";

const PROVIDER_HOST_RE =
  /(?:^|\.)(?:openai\.com|api\.openai\.com|fal\.ai|fal\.run|elevenlabs\.io|api\.elevenlabs\.io|aiccos|aicommandcenteros\.app)/i;

const PRODUCTION_HOST_RE =
  /(?:^|\.)(?:supabase\.co|supabase\.com|vercel\.app|vercel\.com|amazonaws\.com|storage\.googleapis\.com)/i;

export type NetworkBarrier = {
  violations: string[];
  blockedAttempts: number;
  assertClean: () => void;
  dispose: () => Promise<void>;
};

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function looksSigned(url: string): boolean {
  return /[?&](?:token|X-Amz-Signature|X-Goog-Signature|sig)=/i.test(url);
}

/** Classifie une URL interdite ; null si locale / hors allowlist uniquement. */
export function classifyExternalRequest(url: string): string | null {
  if (isLocalAllowedUrl(url)) return null;
  if (looksSigned(url)) return "signed-url";
  const host = hostnameOf(url);
  if (PROVIDER_HOST_RE.test(host) || PROVIDER_HOST_RE.test(url)) {
    return host || url;
  }
  if (PRODUCTION_HOST_RE.test(host) || PRODUCTION_HOST_RE.test(url)) {
    return host || url;
  }
  return host || url;
}

export function isLocalAllowedUrl(url: string): boolean {
  if (
    !url ||
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("about:") ||
    url.startsWith("chrome-extension:") ||
    url.startsWith("chrome:") ||
    url.startsWith("devtools:")
  ) {
    return true;
  }
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^\[|\]$/g, "");
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "0.0.0.0" ||
      host.endsWith(".localhost")
    ) {
      return true;
    }
    if (host.startsWith("::ffff:127.") || host.startsWith("::ffff:0.")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Barrière réseau navigateur.
 * Toute URL hors allowlist locale est abortée immédiatement et fait échouer assertClean.
 * Aucun mock silencieux.
 */
export async function installNetworkBarrier(page: Page): Promise<NetworkBarrier> {
  const violations: string[] = [];
  let blockedAttempts = 0;
  const context: BrowserContext = page.context();

  const onRequest = (request: Request) => {
    const url = request.url();
    if (!isLocalAllowedUrl(url)) {
      violations.push(url);
    }
  };
  page.on("request", onRequest);

  const abortNonLocal = async (route: Route) => {
    const url = route.request().url();
    if (isLocalAllowedUrl(url)) {
      await route.continue();
      return;
    }
    blockedAttempts += 1;
    if (!violations.includes(url)) violations.push(url);
    await route.abort("blockedbyclient");
  };

  await context.route("**/*", abortNonLocal);

  return {
    violations,
    get blockedAttempts() {
      return blockedAttempts;
    },
    assertClean: () => {
      if (violations.length > 0 || blockedAttempts > 0) {
        throw new Error(
          `E2E network barrier: non-local requests detected (${blockedAttempts}):\n${violations.join("\n")}`,
        );
      }
    },
    dispose: async () => {
      page.off("request", onRequest);
      await context.unrouteAll({ behavior: "ignoreErrors" }).catch(() => undefined);
    },
  };
}
