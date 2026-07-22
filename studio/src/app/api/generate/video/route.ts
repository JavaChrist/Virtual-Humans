import { NextRequest, NextResponse } from "next/server";
import { submitJob, uploadBuffer, uploadDataUrl, uploadMany } from "@/lib/providers/fal";
import { estimateVideo, getVideoModel } from "@/lib/pricing";
import { readAsset } from "@/lib/sdk";
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
  const imageUrls: string[] = Array.isArray(body.imageUrls) ? body.imageUrls.map(String) : [];
  // SDK assets: { character, assetPaths[] } read from disk and uploaded to fal.
  const character = body.character ? String(body.character) : undefined;
  const assetPaths: string[] = Array.isArray(body.assetPaths) ? body.assetPaths.map(String) : [];

  const model = getVideoModel(modelId);
  if (!model) return NextResponse.json({ error: "Unknown video model" }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

  if (model.mode === "image-to-video" && !imageUrl) {
    return NextResponse.json(
      { error: "Ce modèle nécessite une image de référence (image→vidéo)" },
      { status: 400 },
    );
  }
  if (model.mode === "reference-to-video" && imageUrls.length === 0 && assetPaths.length === 0) {
    return NextResponse.json(
      { error: "Sélectionne au moins une image de référence de ton personnage" },
      { status: 400 },
    );
  }

  try {
    const input: Record<string, unknown> = { prompt };
    if (model.sendAspectRatio) input.aspect_ratio = aspectRatio;
    if (model.audio === "native") input.generate_audio = true;

    if (model.mode === "reference-to-video") {
      // Upload SDK asset images (read from disk) + any inline data-URL images.
      const assetUrls: string[] = [];
      for (const rel of assetPaths.slice(0, 9)) {
        const asset = readAsset(character ?? "", rel);
        if (asset) assetUrls.push(await uploadBuffer(asset.buffer, asset.mime, "identity"));
      }
      const dataUrls = imageUrls.length ? await uploadMany(imageUrls, "identity") : [];
      const urls = [...assetUrls, ...dataUrls].slice(0, 9);
      if (urls.length === 0) {
        return NextResponse.json({ error: "Aucune image de référence valide" }, { status: 400 });
      }
      const mentions = urls.map((_, i) => `@Image${i + 1}`).join(", ");
      input.image_urls = urls;
      input.prompt = `Le personnage principal correspond exactement à ${mentions} : même visage, même coiffure, même identité, sans aucune variation. ${prompt}`;
      input.duration = seconds;
      input.seed = Math.floor(Math.random() * 1_000_000);
    } else if (model.mode === "image-to-video") {
      if (imageUrl && imageUrl.startsWith("data:")) imageUrl = await uploadDataUrl(imageUrl, "reference");
      input.image_url = imageUrl;
      input.duration = seconds;
    } else {
      // Veo expects "8s"; Kling/MiniMax expect "8".
      input.duration = `${seconds}${model.durationSuffix}`;
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
