export type Lang = "en" | "fr";

const PROMPT_HEADINGS: Record<Lang, string[]> = {
  en: ["### Prompt Template"],
  fr: ["### Modèle de prompt", "### Modele de prompt"],
};

const SECTION_MARKERS: Record<Lang, string> = {
  en: "## EN",
  fr: "## FR",
};

/**
 * Extract the fenced prompt block for a given language from a template markdown file.
 * Templates follow the frozen structure: `## EN` / `## FR`, each with a
 * `### Prompt Template` / `### Modèle de prompt` heading followed by a fenced block.
 */
export function extractPromptBlock(md: string, lang: Lang): string | null {
  const marker = SECTION_MARKERS[lang];
  const start = md.indexOf(marker);
  const section =
    start === -1
      ? md
      : md.slice(start + marker.length, findNextSection(md, start + marker.length));

  for (const heading of PROMPT_HEADINGS[lang]) {
    const hIndex = section.indexOf(heading);
    if (hIndex === -1) continue;
    const after = section.slice(hIndex + heading.length);
    const fence = after.match(/```[a-zA-Z]*\r?\n([\s\S]*?)```/);
    if (fence) return fence[1].trim();
  }
  return null;
}

function findNextSection(md: string, from: number): number {
  const next = md.slice(from).search(/\r?\n## /);
  return next === -1 ? md.length : from + next;
}

/** Return the unique `{{variable}}` tokens found in the text. */
export function extractVariables(text: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) set.add(m[1]);
  return [...set];
}

/** Replace `{{variable}}` tokens using the provided values. */
export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const v = values[key];
    return v && v.trim() !== "" ? v : `{{${key}}}`;
  });
}

/**
 * Identity-preservation clause appended to visual prompts so the generated
 * media stays consistent with the character (mirrors the SDK video rules).
 */
export function identityClause(characterName: string, lang: Lang): string {
  return lang === "fr"
    ? `Préserver l'identité exacte de ${characterName} : visage, coiffure, proportions, teint, tenue et accessoires. Mouvement humain naturel, aucune déformation.`
    : `Preserve ${characterName}'s exact identity: face, hairstyle, proportions, skin tone, outfit and accessories. Natural human motion, no distortion.`;
}
