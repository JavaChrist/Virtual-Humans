import { NextRequest, NextResponse } from "next/server";
import { getTemplate } from "@/lib/sdk";
import { extractPromptBlock, extractVariables, type Lang } from "@/lib/assemble";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") ?? "";
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const md = getTemplate(category, name);
  if (md === null) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  const blocks: Record<Lang, { prompt: string | null; variables: string[] }> = {
    en: { prompt: null, variables: [] },
    fr: { prompt: null, variables: [] },
  };
  for (const lang of ["en", "fr"] as Lang[]) {
    const prompt = extractPromptBlock(md, lang);
    blocks[lang] = { prompt, variables: prompt ? extractVariables(prompt) : [] };
  }
  return NextResponse.json({ category, name, markdown: md, blocks });
}
