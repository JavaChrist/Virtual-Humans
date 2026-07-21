import { NextRequest, NextResponse } from "next/server";
import { submitJob, uploadDataUrl } from "@/lib/providers/fal";
import { estimateVideo, getVideoModel } from "@/lib/pricing";
import { addSpend } from "@/lib/budget";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const modelId = String(body.model ?? "");
  const prompt = String(body.prompt ?? "").trim();
  const seconds = Number(body.seconds ?? 0);
  const aspectRatio = String(body.aspectRatio ?? "9:16");
  let imageUrl = body.imageUrl ? String(body.imageUrl) : undefined;

  const model = getVideoModel(modelId);
  if (!model) return NextResponse.json({ error: "Unknown video model" }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

  if (model.mode === "image-to-video" && !imageUrl) {
    return NextResponse.json(
      { error: "Ce modèle nécessite une image de référence (image→vidéo)" },
      { status: 400 },
    );
  }

  try {
    // A data-URL reference image must be uploaded to fal first.
    if (imageUrl && imageUrl.startsWith("data:")) {
      imageUrl = await uploadDataUrl(imageUrl, "reference");
    }

    const input: Record<string, unknown> = { prompt, aspect_ratio: aspectRatio };
    if (model.mode === "image-to-video") {
      input.image_url = imageUrl;
      input.duration = seconds;
    } else {
      input.duration = String(seconds);
    }

    const requestId = await submitJob(model.id, input);
    const usd = estimateVideo(model.id, seconds);
    addSpend({ type: "video", provider: "fal", model: model.id, estimateUSD: usd, note: `${seconds}s ${model.engine}` });
    return NextResponse.json({ requestId, model: model.id, estimateUSD: usd });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Submission failed" },
      { status: 500 },
    );
  }
}
