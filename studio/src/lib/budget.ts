import { hasSupabase, supabase } from "@/lib/supabase";

/**
 * Spend log backed by Supabase (table `vh_spend`). Records the estimated USD
 * cost of every generation so the UI can show a running total.
 *
 * All functions are resilient: a storage/network error never throws to the
 * caller (spend logging is secondary to the actual generation).
 */

export interface SpendEntry {
  id: string;
  ts: number;
  type: "image" | "voice" | "video";
  provider: string;
  model: string;
  estimateUSD: number;
  note?: string;
}

interface SpendRow {
  id: string;
  ts: string;
  type: string;
  provider: string;
  model: string;
  estimate_usd: number;
  note: string | null;
}

function rowToEntry(r: SpendRow): SpendEntry {
  return {
    id: r.id,
    ts: new Date(r.ts).getTime(),
    type: r.type as SpendEntry["type"],
    provider: r.provider,
    model: r.model,
    estimateUSD: Number(r.estimate_usd),
    note: r.note ?? undefined,
  };
}

export async function addSpend(entry: Omit<SpendEntry, "id" | "ts">): Promise<void> {
  if (!hasSupabase()) return;
  try {
    await supabase()
      .from("vh_spend")
      .insert({
        type: entry.type,
        provider: entry.provider,
        model: entry.model,
        estimate_usd: entry.estimateUSD,
        note: entry.note ?? null,
      });
  } catch (e) {
    console.error("addSpend failed:", e);
  }
}

export async function resetSpend(): Promise<void> {
  if (!hasSupabase()) return;
  try {
    // Delete every row (a non-matching filter deletes all).
    await supabase().from("vh_spend").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  } catch (e) {
    console.error("resetSpend failed:", e);
  }
}

export async function spendSummary() {
  if (!hasSupabase()) return { total: 0, byType: {}, count: 0, entries: [] as SpendEntry[] };
  try {
    const { data, error } = await supabase()
      .from("vh_spend")
      .select("id, ts, type, provider, model, estimate_usd, note")
      .order("ts", { ascending: false })
      .limit(500);
    if (error) throw error;
    const entries = (data as SpendRow[]).map(rowToEntry);
    const total = +entries.reduce((s, e) => s + e.estimateUSD, 0).toFixed(4);
    const byType = entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.type] = +((acc[e.type] ?? 0) + e.estimateUSD).toFixed(4);
      return acc;
    }, {});
    return { total, byType, count: entries.length, entries: entries.slice(0, 50) };
  } catch (e) {
    console.error("spendSummary failed:", e);
    return { total: 0, byType: {}, count: 0, entries: [] as SpendEntry[] };
  }
}
