import { NextRequest, NextResponse } from "next/server";
import { submitJob } from "@/lib/providers/fal";
import { MERGE_MODEL_ID, estimateMerge } from "@/lib/pricing";
import { addSpend } from "@/lib/budget";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const videoUrls: string[] = Array.isArray(body.videoUrls) ? body.videoUrls.map(String) : [];
  const totalSeconds = Number(body.totalSeconds ?? 0);

  if (videoUrls.length < 2) {
    return NextResponse.json({ error: "Au moins 2 clips sont requis pour l'assemblage" }, { status: 400 });
  }

  try {
    const input: Record<string, unknown> = { video_urls: videoUrls };
    const requestId = await submitJob(MERGE_MODEL_ID, input);
    const usd = estimateMerge(totalSeconds);
    addSpend({ type: "video", provider: "fal", model: MERGE_MODEL_ID, estimateUSD: usd, note: `merge ${videoUrls.length} clips` });
    return NextResponse.json({ requestId, model: MERGE_MODEL_ID, estimateUSD: usd });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Merge failed" },
      { status: 500 },
    );
  }
}
