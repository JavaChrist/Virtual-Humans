import { NextResponse } from "next/server";
import { LIPSYNC_MODELS, VIDEO_MODELS } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ models: VIDEO_MODELS, lipsyncModels: LIPSYNC_MODELS });
}
