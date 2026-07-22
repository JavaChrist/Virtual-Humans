"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiGet } from "@/lib/client";

export interface CharacterInfo {
  id: string; // folder name, e.g. "Mei SDK v1.0.0"
  name: string; // display name, e.g. "Mei"
}

interface CharacterContextValue {
  characters: CharacterInfo[];
  characterId: string;
  characterName: string;
  setCharacterId: (id: string) => void;
  ready: boolean;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);
const STORAGE_KEY = "vh:character";

export function CharacterProvider({ children }: { children: React.ReactNode }) {
  const [characters, setCharacters] = useState<CharacterInfo[]>([]);
  const [characterId, setCharacterIdState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    apiGet<{ characters: CharacterInfo[]; current: string }>("/api/characters")
      .then((d) => {
        setCharacters(d.characters);
        const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        const valid =
          stored && d.characters.some((c) => c.id === stored)
            ? stored
            : d.current || d.characters[0]?.id || "";
        setCharacterIdState(valid);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setCharacterId = useCallback((id: string) => {
    setCharacterIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
      window.dispatchEvent(new Event("vh:character-change"));
    }
  }, []);

  const characterName = characters.find((c) => c.id === characterId)?.name ?? "";

  return (
    <CharacterContext.Provider
      value={{ characters, characterId, characterName, setCharacterId, ready }}
    >
      {children}
    </CharacterContext.Provider>
  );
}

export function useCharacter(): CharacterContextValue {
  const ctx = useContext(CharacterContext);
  if (!ctx) throw new Error("useCharacter must be used within CharacterProvider");
  return ctx;
}
