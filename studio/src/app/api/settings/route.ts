import { NextResponse } from "next/server";
import { CHARACTER_NAME, REPO_ROOT } from "@/lib/sdk";
import { ELEVENLABS_USD_PER_1K_CHARS } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    keys: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
      elevenlabsVoice: Boolean(process.env.ELEVENLABS_VOICE_ID),
      fal: Boolean(process.env.FAL_KEY),
    },
    sdk: { repoRoot: REPO_ROOT, character: CHARACTER_NAME },
    pricing: { elevenlabsUsdPer1kChars: ELEVENLABS_USD_PER_1K_CHARS },
  });
}
