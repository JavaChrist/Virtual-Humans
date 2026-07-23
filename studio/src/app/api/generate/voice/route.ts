import { NextRequest, NextResponse } from "next/server";
import { generateVoice } from "@/lib/providers/elevenlabs-voice";
import { estimateVoice } from "@/lib/pricing";
import { getVoiceConfig } from "@/lib/sdk";
import { addSpend } from "@/lib/budget";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").trim();
  const voiceId = body.voiceId ? String(body.voiceId) : undefined;
  const character = body.character ? String(body.character) : undefined;

  if (!text) return NextResponse.json({ error: "Text is required" }, { status: 400 });

  // Character voice config (SDK) supplies the default voice + delivery settings.
  const cfg = getVoiceConfig(character);
  const modelId = cfg?.model || undefined;

  try {
    const result = await generateVoice({
      text,
      voiceId: voiceId || cfg?.voiceId || undefined,
      modelId,
      stability: cfg?.stability,
      similarityBoost: cfg?.similarityBoost,
      style: cfg?.style,
      speakerBoost: cfg?.speakerBoost,
      speed: cfg?.speed,
    });
    const { usd, credits } = estimateVoice(text.length);
    await addSpend({ type: "voice", provider: "elevenlabs", model: modelId || "eleven_multilingual_v2", estimateUSD: usd, note: `${credits} chars` });
    return NextResponse.json({ ...result, estimateUSD: usd, credits });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed" },
      { status: 500 },
    );
  }
}
