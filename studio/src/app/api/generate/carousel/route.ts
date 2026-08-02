import { NextRequest, NextResponse } from "next/server";
import { submitJob, uploadBuffer, extractFalError } from "@/lib/providers/fal";
import { listProducts, readProductScreen } from "@/lib/products";
import { CAROUSEL_MODEL_ID, estimateCarousel } from "@/lib/pricing";
import { addSpend, capReached } from "@/lib/budget";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const FPS = 30;

/**
 * Diaporama vidéo (MP4) à partir des VRAIES captures d'un produit.
 * Body: { product, seconds }
 * Chaque capture est tenue (seconds / n) secondes. Sortie compatible avec
 * l'assemblage (même endpoint /status : le job renvoie { video: { url } }).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const productId = String(body.product ?? "");
  const seconds = Math.max(2, Number(body.seconds ?? 6));
  // Temps d'affichage par image (prioritaire si fourni). Sinon on répartit `seconds`.
  const secondsPerImage = Number(body.secondsPerImage ?? 0);

  if (!productId) return NextResponse.json({ error: "Produit requis" }, { status: 400 });

  const products = await listProducts();
  const product = products.find((p) => p.id === productId);
  if (!product || product.screens.length === 0) {
    return NextResponse.json(
      { error: "Ce produit n'a aucune capture d'écran. Ajoute des captures dans Produits / Apps." },
      { status: 400 },
    );
  }

  const cap = await capReached();
  if (cap)
    return NextResponse.json(
      { error: `Plafond de budget atteint (${cap.total.toFixed(2)} $ / ${cap.cap.toFixed(2)} $).` },
      { status: 402 },
    );

  try {
    // Nombre de frames par image : soit le temps/image demandé, soit la répartition de `seconds`.
    const framesPerImage =
      secondsPerImage > 0
        ? Math.max(Math.round(FPS / 2), Math.round(secondsPerImage * FPS))
        : Math.max(FPS, Math.round((seconds * FPS) / product.screens.length));
    const totalSeconds =
      secondsPerImage > 0 ? +(secondsPerImage * product.screens.length).toFixed(1) : seconds;
    // Chaque capture est lue depuis Supabase puis uploadée sur fal (URL accessible).
    const images: { url: string; frames: number }[] = [];
    for (const name of product.screens) {
      const screen = await readProductScreen(productId, name);
      if (!screen) continue;
      const url = await uploadBuffer(screen.buffer, screen.mime, "screen");
      images.push({ url, frames: framesPerImage });
    }
    if (images.length === 0) {
      return NextResponse.json({ error: "Impossible de lire les captures du produit" }, { status: 400 });
    }

    const requestId = await submitJob(CAROUSEL_MODEL_ID, { images, fps: FPS });
    const usd = estimateCarousel(totalSeconds);
    const durationSeconds = +(images.length * (framesPerImage / FPS)).toFixed(2);
    await addSpend({ type: "video", provider: "fal", model: CAROUSEL_MODEL_ID, estimateUSD: usd, note: `carrousel ${product.screens.length} captures` });
    return NextResponse.json({
      requestId,
      model: CAROUSEL_MODEL_ID,
      estimateUSD: usd,
      // Durée réelle du diaporama (pour coller la voix off et l'assemblage).
      durationSeconds,
    });
  } catch (e) {
    const detail = extractFalError(e);
    console.error("[carousel] échec", { productId, detail });
    if (/exhausted balance|user is locked|top up/i.test(detail)) {
      return NextResponse.json(
        { error: "Solde fal.ai épuisé — recharge ton compte sur fal.ai/dashboard/billing." },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: detail || "Génération du carrousel échouée" }, { status: 500 });
  }
}
