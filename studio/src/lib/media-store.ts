"use client";

/**
 * Per-character client-side media memory (last generated reference image and
 * last generated video), namespaced by character id in localStorage.
 */

function key(characterId: string, name: string): string {
  return `vh:media:${characterId}:${name}`;
}

export function getLastRefImage(characterId: string): string | null {
  if (typeof window === "undefined" || !characterId) return null;
  return localStorage.getItem(key(characterId, "refImage"));
}

export function setLastRefImage(characterId: string, dataUrl: string): void {
  if (typeof window === "undefined" || !characterId) return;
  localStorage.setItem(key(characterId, "refImage"), dataUrl);
}

export interface LastVideo {
  url: string;
  seconds: number;
}

export function getLastVideo(characterId: string): LastVideo | null {
  if (typeof window === "undefined" || !characterId) return null;
  const url = localStorage.getItem(key(characterId, "lastVideo"));
  if (!url) return null;
  const seconds = Number(localStorage.getItem(key(characterId, "lastVideoSeconds")) ?? "8");
  return { url, seconds: Number.isFinite(seconds) ? seconds : 8 };
}

export function setLastVideo(characterId: string, url: string, seconds: number): void {
  if (typeof window === "undefined" || !characterId) return;
  localStorage.setItem(key(characterId, "lastVideo"), url);
  localStorage.setItem(key(characterId, "lastVideoSeconds"), String(seconds));
}
