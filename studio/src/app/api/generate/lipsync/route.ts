import { NextRequest, NextResponse } from "next/server";
import { submitJob, uploadDataUrl } from "@/lib/providers/fal";
import { estimateLipsync, getLipsyncModel } from "@/lib/pricing";
import { addSpend } from "@/lib/budget";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const modelId = String(body.model ?? "veed/lipsync");
  const videoUrl = String(body.videoUrl ?? "");
  const audio = String(body.audioUrl ?? body.audioDataUrl ?? "");
  const seconds = Number(body.seconds ?? 0);

  const model = getLipsyncModel(modelId);
  if (!model) return NextResponse.json({ error: "Unknown lip-sync model" }, { status: 400 });
  if (!videoUrl) return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
  if (!audio) return NextResponse.json({ error: "audio is required" }, { status: 400 });

  try {
    const video_url = videoUrl.startsWith("data:") ? await uploadDataUrl(videoUrl, "video") : videoUrl;
    const audio_url = audio.startsWith("data:") ? await uploadDataUrl(audio, "audio") : audio;

    const requestId = await submitJob(model.id, { video_url, audio_url });
    const usd = estimateLipsync(model.id, seconds);
    addSpend({ type: "video", provider: "fal", model: model.id, estimateUSD: usd, note: `lipsync ${seconds}s` });
    return NextResponse.json({ requestId, model: model.id, estimateUSD: usd });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lip-sync failed" },
      { status: 500 },
    );
  }
}
