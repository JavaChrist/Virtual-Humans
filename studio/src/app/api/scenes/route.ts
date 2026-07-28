import { NextRequest, NextResponse } from "next/server";
import { listScenes, saveScene, deleteScene } from "@/lib/scenes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const character = req.nextUrl.searchParams.get("character") ?? undefined;
  return NextResponse.json({ scenes: await listScenes(character || undefined) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const character = String(body.character ?? "").trim();
  const config = body.config && typeof body.config === "object" ? body.config : {};
  if (!name) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  if (!character) return NextResponse.json({ error: "Personnage requis" }, { status: 400 });
  try {
    const scene = await saveScene({ name, characterId: character, config });
    return NextResponse.json({ scene });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Échec" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const ok = await deleteScene(id);
  return NextResponse.json({ ok });
}
