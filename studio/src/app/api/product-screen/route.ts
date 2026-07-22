import { NextRequest, NextResponse } from "next/server";
import { readProductScreen } from "@/lib/sdk";

export const dynamic = "force-dynamic";

/** Serve a product screenshot by product id + file name. */
export async function GET(req: NextRequest) {
  const product = req.nextUrl.searchParams.get("product") ?? "";
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const screen = readProductScreen(product, name);
  if (!screen) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(screen.buffer), {
    headers: { "Content-Type": screen.mime, "Cache-Control": "public, max-age=3600" },
  });
}
