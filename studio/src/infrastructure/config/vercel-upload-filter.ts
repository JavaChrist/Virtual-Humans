/**
 * Simulate Vercel upload exclusions from studio/.vercelignore.
 *
 * Vercel uses gitignore-compatible patterns relative to the Root Directory
 * (studio/). A bare `e2e` rule also matches `src/infrastructure/e2e/` and
 * broke production builds (Porte 5 / dpl_6xEp…).
 */

import ignore from "ignore";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

export const REQUIRED_RUNTIME_E2E_MODULES = [
  "src/infrastructure/e2e/e2e-capability-registry.ts",
  "src/infrastructure/e2e/e2e-text-director-gate.ts",
  "src/infrastructure/e2e/fake-director-analyzers.ts",
] as const;

export const REQUIRED_UPLOAD_CONFIG_FILES = [
  "next.config.ts",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "file-tracing.ts",
] as const;

/** Rules that must never appear — they collide with runtime e2e modules. */
export const FORBIDDEN_VERCELIGNORE_RULES = [
  "e2e",
  "e2e/",
  "**/e2e/**",
  "**/e2e",
  "src/infrastructure/e2e",
  "src/infrastructure/e2e/",
  "**/infrastructure/e2e/**",
] as const;

export type VercelUploadSimulation = {
  studioRoot: string;
  rules: string[];
  kept: string[];
  excluded: string[];
};

function normalizePosix(relativePath: string): string {
  return relativePath.split(sep).join("/");
}

function listFilesRecursive(root: string, base = root): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const abs = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(abs, base));
    } else if (entry.isFile()) {
      out.push(normalizePosix(relative(base, abs)));
    }
  }
  return out;
}

export function readVercelIgnoreRules(studioRoot: string): string[] {
  const file = join(studioRoot, ".vercelignore");
  if (!existsSync(file)) {
    throw new Error(`.vercelignore introuvable: ${file}`);
  }
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export function assertVercelIgnoreRulesSafe(rules: string[]): void {
  for (const rule of rules) {
    if ((FORBIDDEN_VERCELIGNORE_RULES as readonly string[]).includes(rule)) {
      throw new Error(
        `Règle .vercelignore interdite (collision runtime e2e): ${rule}`,
      );
    }
    // Bare segment without leading slash that equals "e2e"
    if (rule === "e2e" || /^e2e(\/|\*\*)/.test(rule)) {
      throw new Error(
        `Règle .vercelignore non ancrée trop large: ${rule} — utiliser /e2e/`,
      );
    }
  }
  if (!rules.includes("/e2e/")) {
    throw new Error("Règle ancrée /e2e/ manquante dans .vercelignore");
  }
}

export function simulateVercelUpload(studioRoot: string): VercelUploadSimulation {
  const root = resolve(studioRoot);
  const rules = readVercelIgnoreRules(root);
  assertVercelIgnoreRulesSafe(rules);

  const ig = ignore().add(rules);
  const all = listFilesRecursive(root).sort();
  const kept: string[] = [];
  const excluded: string[] = [];

  for (const rel of all) {
    // .vercelignore itself is uploaded; ignore package treats matching as ignored
    if (ig.ignores(rel)) {
      excluded.push(rel);
    } else {
      kept.push(rel);
    }
  }

  return { studioRoot: root, rules, kept, excluded };
}

export function assertRequiredUploadFilesKept(sim: VercelUploadSimulation): void {
  for (const rel of REQUIRED_RUNTIME_E2E_MODULES) {
    if (!sim.kept.includes(rel)) {
      throw new Error(`Module runtime e2e exclu de l'upload: ${rel}`);
    }
    if (sim.excluded.includes(rel)) {
      throw new Error(`Module runtime e2e marqué exclu: ${rel}`);
    }
  }
  for (const rel of REQUIRED_UPLOAD_CONFIG_FILES) {
    if (!existsSync(join(sim.studioRoot, rel))) continue;
    if (!sim.kept.includes(rel)) {
      throw new Error(`Fichier config exclu de l'upload: ${rel}`);
    }
  }
  // Playwright root suite must stay excluded
  const leakedPlaywright = sim.kept.filter(
    (p) => p === "e2e" || p.startsWith("e2e/"),
  );
  if (leakedPlaywright.length > 0) {
    throw new Error(
      `Suite Playwright racine non exclue: ${leakedPlaywright.slice(0, 5).join(", ")}`,
    );
  }
}

/**
 * Copy kept files into a dedicated temp staging directory.
 * Refuses to stage into the repo, studio/, or any parent of the repo.
 */
export function stageSimulatedUpload(sim: VercelUploadSimulation): {
  stagingRoot: string;
  fileCount: number;
} {
  const repoRoot = resolve(sim.studioRoot, "..");
  const studioAbs = resolve(sim.studioRoot);
  const stagingRoot = mkdtempSync(join(tmpdir(), "vh-vercel-upload-"));
  const absStaging = resolve(stagingRoot);
  const absTmp = resolve(tmpdir());

  const under = (child: string, parent: string) =>
    child === parent || child.startsWith(parent + sep);

  if (!under(absStaging, absTmp)) {
    rmSync(absStaging, { recursive: true, force: true });
    throw new Error(`Staging hors tmpdir: ${absStaging}`);
  }
  if (under(absStaging, repoRoot) || under(absStaging, studioAbs)) {
    rmSync(absStaging, { recursive: true, force: true });
    throw new Error(`Staging refuse sous le dépôt: ${absStaging}`);
  }

  let fileCount = 0;
  for (const rel of sim.kept) {
    const src = join(sim.studioRoot, rel);
    if (!existsSync(src) || !statSync(src).isFile()) continue;
    const dest = join(absStaging, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    fileCount += 1;
  }

  return { stagingRoot: absStaging, fileCount };
}

export function cleanupStaging(stagingRoot: string): void {
  const abs = resolve(stagingRoot);
  const absTmp = resolve(tmpdir());
  if (!abs.startsWith(absTmp + sep)) {
    throw new Error(`Refus de nettoyer hors tmpdir: ${abs}`);
  }
  if (!abs.includes(`${sep}vh-vercel-upload-`)) {
    throw new Error(`Refus de nettoyer staging non préfixé: ${abs}`);
  }
  rmSync(abs, { recursive: true, force: true });
}
