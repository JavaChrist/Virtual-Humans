import { NextRequest, NextResponse } from "next/server";
import { addProductScreens, deleteProduct, listProducts, saveProduct, type Product } from "@/lib/products";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ products: await listProducts() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Nom du produit requis" }, { status: 400 });
  try {
    const product = await saveProduct({
      id: body.id ? String(body.id) : undefined,
      name,
      pitch: body.pitch ? String(body.pitch) : undefined,
      color: body.color ? String(body.color) : undefined,
      url: body.url ? String(body.url) : undefined,
    });
    const screens: string[] = Array.isArray(body.screens) ? body.screens.map(String) : [];
    if (screens.length) await addProductScreens(product.id, screens);
    const fresh: Product = (await listProducts()).find((p) => p.id === product.id) ?? product;
    return NextResponse.json({ product: fresh });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Échec" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const ok = await deleteProduct(id);
  if (!ok) return NextResponse.json({ error: "Suppression impossible" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
