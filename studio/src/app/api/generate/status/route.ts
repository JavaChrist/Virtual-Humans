import { NextRequest, NextResponse } from "next/server";
import { checkJob } from "@/lib/providers/fal";

export const dynamic = "force-dynamic";

/** Generic fal job status endpoint (used by video and lip-sync). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const model = String(body.model ?? "");
  const requestId = String(body.requestId ?? "");
  if (!model || !requestId) {
    return NextResponse.json({ error: "model and requestId are required" }, { status: 400 });
  }
  try {
    const status = await checkJob(model, requestId);
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Status check failed" },
      { status: 500 },
    );
  }
}
