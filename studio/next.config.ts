import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The SDK data (character fiches + image assets) lives one level up, in
  // `<repo>/characters`. On Vercel, dynamic fs reads are NOT traced automatically,
  // so we set the tracing root to the repo root and force-include the data dir
  // in the serverless functions that read it.
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  outputFileTracingIncludes: {
    "/api/**": ["../characters/**"],
  },
};

export default nextConfig;
