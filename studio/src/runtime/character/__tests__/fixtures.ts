import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CharacterRegistry } from "../registry";

export interface FixturePackage {
  dir: string;
  characterId: string;
  characterCode: string;
  name?: string;
  version?: string;
}

function identityDoc(pkg: FixturePackage): string {
  return [
    "# Fixture SDK",
    "",
    "# Character Identity",
    "",
    "Character Name",
    "",
    pkg.name ?? pkg.dir,
    "",
    "Character ID",
    "",
    pkg.characterCode,
    "",
    "Character Version",
    "",
    pkg.version ?? "1.0.0",
    "",
    "Status",
    "",
    "Production",
    "",
  ].join("\n");
}

function personalityDoc(pkg: FixturePackage): string {
  return [
    "# 4. Core personality summary",
    "",
    "```yaml",
    `character_id: ${pkg.characterId}`,
    "personality_version: 1.0.0",
    "core_traits:",
    "  - warm",
    "communication_style:",
    "  - simple",
    "```",
    "",
    "# 83. Personality metadata",
    "",
    "```yaml",
    `character_id: ${pkg.characterId}`,
    "warmth_level: high",
    "language: fr",
    "form_of_address: vous",
    "```",
    "",
  ].join("\n");
}

/** Create a temporary characters root populated with the given packages. */
export function makeFixtureRoot(pkgs: FixturePackage[]): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vh-fixtures-"));
  for (const pkg of pkgs) {
    const base = path.join(root, pkg.dir);
    fs.mkdirSync(path.join(base, "memory"), { recursive: true });
    fs.writeFileSync(path.join(base, "memory", "00_IDENTITY.md"), identityDoc(pkg));
    fs.writeFileSync(path.join(base, "02_PERSONALITY.md"), personalityDoc(pkg));
  }
  return root;
}

/** Build a registry backed by a fresh fixture root. */
export function makeFixtureRegistry(pkgs: FixturePackage[]): {
  registry: CharacterRegistry;
  root: string;
  cleanup: () => void;
} {
  const root = makeFixtureRoot(pkgs);
  const registry = new CharacterRegistry(root);
  return {
    registry,
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}
