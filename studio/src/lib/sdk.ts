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

export const CHARACTER_NAME = process.env.CHARACTER_DIR_NAME ?? "Mei SDK v1.0.0";
export const CHARACTER_DIR = path.join(REPO_ROOT, "characters", CHARACTER_NAME);
const PROMPTS_DIR = path.join(CHARACTER_DIR, "prompts");

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

export function getCharacterOverview(): CharacterOverview {
  const versionFile = readText(path.join(REPO_ROOT, "SDK_VERSION"))?.trim();
  const docFiles = ["00_IDENTITY.md", "01_APPEARANCE.md", "02_PERSONALITY.md", "04_VOICE.md"];
  const documents = docFiles
    .map((file) => {
      const md = readText(path.join(CHARACTER_DIR, file));
      if (!md) return null;
      return { file, title: firstHeading(md), excerpt: excerpt(md) };
    })
    .filter(Boolean) as CharacterOverview["documents"];

  return {
    name: CHARACTER_NAME.replace(/\s*SDK.*/, ""),
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

export function listBehaviors(): BehaviorModule[] {
  const dir = path.join(PROMPTS_DIR, "behavior");
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

export function getBehavior(id: string): { prompt: string; rules: string } | null {
  const dir = path.join(PROMPTS_DIR, "behavior", id);
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

export function listTemplates(category: string): TemplateRef[] {
  const dir = path.join(PROMPTS_DIR, "templates", category);
  return listFiles(dir).map((file) => ({
    category,
    name: file.replace(/\.md$/, ""),
    file,
  }));
}

export function getTemplate(category: string, name: string): string | null {
  const safe = name.replace(/[^a-z0-9_-]/gi, "");
  return readText(path.join(PROMPTS_DIR, "templates", category, `${safe}.md`));
}

export function listSystemPrompts(): { file: string; title: string }[] {
  const dir = path.join(PROMPTS_DIR, "system");
  return listFiles(dir)
    .sort()
    .map((file) => ({ file, title: firstHeadingOrFile(path.join(dir, file), file) }));
}

function firstHeadingOrFile(p: string, fallback: string): string {
  const md = readText(p);
  return md ? firstHeading(md) : fallback;
}
