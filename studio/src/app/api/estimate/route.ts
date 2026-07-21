import { NextRequest, NextResponse } from "next/server";
import {
  estimateImage,
  estimateLipsync,
  estimateVideo,
  estimateVoice,
  type ImageQuality,
  type ImageSize,
} from "@/lib/pricing";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { type } = body as { type?: string };

  try {
    if (type === "image") {
      const usd = estimateImage(body.size as ImageSize, body.quality as ImageQuality, body.n ?? 1);
      return NextResponse.json({ type, usd, currency: "USD" });
    }
    if (type === "voice") {
      const { credits, usd } = estimateVoice(Number(body.chars ?? 0));
      return NextResponse.json({ type, usd, credits, currency: "USD" });
    }
    if (type === "video") {
      const usd = estimateVideo(String(body.model), Number(body.seconds ?? 0));
      return NextResponse.json({ type, usd, currency: "USD" });
    }
    if (type === "lipsync") {
      const usd = estimateLipsync(String(body.model), Number(body.seconds ?? 0));
      return NextResponse.json({ type, usd, currency: "USD" });
    }
    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Estimate failed" },
      { status: 500 },
    );
  }
}
