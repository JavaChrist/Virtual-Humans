import { NextRequest, NextResponse } from "next/server";
import { submitJob, uploadDataUrl, extractFalError } from "@/lib/providers/fal";
import { MERGE_AUDIO_MODEL_ID, estimateMergeAudio } from "@/lib/pricing";
import { addSpend, capReached } from "@/lib/budget";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Colle une voix off sur une vidéo silencieuse (ex. diaporama carrousel).
 * Body: { videoUrl, audioUrl, seconds? }
 * Utilise fal ffmpeg merge-audio-video → sortie compatible /status ({ video: { url } }).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const videoUrl = String(body.videoUrl ?? "");
  const audio = String(body.audioUrl ?? body.audioDataUrl ?? "");
  const seconds = Number(body.seconds ?? 0);

  if (!videoUrl) return NextResponse.json({ error: "videoUrl requis" }, { status: 400 });
  if (!audio) return NextResponse.json({ error: "audio requis" }, { status: 400 });

  const cap = await capReached();
  if (cap)
    return NextResponse.json(
      { error: `Plafond de budget atteint (${cap.total.toFixed(2)} $ / ${cap.cap.toFixed(2)} $).` },
      { status: 402 },
    );

  try {
    const video_url = videoUrl.startsWith("data:") ? await uploadDataUrl(videoUrl, "video") : videoUrl;
    const audio_url = audio.startsWith("data:") ? await uploadDataUrl(audio, "audio") : audio;

    const requestId = await submitJob(MERGE_AUDIO_MODEL_ID, { video_url, audio_url });
    const usd = estimateMergeAudio(seconds);
    await addSpend({
      type: "video",
      provider: "fal",
      model: MERGE_AUDIO_MODEL_ID,
      estimateUSD: usd,
      note: "voix off carrousel",
    });
    return NextResponse.json({ requestId, model: MERGE_AUDIO_MODEL_ID, estimateUSD: usd });
  } catch (e) {
    const detail = extractFalError(e);
    console.error("[merge-audio] échec", detail);
    if (/exhausted balance|user is locked|top up/i.test(detail)) {
      return NextResponse.json(
        { error: "Solde fal.ai épuisé — recharge ton compte sur fal.ai/dashboard/billing." },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: detail || "Ajout de la voix off échoué" }, { status: 500 });
  }
}
