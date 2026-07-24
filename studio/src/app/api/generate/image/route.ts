import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/providers/openai-image";
import { estimateImage, type ImageQuality, type ImageSize } from "@/lib/pricing";
import { addSpend, capReached } from "@/lib/budget";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt ?? "").trim();
  const size = (body.size ?? "1024x1024") as ImageSize;
  const quality = (body.quality ?? "medium") as ImageQuality;

  if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

  const cap = await capReached();
  if (cap)
    return NextResponse.json(
      { error: `Plafond de budget atteint (${cap.total.toFixed(2)} $ / ${cap.cap.toFixed(2)} $). Réinitialise la dépense ou augmente BUDGET_CAP_USD.` },
      { status: 402 },
    );

  try {
    const result = await generateImage({ prompt, size, quality });
    const usd = estimateImage(size, quality, 1);
    await addSpend({ type: "image", provider: "openai", model: "gpt-image-1", estimateUSD: usd, note: `${size} ${quality}` });
    return NextResponse.json({ ...result, estimateUSD: usd });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed" },
      { status: 500 },
    );
  }
}
