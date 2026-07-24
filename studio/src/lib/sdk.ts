import fs from "node:fs";
import path from "node:path";

/**
 * Root of the Virtual Humans SDK repository.
 * By default the studio app lives in `<repo>/studio`, so the SDK is one level up.
 * Override with the SDK_ROOT environment variable when deploying.
 */
export const REPO_ROOT = process.env.SDK_ROOT
  ? path.resolve(process.env.SDK_ROOT)
  : path.resolve(process.cwd(), "..");

export const CHARACTERS_ROOT = path.join(REPO_ROOT, "characters");
export const CHARACTER_NAME = process.env.CHARACTER_DIR_NAME ?? "Mei SDK v1.0.0";
export const CHARACTER_DIR = path.join(REPO_ROOT, "characters", CHARACTER_NAME);

/** Directory of a character SDK (defaults to the configured one). */
function charDir(character?: string): string {
  return resolveCharacterDir(character);
}

/** Prompts directory of a character SDK. */
function promptsDir(character?: string): string {
  return path.join(resolveCharacterDir(character), "prompts");
}

/** Display name for a character folder ("Mei SDK v1.0.0" -> "Mei"). */
function displayName(character?: string): string {
  return (character && character.trim() ? character : CHARACTER_NAME).replace(/\s*SDK.*/, "");
}

function readText(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function listDirs(p: string): string[] {
  try {
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

function listFiles(p: string, ext = ".md"): string[] {
  try {
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith(ext))
      .map((d) => d.name);
  } catch {
    return [];
  }
}

export interface CharacterOverview {
  name: string;
  sdkVersion: string;
  documents: { file: string; title: string; excerpt: string }[];
}

function firstHeading(md: string): string {
  const line = md.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  return line.replace(/^#+\s*/, "").trim();
}

function excerpt(md: string, max = 600): string {
  const body = md
    .split(/\r?\n/)
    .filter((l) => !/^#{1,6}\s/.test(l) && l.trim() !== "" && l.trim() !== "---")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return body.length > max ? body.slice(0, max) + "…" : body;
}

export function getCharacterOverview(character?: string): CharacterOverview {
  const versionFile = readText(path.join(REPO_ROOT, "SDK_VERSION"))?.trim();
  const docFiles = ["00_IDENTITY.md", "01_APPEARANCE.md", "02_PERSONALITY.md", "04_VOICE.md"];
  const dir = charDir(character);
  const documents = docFiles
    .map((file) => {
      const md = readText(path.join(dir, file));
      if (!md) return null;
      return { file, title: firstHeading(md), excerpt: excerpt(md) };
    })
    .filter(Boolean) as CharacterOverview["documents"];

  return {
    name: displayName(character),
    sdkVersion: versionFile ?? "unknown",
    documents,
  };
}

export interface BehaviorModule {
  id: string;
  name: string;
  priority?: number;
  status?: string;
}

export function listBehaviors(character?: string): BehaviorModule[] {
  const dir = path.join(promptsDir(character), "behavior");
  const modules: BehaviorModule[] = [];
  for (const name of listDirs(dir)) {
    const manifestRaw = readText(path.join(dir, name, "manifest.json"));
    let name_ = name;
    let priority: number | undefined;
    let status: string | undefined;
    if (manifestRaw) {
      try {
        const m = JSON.parse(manifestRaw);
        name_ = m.name ?? name;
        priority = m.priority;
        status = m.status;
      } catch {
        /* ignore malformed manifest */
      }
    }
    modules.push({ id: name, name: name_, priority, status });
  }
  return modules.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99) || a.name.localeCompare(b.name));
}

export function getBehavior(id: string, character?: string): { prompt: string; rules: string } | null {
  const dir = path.join(promptsDir(character), "behavior", id);
  const prompt = readText(path.join(dir, "prompt.md"));
  if (prompt === null) return null;
  return { prompt, rules: readText(path.join(dir, "rules.md")) ?? "" };
}

export interface TemplateRef {
  category: string;
  name: string;
  file: string;
}

export const TEMPLATE_CATEGORIES = ["video", "image", "social", "marketing", "documentation", "sales"] as const;

export function listTemplates(category: string, character?: string): TemplateRef[] {
  const dir = path.join(promptsDir(character), "templates", category);
  return listFiles(dir).map((file) => ({
    category,
    name: file.replace(/\.md$/, ""),
    file,
  }));
}

export function getTemplate(category: string, name: string, character?: string): string | null {
  const safe = name.replace(/[^a-z0-9_-]/gi, "");
  const cat = category.replace(/[^a-z0-9_-]/gi, "");
  return readText(path.join(promptsDir(character), "templates", cat, `${safe}.md`));
}

export function listSystemPrompts(character?: string): { file: string; title: string }[] {
  const dir = path.join(promptsDir(character), "system");
  return listFiles(dir)
    .sort()
    .map((file) => ({ file, title: firstHeadingOrFile(path.join(dir, file), file) }));
}

function firstHeadingOrFile(p: string, fallback: string): string {
  const md = readText(p);
  return md ? firstHeading(md) : fallback;
}

// ---------------------------------------------------------------------------
// Characters & assets (a character SDK = a complete virtual person)
// ---------------------------------------------------------------------------

/** List available character SDKs under characters/. */
export function listCharacters(): { id: string; name: string }[] {
  return listDirs(CHARACTERS_ROOT).map((id) => ({ id, name: id.replace(/\s*SDK.*/, "") }));
}

/** Resolve a character directory safely (defaults to the configured one). */
function resolveCharacterDir(character?: string): string {
  const id = character && character.trim() ? character : CHARACTER_NAME;
  const dir = path.resolve(CHARACTERS_ROOT, id);
  if (dir !== CHARACTERS_ROOT && !dir.startsWith(CHARACTERS_ROOT + path.sep)) {
    throw new Error("Invalid character");
  }
  return dir;
}

export const ASSET_CATEGORIES = ["identity", "expressions", "poses", "outfits"] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export interface AssetItem {
  category: AssetCategory;
  name: string; // human label
  relPath: string; // relative to the character's assets/ dir, POSIX separators
}

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function walkImages(dir: string, base: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...walkImages(full, base));
    } else if (IMAGE_EXT.has(path.extname(e.name).toLowerCase())) {
      out.push(path.relative(base, full).split(path.sep).join("/"));
    }
  }
  return out;
}

/** List image assets of a character grouped by category. */
export function listAssets(character?: string): Record<AssetCategory, AssetItem[]> {
  const assetsDir = path.join(resolveCharacterDir(character), "assets");
  const result = {} as Record<AssetCategory, AssetItem[]>;
  for (const category of ASSET_CATEGORIES) {
    const catDir = path.join(assetsDir, category);
    const rels = walkImages(catDir, assetsDir);
    result[category] = rels
      // For outfits, hide raw look.png duplicates in favor of everything; keep all but label nicely.
      .map((relPath) => ({
        category,
        relPath,
        name: relPath.replace(/^[^/]+\//, "").replace(/\.[a-z]+$/i, "").replace(/_/g, " "),
      }))
      .sort((a, b) => a.relPath.localeCompare(b.relPath));
  }
  return result;
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

// ---------------------------------------------------------------------------
// Outfits (structured, from assets/outfits/LOOK_*/look.json)
// ---------------------------------------------------------------------------

export interface Outfit {
  id: string; // e.g. LOOK_001
  name: string;
  description?: string;
  clothing?: Record<string, string>;
  style?: string[];
  locations?: string[];
  bestFor?: string[];
  lookPath: string; // relative to assets/, used as identity/outfit reference
  thumbPath: string; // relative to assets/, used for display
}

export function listOutfits(character?: string): Outfit[] {
  const outfitsDir = path.join(resolveCharacterDir(character), "assets", "outfits");
  const out: Outfit[] = [];
  for (const id of listDirs(outfitsDir)) {
    const jsonRaw = readText(path.join(outfitsDir, id, "look.json"));
    let meta: Record<string, unknown> = {};
    if (jsonRaw) {
      try {
        meta = JSON.parse(jsonRaw) as Record<string, unknown>;
      } catch {
        /* ignore malformed look.json */
      }
    }
    const hasLook = fs.existsSync(path.join(outfitsDir, id, "look.png"));
    const hasThumb = fs.existsSync(path.join(outfitsDir, id, "thumbnail.png"));
    if (!hasLook && !hasThumb) continue;
    const lookRel = hasLook ? `outfits/${id}/look.png` : `outfits/${id}/thumbnail.png`;
    const thumbRel = hasThumb ? `outfits/${id}/thumbnail.png` : lookRel;
    out.push({
      id,
      name: (meta.name as string) ?? id,
      description: meta.description as string | undefined,
      clothing: meta.clothing as Record<string, string> | undefined,
      style: meta.style as string[] | undefined,
      locations: meta.locations as string[] | undefined,
      bestFor: meta.best_for as string[] | undefined,
      lookPath: lookRel,
      thumbPath: thumbRel,
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

// Products (apps to promote) moved to `@/lib/products` (Supabase-backed).

export interface VoiceConfig {
  provider?: string;
  model?: string;
  voiceId?: string;
  voiceName?: string;
  language?: string;
  stability?: number | null;
  similarityBoost?: number | null;
  style?: number | null;
  speakerBoost?: boolean | null;
  speed?: number | null;
}

/**
 * Read a character's voice configuration from `voice/config.json`.
 * Returns null when the file is missing or malformed (callers fall back to env).
 */
export function getVoiceConfig(character?: string): VoiceConfig | null {
  const p = path.join(resolveCharacterDir(character), "voice", "config.json");
  const raw = readText(p);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VoiceConfig;
  } catch {
    return null;
  }
}

/** Read an asset file safely. relPath is relative to the character's assets/ dir. */
export function readAsset(character: string, relPath: string): { buffer: Buffer; mime: string } | null {
  const assetsDir = path.join(resolveCharacterDir(character), "assets");
  const full = path.resolve(assetsDir, relPath);
  if (!full.startsWith(assetsDir + path.sep)) return null; // path traversal guard
  const ext = path.extname(full).toLowerCase();
  if (!IMAGE_EXT.has(ext)) return null;
  try {
    return { buffer: fs.readFileSync(full), mime: MIME[ext] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}
