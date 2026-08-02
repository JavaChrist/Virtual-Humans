import { NextRequest } from "next/server";
import {
  estimateImage,
  estimateLipsync,
  estimateVideo,
  estimateVoice,
  type ImageQuality,
  type ImageSize,
} from "@/lib/pricing";
import { idsFromBody, logger, startObservedRoute } from "@/infrastructure/observability";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { type } = body as { type?: string };
  const ids = idsFromBody(body);

  const obs = startObservedRoute(req, {
    route: "/api/estimate",
    operation: "estimate.post",
    ...ids,
  });

  try {
    if (type === "image") {
      const usd = estimateImage(body.size as ImageSize, body.quality as ImageQuality, body.n ?? 1);
      logger.info("route.success", obs.context, { status: 200, type });
      return obs.json({ type, usd, currency: "USD" });
    }
    if (type === "voice") {
      const { credits, usd } = estimateVoice(Number(body.chars ?? 0));
      logger.info("route.success", obs.context, { status: 200, type });
      return obs.json({ type, usd, credits, currency: "USD" });
    }
    if (type === "video") {
      const usd = estimateVideo(String(body.model), Number(body.seconds ?? 0));
      logger.info("route.success", obs.context, { status: 200, type, model: String(body.model ?? "") });
      return obs.json({ type, usd, currency: "USD" });
    }
    if (type === "lipsync") {
      const usd = estimateLipsync(String(body.model), Number(body.seconds ?? 0));
      logger.info("route.success", obs.context, { status: 200, type });
      return obs.json({ type, usd, currency: "USD" });
    }
    logger.warn("route.client_error", obs.context, { status: 400, type: type ?? null });
    return obs.json({ error: "Unknown type" }, { status: 400 });
  } catch (e) {
    logger.error("route.failure", obs.context, e, { type: type ?? null });
    return obs.json(
      { error: e instanceof Error ? e.message : "Estimate failed" },
      { status: 500 },
    );
  }
}
