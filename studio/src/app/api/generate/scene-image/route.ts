import { NextRequest, NextResponse } from "next/server";
import { generateIdentityImage, uploadBuffer } from "@/lib/providers/fal";
import { readAsset } from "@/lib/sdk";
import { estimateSceneImage } from "@/lib/pricing";
import { addSpend } from "@/lib/budget";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Génère une image fixe du personnage dans un décor (identité préservée).
 * Body: { character, refPath (asset SDK), prompt (décor), imageSize? }
 * Renvoie une URL d'image utilisable comme frame de départ pour Kling image→vidéo.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const character = body.character ? String(body.character) : undefined;
  const refPath = String(body.refPath ?? "");
  const prompt = String(body.prompt ?? "").trim();
  const imageSize = String(body.imageSize ?? "portrait_16_9");

  if (!refPath) return NextResponse.json({ error: "refPath (image d'identité) requis" }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "prompt (décor) requis" }, { status: 400 });

  const asset = readAsset(character ?? "", refPath);
  if (!asset) return NextResponse.json({ error: "Image d'identité introuvable" }, { status: 400 });

  try {
    const referenceImageUrl = await uploadBuffer(asset.buffer, asset.mime, "identity");
    const imageUrl = await generateIdentityImage(referenceImageUrl, prompt, imageSize);
    const usd = estimateSceneImage();
    await addSpend({ type: "image", provider: "fal", model: "fal-ai/flux-pulid", estimateUSD: usd, note: "scene still" });
    return NextResponse.json({ imageUrl, estimateUSD: usd });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Génération d'image échouée" },
      { status: 500 },
    );
  }
}
