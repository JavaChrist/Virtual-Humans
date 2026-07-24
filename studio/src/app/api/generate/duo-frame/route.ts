import { NextRequest, NextResponse } from "next/server";
import { combineIdentities, uploadBuffer, extractFalError } from "@/lib/providers/fal";
import { readAsset } from "@/lib/sdk";
import { estimateDuoFrame, DUO_FRAME_MODEL_ID } from "@/lib/pricing";
import { addSpend, capReached } from "@/lib/budget";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Ref {
  character: string;
  refPath: string;
}

/**
 * Route B (prototype) : fabrique une image contenant PLUSIEURS présentateurs
 * ensemble, à partir des vraies photos d'identité de chaque personnage.
 * Body: { characters: [{character, refPath}], decor?, aspectRatio? }
 * Renvoie { imageUrl } — à utiliser comme frame de départ Kling.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rawList: unknown[] = Array.isArray(body.characters) ? body.characters : [];
  const refs: Ref[] = rawList
    .map((c) => c as Ref)
    .filter((c) => c && typeof c.character === "string" && typeof c.refPath === "string");
  const decor = String(body.decor ?? "").trim();
  const aspectRatio = String(body.aspectRatio ?? "9:16");

  if (refs.length < 2)
    return NextResponse.json({ error: "Sélectionne au moins deux présentateurs" }, { status: 400 });

  const cap = await capReached();
  if (cap)
    return NextResponse.json(
      { error: `Plafond de budget atteint (${cap.total.toFixed(2)} $ / ${cap.cap.toFixed(2)} $).` },
      { status: 402 },
    );

  try {
    const urls: string[] = [];
    for (const r of refs.slice(0, 4)) {
      const asset = readAsset(r.character, r.refPath);
      if (asset) urls.push(await uploadBuffer(asset.buffer, asset.mime, "duo"));
    }
    if (urls.length < 2)
      return NextResponse.json({ error: "Images d'identité introuvables pour ces présentateurs" }, { status: 400 });

    const prompt =
      `Combine the people from the reference images into a single photorealistic photo, standing together ` +
      `${decor ? `in ${decor}` : "in a clean studio"}. Keep each person's exact face, hairstyle and identity unchanged; ` +
      `do not blend the faces. All of them facing the camera, side by side, medium shot (waist up), natural lighting, ` +
      `same scene and consistent lighting for everyone.`;

    const imageUrl = await combineIdentities(urls, prompt, aspectRatio);
    const usd = estimateDuoFrame();
    await addSpend({ type: "image", provider: "fal", model: DUO_FRAME_MODEL_ID, estimateUSD: usd, note: `duo ${urls.length} personnes` });
    return NextResponse.json({ imageUrl, estimateUSD: usd });
  } catch (e) {
    const detail = extractFalError(e);
    console.error("[duo-frame] échec", detail);
    if (/exhausted balance|user is locked|top up/i.test(detail)) {
      return NextResponse.json(
        { error: "Solde fal.ai épuisé — recharge ton compte sur fal.ai/dashboard/billing." },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: detail || "Génération de l'image duo échouée" }, { status: 500 });
  }
}
