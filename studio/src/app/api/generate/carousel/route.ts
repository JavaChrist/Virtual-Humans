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
    // Chaque capture est lue depuis Supabase puis uploadée sur fal (URL accessible).
    const framesPerImage = Math.max(FPS, Math.round((seconds * FPS) / product.screens.length));
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
    const usd = estimateCarousel(seconds);
    await addSpend({ type: "video", provider: "fal", model: CAROUSEL_MODEL_ID, estimateUSD: usd, note: `carrousel ${product.screens.length} captures` });
    return NextResponse.json({ requestId, model: CAROUSEL_MODEL_ID, estimateUSD: usd });
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
