import fs from "node:fs";
import path from "node:path";
import { CHARACTERS_ROOT, CHARACTER_NAME } from "@/lib/sdk";
import {
  CharacterNotFoundError,
  CharacterRuntimeError,
  DuplicateCharacterCodeError,
  DuplicateCharacterIdError,
  type ConflictingPackageRef,
} from "../errors";
import { CharacterPackageLoader, slugify } from "./loader";
import type {
  CharacterPackage,
  CharacterSummary,
  DataQualityIssue,
  RegistryConflict,
} from "./schema";

interface CacheEntry {
  pkg: CharacterPackage;
  signature: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: DataQualityIssue[];
  error?: { code: string; message: string };
}

interface LoadedEntry {
  directoryName: string;
  pkg: CharacterPackage;
}

interface RegistryIndex {
  loaded: LoadedEntry[];
  conflicts: RegistryConflict[];
}

function normId(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toRef(pkg: CharacterPackage): ConflictingPackageRef {
  return {
    directoryName: pkg.directoryName,
    version: pkg.characterVersion,
    characterId: pkg.characterId,
    characterCode: pkg.characterCode,
  };
}

/**
 * Central access point for character packages.
 *
 * Packages are loaded lazily and cached; the cache is invalidated when the
 * mtime signature of the character's key files changes on disk. The registry
 * enforces cross-package uniqueness of `characterId` and `characterCode`.
 */
export class CharacterRegistry {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly charactersRoot: string = CHARACTERS_ROOT,
    private readonly loader: CharacterPackageLoader = new CharacterPackageLoader(charactersRoot)
  ) {}

  /** Directory names of every character SDK on disk. */
  listDirectoryNames(): string[] {
    try {
      return fs
        .readdirSync(this.charactersRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
    } catch {
      return [];
    }
  }

  private signature(directoryName: string): string {
    const dir = path.join(this.charactersRoot, directoryName);
    const targets = [
      dir,
      path.join(dir, "memory", "00_IDENTITY.md"),
      path.join(dir, "02_PERSONALITY.md"),
      path.join(dir, "assets"),
      path.join(dir, "assets", "outfits"),
      path.join(dir, "voice", "config.json"),
    ];
    return targets
      .map((t) => {
        try {
          return `${t}:${fs.statSync(t).mtimeMs}`;
        } catch {
          return `${t}:0`;
        }
      })
      .join("|");
  }

  private getByDirectory(directoryName: string): CharacterPackage {
    const signature = this.signature(directoryName);
    const cached = this.cache.get(directoryName);
    if (cached && cached.signature === signature) return cached.pkg;
    const pkg = this.loader.load(directoryName);
    this.cache.set(directoryName, { pkg, signature });
    return pkg;
  }

  /** Load every package that can be loaded and compute uniqueness conflicts. */
  private buildIndex(): RegistryIndex {
    const loaded: LoadedEntry[] = [];
    for (const dir of this.listDirectoryNames()) {
      try {
        loaded.push({ directoryName: dir, pkg: this.getByDirectory(dir) });
      } catch {
        /* invalid packages surface separately via listSummaries */
      }
    }

    const conflicts: RegistryConflict[] = [];
    conflicts.push(
      ...groupConflicts(
        loaded,
        (e) => e.pkg.characterId,
        "characterId",
        "DUPLICATE_CHARACTER_ID"
      )
    );
    conflicts.push(
      ...groupConflicts(
        loaded,
        (e) => e.pkg.characterCode,
        "characterCode",
        "DUPLICATE_CHARACTER_CODE"
      )
    );
    return { loaded, conflicts };
  }

  /** All cross-package uniqueness conflicts currently on disk. */
  getConflicts(): RegistryConflict[] {
    return this.buildIndex().conflicts;
  }

  /**
   * Load a package by canonical characterId, directory name / slug, or business
   * characterCode. Throws a typed error rather than resolving an ambiguous id
   * to an arbitrary package.
   */
  getCharacter(requestedId: string): CharacterPackage {
    const dirs = this.listDirectoryNames();
    const req = requestedId.trim();

    // 1. Explicit, unambiguous directory-name or slug request.
    const directDir = dirs.find((d) => d === req || slugify(d) === slugify(req));
    if (directDir) return this.getByDirectory(directDir);

    // 2. Resolve by characterId / characterCode across loaded packages.
    const { loaded } = this.buildIndex();
    const wanted = normId(req);

    const byId = loaded.filter((e) => normId(e.pkg.characterId) === wanted);
    if (byId.length > 1) {
      throw new DuplicateCharacterIdError(byId[0].pkg.characterId, byId.map((e) => toRef(e.pkg)));
    }
    if (byId.length === 1) return byId[0].pkg;

    const byCode = loaded.filter(
      (e) => e.pkg.characterCode && normId(e.pkg.characterCode) === wanted
    );
    if (byCode.length > 1) {
      throw new DuplicateCharacterCodeError(
        byCode[0].pkg.characterCode as string,
        byCode.map((e) => toRef(e.pkg))
      );
    }
    if (byCode.length === 1) return byCode[0].pkg;

    throw new CharacterNotFoundError(requestedId, dirs);
  }

  /**
   * The configured active character package. Resolved by explicit directory
   * name (env `CHARACTER_DIR_NAME` or the first directory) so a duplicate
   * package can never silently become the active character.
   */
  getActiveCharacter(): CharacterPackage {
    const dirs = this.listDirectoryNames();
    const active = dirs.includes(CHARACTER_NAME) ? CHARACTER_NAME : dirs[0];
    if (!active) throw new CharacterNotFoundError("<active>", dirs);
    return this.getByDirectory(active);
  }

  /**
   * Summaries for every character, always renderable. Load failures and
   * uniqueness conflicts are reported inline so the diagnostic screen is never
   * blocked by a single bad package.
   */
  listSummaries(): CharacterSummary[] {
    const { conflicts } = this.buildIndex();
    const conflictsFor = (dir: string) =>
      conflicts.filter((c) => c.packages.some((p) => p.directoryName === dir));

    return this.listDirectoryNames().map((dir) => {
      const dirConflicts = conflictsFor(dir);
      try {
        const pkg = this.getByDirectory(dir);
        const health = countSeverities(pkg.dataQuality);
        health.errors += dirConflicts.length;
        return {
          characterId: pkg.characterId,
          characterCode: pkg.characterCode,
          directoryName: pkg.directoryName,
          displayName: pkg.displayName,
          sdkVersion: pkg.sdkVersion,
          status: pkg.status,
          health,
          conflicts: dirConflicts,
        };
      } catch (err) {
        return {
          characterId: slugify(dir),
          characterCode: null,
          directoryName: dir,
          displayName: dir.replace(/\s*SDK.*/i, "").trim() || dir,
          sdkVersion: null,
          status: err instanceof CharacterRuntimeError ? err.code : "LOAD_FAILED",
          health: { errors: 1 + dirConflicts.length, warnings: 0, infos: 0 },
          conflicts: dirConflicts,
        };
      }
    });
  }

  /** Validate a package without throwing on non-fatal issues. */
  validate(requestedId: string): ValidationResult {
    try {
      const pkg = this.getCharacter(requestedId);
      const fatal = pkg.dataQuality.some((i) => i.severity === "error");
      return { valid: !fatal, issues: pkg.dataQuality };
    } catch (err) {
      if (err instanceof CharacterRuntimeError) {
        return { valid: false, issues: [], error: { code: err.code, message: err.message } };
      }
      return { valid: false, issues: [], error: { code: "UNKNOWN", message: String(err) } };
    }
  }

  /** Clear the in-memory cache (mostly for tests). */
  clearCache(): void {
    this.cache.clear();
  }
}

function groupConflicts(
  loaded: LoadedEntry[],
  key: (e: LoadedEntry) => string | null,
  type: RegistryConflict["type"],
  code: RegistryConflict["code"]
): RegistryConflict[] {
  const groups = new Map<string, LoadedEntry[]>();
  for (const e of loaded) {
    const raw = key(e);
    if (!raw) continue;
    const k = normId(raw);
    const list = groups.get(k) ?? [];
    list.push(e);
    groups.set(k, list);
  }
  const out: RegistryConflict[] = [];
  for (const entries of groups.values()) {
    if (entries.length <= 1) continue;
    const raw = key(entries[0]) as string;
    out.push({ type, code, value: raw, packages: entries.map((e) => toRef(e.pkg)) });
  }
  return out;
}

function countSeverities(issues: DataQualityIssue[]): CharacterSummary["health"] {
  return {
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    infos: issues.filter((i) => i.severity === "info").length,
  };
}

/** Shared singleton registry for the app runtime. */
export const characterRegistry = new CharacterRegistry();
