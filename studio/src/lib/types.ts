export interface CharacterResponse {
  overview: {
    name: string;
    sdkVersion: string;
    documents: { file: string; title: string; excerpt: string }[];
  };
  behaviors: { id: string; name: string; priority?: number; status?: string }[];
  system: { file: string; title: string }[];
  templates: Record<string, { category: string; name: string; file: string }[]>;
}

export type Lang = "en" | "fr";

export interface TemplateResponse {
  category: string;
  name: string;
  markdown: string;
  blocks: Record<Lang, { prompt: string | null; variables: string[] }>;
}

export interface SettingsResponse {
  keys: { openai: boolean; elevenlabs: boolean; elevenlabsVoice: boolean; fal: boolean; supabase: boolean };
  sdk: { repoRoot: string; character: string };
  pricing: { elevenlabsUsdPer1kChars: number };
}
