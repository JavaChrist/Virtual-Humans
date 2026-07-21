import fs from "node:fs";
import path from "node:path";

/**
 * Lightweight spend log persisted to disk. Records the estimated USD cost of
 * every generation so the UI can show a running total. On ephemeral hosts the
 * file simply resets; that is acceptable for a demo/estimation tool.
 */

const DATA_DIR = path.join(process.cwd(), ".data");
const SPEND_FILE = path.join(DATA_DIR, "spend.json");

export interface SpendEntry {
  id: string;
  ts: number;
  type: "image" | "voice" | "video";
  provider: string;
  model: string;
  estimateUSD: number;
  note?: string;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readSpend(): SpendEntry[] {
  try {
    return JSON.parse(fs.readFileSync(SPEND_FILE, "utf8")) as SpendEntry[];
  } catch {
    return [];
  }
}

export function addSpend(entry: Omit<SpendEntry, "id" | "ts">): SpendEntry {
  ensureDir();
  const full: SpendEntry = { ...entry, id: crypto.randomUUID(), ts: Date.now() };
  const all = readSpend();
  all.push(full);
  fs.writeFileSync(SPEND_FILE, JSON.stringify(all, null, 2), "utf8");
  return full;
}

export function resetSpend() {
  ensureDir();
  fs.writeFileSync(SPEND_FILE, "[]", "utf8");
}

export function spendSummary() {
  const entries = readSpend();
  const total = +entries.reduce((s, e) => s + e.estimateUSD, 0).toFixed(4);
  const byType = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = +((acc[e.type] ?? 0) + e.estimateUSD).toFixed(4);
    return acc;
  }, {});
  return { total, byType, count: entries.length, entries: entries.slice(-50).reverse() };
}
