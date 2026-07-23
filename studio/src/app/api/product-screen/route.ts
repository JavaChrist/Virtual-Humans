import { NextRequest, NextResponse } from "next/server";
import { deleteProductScreen, readProductScreen } from "@/lib/products";

export const dynamic = "force-dynamic";

/** Serve a product screenshot by product id + file name. */
export async function GET(req: NextRequest) {
  const product = req.nextUrl.searchParams.get("product") ?? "";
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const screen = await readProductScreen(product, name);
  if (!screen) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(screen.buffer), {
    headers: { "Content-Type": screen.mime, "Cache-Control": "public, max-age=3600" },
  });
}

/** Delete a single product screenshot by product id + file name. */
export async function DELETE(req: NextRequest) {
  const product = req.nextUrl.searchParams.get("product") ?? "";
  const name = req.nextUrl.searchParams.get("name") ?? "";
  if (!product || !name) {
    return NextResponse.json({ error: "product et name requis" }, { status: 400 });
  }
  const ok = await deleteProductScreen(product, name);
  if (!ok) return NextResponse.json({ error: "Capture introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
