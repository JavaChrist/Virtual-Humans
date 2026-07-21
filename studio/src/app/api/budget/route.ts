import { NextResponse } from "next/server";
import { resetSpend, spendSummary } from "@/lib/budget";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(spendSummary());
}

export async function DELETE() {
  resetSpend();
  return NextResponse.json(spendSummary());
}
