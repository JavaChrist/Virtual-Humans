import { NextRequest, NextResponse } from "next/server";
import { listAssets } from "@/lib/sdk";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const character = req.nextUrl.searchParams.get("character") ?? undefined;
  try {
    return NextResponse.json({ assets: listAssets(character) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
