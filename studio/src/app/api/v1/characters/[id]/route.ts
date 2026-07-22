import { NextResponse } from "next/server";
import { characterRegistry } from "@/runtime/character";
import { characterDetailResponse } from "@/runtime/character/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { status, body } = characterDetailResponse(characterRegistry, id);
  if (status === 500) {
    console.error("[/api/v1/characters/:id] unexpected error for id", id);
  }
  return NextResponse.json(body, { status });
}
