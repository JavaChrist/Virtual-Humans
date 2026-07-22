"use client";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json as T;
}

/** Notify the nav badge that spend changed. */
export function refreshBudget() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("budget:refresh"));
}

export function usd(n: number | undefined | null): string {
  if (n == null) return "—";
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

/** Append the active character id to an API URL as a query param. */
export function withCharacter(url: string, characterId?: string): string {
  if (!characterId) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}character=${encodeURIComponent(characterId)}`;
}
