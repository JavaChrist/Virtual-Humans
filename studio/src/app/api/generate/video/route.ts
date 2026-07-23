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

  if (model.mode === "image-to-video" && !imageUrl && assetPaths.length === 0) {
    return NextResponse.json(
      { error: "Ce modèle nécessite une image de départ (image→vidéo)" },
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

    // AUDIT: track where each reference image comes from.
    const imageOrigins: string[] = [];

    if (model.mode === "reference-to-video") {
      // Upload SDK asset images (read from disk) + any inline data-URL images.
      const assetUrls: string[] = [];
      for (const rel of assetPaths.slice(0, 9)) {
        const asset = readAsset(character ?? "", rel);
        if (asset) {
          assetUrls.push(await uploadBuffer(asset.buffer, asset.mime, "identity"));
          imageOrigins.push(`SDK asset — ${character ?? "?"}/assets/${rel}`);
        } else {
          imageOrigins.push(`SDK asset MISSING — ${character ?? "?"}/assets/${rel}`);
        }
      }
      const dataUrls = imageUrls.length ? await uploadMany(imageUrls, "identity") : [];
      dataUrls.forEach((_, i) => imageOrigins.push(`inline body.imageUrls[${i}]`));
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
      // Priorité 1 : image fournie dans le corps (data URL ou URL).
      if (imageUrl && imageUrl.startsWith("data:")) imageUrl = await uploadDataUrl(imageUrl, "reference");
      // Priorité 2 : première frame lue depuis un asset SDK (identité verrouillée).
      if (!imageUrl && assetPaths.length > 0) {
        const rel = assetPaths[0];
        const asset = readAsset(character ?? "", rel);
        if (asset) {
          imageUrl = await uploadBuffer(asset.buffer, asset.mime, "startframe");
          imageOrigins.push(`SDK asset (1re frame) — ${character ?? "?"}/assets/${rel}`);
        }
      } else if (imageUrl) {
        imageOrigins.push(`body.imageUrl: ${imageUrl}`);
      }
      if (!imageUrl) {
        return NextResponse.json({ error: "Aucune image de départ valide" }, { status: 400 });
      }
      input.image_url = imageUrl;
      // Kling attend une durée en chaîne ("5"); les autres modèles un nombre.
      input.duration = model.engine === "kling" ? String(seconds) : seconds;
      if (model.engine === "kling") {
        // Réduit le morphing / dédoublement d'identité observé en image→vidéo.
        input.negative_prompt =
          "morphing, double exposure, two people, extra person, duplicate face, changing clothes, outfit change, deformed, distorted, blurry, warping, identity change, gender change";
        input.cfg_scale = 0.5;
      }
    } else {
      // Veo expects "8s"; Kling/MiniMax expect "8".
      input.duration = `${seconds}${model.durationSuffix}`;
    }

    // ===== AUDIT: full payload actually sent to FAL =====
    console.log("===== FAL PAYLOAD =====");
    console.log("model:", model.id, "| mode:", model.mode);
    console.log("character:", character, "| assetPaths:", assetPaths, "| body.imageUrls:", imageUrls.length);
    if (Array.isArray(input.image_urls)) {
      (input.image_urls as string[]).forEach((u, i) =>
        console.log(`  image_urls[${i}] <- ${imageOrigins[i] ?? "?"} :: ${u}`)
      );
    }
    console.dir(input, { depth: null });
    console.log("========================");

    const requestId = await submitJob(model.id, input);
    const usd = estimateVideo(model.id, seconds);
    await addSpend({ type: "video", provider: "fal", model: model.id, estimateUSD: usd, note: `${seconds}s ${model.engine}` });
    return NextResponse.json({ requestId, model: model.id, estimateUSD: usd });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Submission failed" },
      { status: 500 },
    );
  }
}
