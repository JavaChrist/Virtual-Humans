import { NextResponse } from "next/server";
import { resetSpend, spendSummary } from "@/lib/budget";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await spendSummary());
}

export async function DELETE() {
  await resetSpend();
  return NextResponse.json(await spendSummary());
}
