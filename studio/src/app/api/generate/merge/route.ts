import { NextRequest, NextResponse } from "next/server";
import { submitJob } from "@/lib/providers/fal";
import { MERGE_MODEL_ID, estimateMerge } from "@/lib/pricing";
import { addSpend, capReached } from "@/lib/budget";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Keyframe = { url: string; timestamp: number; duration: number };

/**
 * Assemble via fal compose (pistes vidéo + audio séparées).
 * merge-videos seul peut perdre l'audio des clips lip-syncés (codecs hétérogènes).
 * La piste audio réutilise les mêmes URLs : fal extrait l'audio de chaque vidéo.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const videoUrls: string[] = Array.isArray(body.videoUrls) ? body.videoUrls.map(String) : [];
  const totalSeconds = Number(body.totalSeconds ?? 0);
  const preserveAudio = body.preserveAudio !== false;
  const durationsIn: number[] = Array.isArray(body.durations)
    ? body.durations.map((d: unknown) => Number(d))
    : [];

  if (videoUrls.length < 2) {
    return NextResponse.json({ error: "Au moins 2 clips sont requis pour l'assemblage" }, { status: 400 });
  }

  const cap = await capReached();
  if (cap)
    return NextResponse.json(
      { error: `Plafond de budget atteint (${cap.total.toFixed(2)} $ / ${cap.cap.toFixed(2)} $). Réinitialise la dépense ou augmente BUDGET_CAP_USD.` },
      { status: 402 },
    );

  const fallbackSec = Math.max(1, totalSeconds / videoUrls.length);
  const durationsSec = videoUrls.map((_, i) => {
    const d = durationsIn[i];
    return Number.isFinite(d) && d > 0 ? d : fallbackSec;
  });

  let tMs = 0;
  const keyframes: Keyframe[] = videoUrls.map((url, i) => {
    const durationMs = Math.max(500, Math.round(durationsSec[i] * 1000));
    const kf = { url, timestamp: tMs, duration: durationMs };
    tMs += durationMs;
    return kf;
  });

  const tracks: { id: string; type: string; keyframes: Keyframe[] }[] = [
    { id: "video", type: "video", keyframes },
  ];
  if (preserveAudio) {
    // Même URL : fal lit la piste audio embarquée (clips lip-sync / carrousel sonorisé).
    tracks.push({
      id: "audio",
      type: "audio",
      keyframes: keyframes.map((k) => ({ ...k })),
    });
  }

  try {
    const requestId = await submitJob(MERGE_MODEL_ID, { tracks });
    const usd = estimateMerge(totalSeconds || tMs / 1000);
    await addSpend({
      type: "video",
      provider: "fal",
      model: MERGE_MODEL_ID,
      estimateUSD: usd,
      note: `compose ${videoUrls.length} clips${preserveAudio ? "+audio" : " (muet)"}`,
    });
    return NextResponse.json({ requestId, model: MERGE_MODEL_ID, estimateUSD: usd });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Merge failed" },
      { status: 500 },
    );
  }
}
