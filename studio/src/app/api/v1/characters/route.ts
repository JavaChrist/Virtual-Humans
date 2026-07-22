import { NextResponse } from "next/server";
import { characterRegistry } from "@/runtime/character";

export const dynamic = "force-dynamic";

export async function GET() {
  const characters = characterRegistry.listSummaries();
  const conflicts = characterRegistry.getConflicts();
  const activeId = safe(() => characterRegistry.getActiveCharacter().characterId);
  return NextResponse.json({ characters, conflicts, activeId });
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
