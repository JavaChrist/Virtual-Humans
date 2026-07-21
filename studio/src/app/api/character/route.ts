import { NextResponse } from "next/server";
import {
  getCharacterOverview,
  listBehaviors,
  listSystemPrompts,
  listTemplates,
  TEMPLATE_CATEGORIES,
} from "@/lib/sdk";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const overview = getCharacterOverview();
    const behaviors = listBehaviors();
    const system = listSystemPrompts();
    const templates = Object.fromEntries(
      TEMPLATE_CATEGORIES.map((c) => [c, listTemplates(c)]),
    );
    return NextResponse.json({ overview, behaviors, system, templates });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to read SDK" },
      { status: 500 },
    );
  }
}
