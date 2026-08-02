import { NextRequest } from "next/server";
import { CHARACTER_NAME, REPO_ROOT } from "@/lib/sdk";
import { ELEVENLABS_USD_PER_1K_CHARS } from "@/lib/pricing";
import { logger, startObservedRoute } from "@/infrastructure/observability";
import { getFeatureFlags } from "@/infrastructure/config/feature-flags";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const obs = startObservedRoute(req, {
    route: "/api/settings",
    operation: "settings.get",
  });

  try {
    const body = {
      keys: {
        openai: Boolean(process.env.OPENAI_API_KEY),
        elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
        elevenlabsVoice: Boolean(process.env.ELEVENLABS_VOICE_ID),
        fal: Boolean(process.env.FAL_KEY),
        supabase: Boolean(
          (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
            process.env.SUPABASE_SERVICE_ROLE_KEY,
        ),
      },
      sdk: { repoRoot: REPO_ROOT, character: CHARACTER_NAME },
      pricing: { elevenlabsUsdPer1kChars: ELEVENLABS_USD_PER_1K_CHARS },
      access: {
        protected: Boolean(process.env.APP_PASSWORD),
        budgetCapUSD: process.env.BUDGET_CAP_USD ? Number(process.env.BUDGET_CAP_USD) : null,
      },
      features: getFeatureFlags(),
    };
    logger.info("route.success", obs.context, { status: 200 });
    return obs.json(body);
  } catch (e) {
    logger.error("route.failure", obs.context, e);
    return obs.json(
      { error: e instanceof Error ? e.message : "Settings failed" },
      { status: 500 },
    );
  }
}
