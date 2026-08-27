import { NextResponse } from "next/server";
import { readSdkVersionFile } from "@/lib/app-version-fs";
import {
  APP_VERSION_CACHE_CONTROL,
  APP_VERSION_CDN_CACHE_CONTROL,
  resolveAppVersion,
} from "@/lib/app-version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERSION_HEADERS = {
  "Cache-Control": APP_VERSION_CACHE_CONTROL,
  "CDN-Cache-Control": APP_VERSION_CDN_CACHE_CONTROL,
  "Vercel-CDN-Cache-Control": APP_VERSION_CDN_CACHE_CONTROL,
  "X-Content-Type-Options": "nosniff",
};

export function buildVersionResponse() {
  return resolveAppVersion({
    sdkVersion: readSdkVersionFile(),
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    vercelEnv: process.env.VERCEL_ENV,
  });
}

export async function GET() {
  return NextResponse.json(buildVersionResponse(), { headers: VERSION_HEADERS });
}
