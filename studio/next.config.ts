import type { NextConfig } from "next";
import path from "node:path";

// En développement, on NE fixe PAS `outputFileTracingRoot` sur la racine du repo :
// sinon le watcher de Turbopack surveille tout le dépôt (characters/**, des
// centaines d'images, PDF, transcripts…), ce qui fait exploser la mémoire et
// déclenche le redémarrage en boucle du serveur dev.
//
// En production (build Vercel), ce tracing est nécessaire : les lectures fs
// dynamiques des fiches/assets SDK, situées un niveau au-dessus (`<repo>/characters`),
// ne sont pas tracées automatiquement — on force donc leur inclusion.
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  ...(isDev
    ? {}
    : {
        outputFileTracingRoot: path.join(process.cwd(), ".."),
        outputFileTracingIncludes: {
          "/api/**": ["../characters/**"],
        },
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
    ];
  },
};

export default nextConfig;
