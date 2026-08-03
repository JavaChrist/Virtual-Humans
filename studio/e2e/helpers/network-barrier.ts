import type { BrowserContext, Page, Request, Route } from "@playwright/test";

const PROVIDER_HOST_RE =
  /(?:^|\.)(?:openai\.com|api\.openai\.com|fal\.ai|fal\.run|elevenlabs\.io|api\.elevenlabs\.io|aiccos|aicommandcenteros\.app)/i;

export type NetworkBarrier = {
  violations: string[];
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

/** Classifie une URL externe provider ; null si locale / hors provider. */
export function classifyExternalRequest(url: string): string | null {
  if (isLocalAllowedUrl(url)) return null;
  const host = hostnameOf(url);
  if (PROVIDER_HOST_RE.test(host) || PROVIDER_HOST_RE.test(url)) {
    return host || url;
  }
  return null;
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

function recordViolation(violations: string[], url: string): void {
  const classified = classifyExternalRequest(url);
  if (classified) {
    violations.push(url);
  } else if (!isLocalAllowedUrl(url)) {
    violations.push(`external:${url}`);
  }
}

/**
 * Barrière réseau navigateur.
 * - Abort hard des hosts providers uniquement (évite de casser des navigations).
 * - Détecte tout hors-localhost et fail via assertClean.
 */
export async function installNetworkBarrier(page: Page): Promise<NetworkBarrier> {
  const violations: string[] = [];
  const context: BrowserContext = page.context();

  const onRequest = (request: Request) => {
    recordViolation(violations, request.url());
  };
  page.on("request", onRequest);

  const abortProvider = async (route: Route) => {
    const url = route.request().url();
    if (isLocalAllowedUrl(url)) {
      await route.fallback();
      return;
    }
    recordViolation(violations, url);
    if (classifyExternalRequest(url)) {
      await route.abort("blockedbyclient");
      return;
    }
    // Non-provider externe : laisser passer le réseau mais enregistrer (assertClean).
    await route.fallback();
  };

  await context.route("**/*openai.com/**", abortProvider);
  await context.route("**/*fal.ai/**", abortProvider);
  await context.route("**/*fal.run/**", abortProvider);
  await context.route("**/*elevenlabs.io/**", abortProvider);
  await context.route("**/*aicommandcenteros.app/**", abortProvider);

  return {
    violations,
    assertClean: () => {
      const providers = violations.filter((url) => {
        const raw = url.replace(/^external:/, "");
        return PROVIDER_HOST_RE.test(hostnameOf(raw)) || PROVIDER_HOST_RE.test(raw);
      });
      if (providers.length > 0) {
        throw new Error(
          `E2E network barrier: provider requests detected:\n${providers.join("\n")}`,
        );
      }
    },
    dispose: async () => {
      page.off("request", onRequest);
      await context.unrouteAll({ behavior: "ignoreErrors" }).catch(() => undefined);
    },
  };
}
