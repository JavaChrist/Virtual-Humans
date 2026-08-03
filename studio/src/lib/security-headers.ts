/**
 * Baseline security headers (VHS-002 / Phase 7).
 * Compatible with Next.js App Router — CSP avoids breaking runtime.
 */

export const NO_STORE = "private, no-store, no-cache, must-revalidate";

/** Apply on auth/API responses. */
export function applyNoStoreHeaders(headers: Headers): void {
  headers.set("Cache-Control", NO_STORE);
  headers.set("Pragma", "no-cache");
}

/**
 * Baseline headers for HTML + API responses from the proxy.
 * CSP is report-friendly / compatible: allows Next.js inline for bootstrap.
 * HSTS is NOT set locally — document for production edge/CDN.
 */
export function applySecurityHeaders(headers: Headers): void {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  // frame-ancestors complements X-Frame-Options for modern browsers
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
}
