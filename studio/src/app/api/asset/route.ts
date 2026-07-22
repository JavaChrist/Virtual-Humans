import { NextRequest, NextResponse } from "next/server";
import { CHARACTER_NAME, readAsset } from "@/lib/sdk";

export const dynamic = "force-dynamic";

/** Serve a character asset image by relative path (under the character's assets/). */
export async function GET(req: NextRequest) {
  const character = req.nextUrl.searchParams.get("character") ?? CHARACTER_NAME;
  const relPath = req.nextUrl.searchParams.get("path") ?? "";
  const asset = readAsset(character, relPath);
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(asset.buffer), {
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
