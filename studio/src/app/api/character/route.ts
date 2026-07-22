import { NextRequest, NextResponse } from "next/server";
import {
  getCharacterOverview,
  listBehaviors,
  listSystemPrompts,
  listTemplates,
  TEMPLATE_CATEGORIES,
} from "@/lib/sdk";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const character = req.nextUrl.searchParams.get("character") ?? undefined;
  try {
    const overview = getCharacterOverview(character);
    const behaviors = listBehaviors(character);
    const system = listSystemPrompts(character);
    const templates = Object.fromEntries(
      TEMPLATE_CATEGORIES.map((c) => [c, listTemplates(c, character)]),
    );
    return NextResponse.json({ overview, behaviors, system, templates });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to read SDK" },
      { status: 500 },
    );
  }
}
