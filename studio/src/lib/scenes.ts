import { hasSupabase, supabase } from "@/lib/supabase";

/**
 * Scènes enregistrées (bibliothèque) — config complète d'une scène Studio Scène,
 * sauvegardée dans Supabase (table `vh_scenes`) pour être rechargée/supprimée,
 * et synchronisée entre appareils.
 */

export interface SavedScene {
  id: string;
  name: string;
  characterId: string;
  config: Record<string, unknown>;
  createdAt: number;
}

interface SceneRow {
  id: string;
  name: string;
  character_id: string;
  config: Record<string, unknown> | null;
  created_at: string;
}

function rowToScene(r: SceneRow): SavedScene {
  return {
    id: r.id,
    name: r.name,
    characterId: r.character_id,
    config: r.config ?? {},
    createdAt: new Date(r.created_at).getTime(),
  };
}

export async function listScenes(characterId?: string): Promise<SavedScene[]> {
  if (!hasSupabase()) return [];
  try {
    let q = supabase()
      .from("vh_scenes")
      .select("id, name, character_id, config, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (characterId) q = q.eq("character_id", characterId);
    const { data, error } = await q;
    if (error) throw error;
    return (data as SceneRow[]).map(rowToScene);
  } catch (e) {
    console.error("listScenes failed:", e);
    return [];
  }
}

export async function saveScene(input: {
  name: string;
  characterId: string;
  config: Record<string, unknown>;
}): Promise<SavedScene> {
  const { data, error } = await supabase()
    .from("vh_scenes")
    .insert({ name: input.name.trim() || "Scène", character_id: input.characterId, config: input.config })
    .select("id, name, character_id, config, created_at")
    .single();
  if (error) throw new Error(error.message);
  return rowToScene(data as SceneRow);
}

export async function deleteScene(id: string): Promise<boolean> {
  if (!hasSupabase() || !id) return false;
  try {
    const { error } = await supabase().from("vh_scenes").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}
