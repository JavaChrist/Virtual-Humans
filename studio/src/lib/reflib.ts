"use client";

export interface RefImage {
  id: string;
  label: string;
  dataUrl: string;
  createdAt: number;
}

const KEY = (characterId: string) => `vh:refLibrary:${characterId}`;

export function getRefLibrary(characterId: string): RefImage[] {
  if (typeof window === "undefined" || !characterId) return [];
  try {
    return JSON.parse(localStorage.getItem(KEY(characterId)) ?? "[]") as RefImage[];
  } catch {
    return [];
  }
}

function save(characterId: string, items: RefImage[]) {
  localStorage.setItem(KEY(characterId), JSON.stringify(items));
  window.dispatchEvent(new Event("reflib:refresh"));
}

export function addRefImage(characterId: string, dataUrl: string, label: string): RefImage {
  const item: RefImage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: label.trim() || "Référence",
    dataUrl,
    createdAt: Date.now(),
  };
  save(characterId, [item, ...getRefLibrary(characterId)]);
  return item;
}

export function removeRefImage(characterId: string, id: string) {
  save(characterId, getRefLibrary(characterId).filter((r) => r.id !== id));
}
