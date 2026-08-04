import type { NextConfig } from "next";
import path from "node:path";
import {
  characterFsTracingIncludes,
  fileTracingExcludes,
} from "./file-tracing";

// En développement, on NE fixe PAS `outputFileTracingRoot` sur la racine du repo :
// sinon le watcher de Turbopack surveille tout le dépôt (characters/**, des
// centaines d'images, PDF, transcripts…), ce qui fait exploser la mémoire et
// déclenche le redémarrage en boucle du serveur dev.
//
// En production (build Vercel), le tracing parent est nécessaire pour les lectures
// fs du SDK sous `<repo>/characters`. Les includes sont bornés aux seules routes
// character/media (Porte 4B — ENOSPC packaging).
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  ...(isDev
    ? {}
    : {
        outputFileTracingRoot: path.join(process.cwd(), ".."),
        outputFileTracingIncludes: characterFsTracingIncludes(),
        outputFileTracingExcludes: fileTracingExcludes(),
      }),
  // Le SW et le manifest ne doivent JAMAIS être mis en cache longtemps,
  // sinon les mises à jour PWA restent invisibles.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/login",
        headers: [
          { key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
