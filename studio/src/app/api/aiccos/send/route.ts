import { NextRequest, NextResponse } from "next/server";
import {
  createProductionAiccosPipeline,
  mapPipelineResultToHistoricalHttp,
  parseHistoricalAiccosBody,
  isAiccosPipelineError,
} from "@/infrastructure/export/aiccos";
import { generateCorrelationId } from "@/infrastructure/observability";

export const dynamic = "force-dynamic";
// Téléchargement + upload d'un clip (jusqu'à 50 Mo) : on laisse du temps.
export const maxDuration = 120;

/**
 * Envoi d'un clip généré vers AI Command Center OS (Médiathèque).
 *
 * Pipeline partagé VHS-111C (download → import → PUT → complete).
 * Contrat HTTP historique inchangé.
 */

export async function POST(req: NextRequest) {
  if (!process.env.AICCOS_IMPORT_TOKEN) {
    return NextResponse.json(
      { error: "AICCOS_IMPORT_TOKEN manquant dans .env.local — impossible d'envoyer vers AICCOS." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  let request;
  try {
    request = parseHistoricalAiccosBody((body ?? {}) as {
      videoUrl?: unknown;
      title?: unknown;
      productSlug?: unknown;
    });
  } catch (e) {
    if (isAiccosPipelineError(e)) {
      return NextResponse.json(
        { error: e.publicMessage },
        { status: e.httpStatusHint ?? 400 },
      );
    }
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const pipeline = createProductionAiccosPipeline();
  const result = await pipeline.send(request, {
    correlationId: generateCorrelationId(),
    timeoutMs: 110_000,
    requestedAt: new Date().toISOString(),
    signal: req.signal,
  });

  const http = mapPipelineResultToHistoricalHttp(result);
  return NextResponse.json(http.body, { status: http.status });
}
