import { NextRequest } from "next/server";
import { generateImage } from "@/lib/providers/openai-image";
import { estimateImage, type ImageQuality, type ImageSize } from "@/lib/pricing";
import { addSpend, capReached } from "@/lib/budget";
import { idsFromBody, logger, startObservedRoute } from "@/infrastructure/observability";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt ?? "").trim();
  const size = (body.size ?? "1024x1024") as ImageSize;
  const quality = (body.quality ?? "medium") as ImageQuality;
  const ids = idsFromBody(body);

  const obs = startObservedRoute(req, {
    route: "/api/generate/image",
    operation: "generate.image",
    ...ids,
  });

  // Never log the prompt (redactor would mask it; we omit it entirely).
  if (!prompt) {
    logger.warn("route.client_error", obs.context, { status: 400, reason: "missing_prompt" });
    return obs.json({ error: "Prompt is required" }, { status: 400 });
  }

  const cap = await capReached();
  if (cap) {
    logger.warn("route.budget_cap", obs.context, {
      status: 402,
      total: cap.total,
      cap: cap.cap,
    });
    return obs.json(
      {
        error: `Plafond de budget atteint (${cap.total.toFixed(2)} $ / ${cap.cap.toFixed(2)} $). Réinitialise la dépense ou augmente BUDGET_CAP_USD.`,
      },
      { status: 402 },
    );
  }

  try {
    const result = await generateImage({ prompt, size, quality });
    const usd = estimateImage(size, quality, 1);
    await addSpend({
      type: "image",
      provider: "openai",
      model: "gpt-image-1",
      estimateUSD: usd,
      note: `${size} ${quality}`,
    });
    logger.info("route.success", obs.context, {
      status: 200,
      size,
      quality,
      estimateUSD: usd,
    });
    return obs.json({ ...result, estimateUSD: usd });
  } catch (e) {
    logger.error("route.failure", obs.context, e, { size, quality });
    return obs.json(
      { error: e instanceof Error ? e.message : "Generation failed" },
      { status: 500 },
    );
  }
}
