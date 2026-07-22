import { NextResponse } from "next/server";
import { CHARACTER_NAME, listCharacters } from "@/lib/sdk";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ characters: listCharacters(), current: CHARACTER_NAME });
}
