/**
 * Non-destructive freshness check for the living handover.
 * No provider, no Production write, no network required.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

export const MARKER_START = "<!-- CURRENT_STATE_MARKERS";
export const MARKER_END = "-->";

export const REQUIRED_MARKERS = [
  "verifiedAt",
  "documentedHead",
  "headStatus",
  "lastPhaseReport",
  "nextPhase",
  "budgetHard",
  "budgetCommitted",
  "budgetReserved",
  "budgetAvailable",
  "runtimePaidMedia",
  "unitTests",
  "globalStatus",
];

export const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{12,}/,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
  /data:image\//i,
  /[?&]token=[A-Za-z0-9._~-]{12,}/i,
  /X-Amz-Signature=/i,
  /postgres(?:ql)?:\/\//i,
  /OPENAI_API_KEY\s*=\s*\S+/,
  /SERVICE_ROLE_KEY\s*=\s*\S+/i,
];

export function parseCurrentStateMarkers(text) {
  const start = text.indexOf(MARKER_START);
  if (start < 0) {
    throw new Error("CURRENT_STATE_MARKERS block missing");
  }
  const end = text.indexOf(MARKER_END, start);
  if (end < 0) {
    throw new Error("CURRENT_STATE_MARKERS block unclosed");
  }
  const block = text.slice(start + MARKER_START.length, end);
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of block.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

export function findSecretHits(text) {
  return SECRET_PATTERNS.filter((re) => re.test(text)).map((re) => re.source);
}

function shaMatches(documented, gitSha) {
  if (!documented || !gitSha) return false;
  const a = documented.toLowerCase();
  const b = gitSha.toLowerCase();
  return b.startsWith(a) || a.startsWith(b.slice(0, 7));
}

/**
 * @param {{
 *   markdown: string,
 *   repoRoot: string,
 *   gitHead?: string,
 *   gitParent?: string,
 *   readme?: string,
 * }} input
 */
export function evaluateFreshness(input) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  let markers = {};
  try {
    markers = parseCurrentStateMarkers(input.markdown);
  } catch (err) {
    return {
      ok: false,
      errors: [err instanceof Error ? err.message : String(err)],
      warnings,
      markers,
    };
  }

  for (const key of REQUIRED_MARKERS) {
    if (!markers[key]) errors.push(`marker missing or empty: ${key}`);
  }

  if (markers.verifiedAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(markers.verifiedAt)) {
    errors.push("verifiedAt must be ISO-8601 with time");
  }
  if (markers.nextPhase && markers.nextPhase.length < 8) {
    errors.push("nextPhase is too short");
  }
  if (markers.lastPhaseReport) {
    const reportPath = join(
      input.repoRoot,
      "docs",
      "Developer-Handover",
      markers.lastPhaseReport,
    );
    if (!existsSync(reportPath)) {
      errors.push(`lastPhaseReport missing: ${markers.lastPhaseReport}`);
    }
  }
  if (input.readme && !input.readme.includes("CURRENT_STATE_AND_RESUME.md")) {
    errors.push("00_README.md does not index CURRENT_STATE_AND_RESUME.md");
  }

  const secretHits = findSecretHits(input.markdown);
  if (secretHits.length) {
    errors.push(`secret-like pattern: ${secretHits.join(", ")}`);
  }

  const status = (markers.headStatus || "").toLowerCase();
  const docHead = markers.documentedHead || "";
  if (status === "synced") {
    if (input.gitHead && !shaMatches(docHead, input.gitHead)) {
      errors.push(
        `documentedHead ${docHead} != git HEAD ${input.gitHead.slice(0, 7)}`,
      );
    }
  } else if (status === "pending commit") {
    const matchesHead = Boolean(input.gitHead && shaMatches(docHead, input.gitHead));
    const matchesParent = Boolean(input.gitParent && shaMatches(docHead, input.gitParent));
    if (docHead && !matchesHead && !matchesParent) {
      errors.push(
        `pending commit: documentedHead must be HEAD or HEAD^ (got ${docHead})`,
      );
    }
  } else if (markers.headStatus) {
    errors.push('headStatus must be "synced" or "pending commit"');
  }

  for (const key of [
    "budgetHard",
    "budgetCommitted",
    "budgetReserved",
    "budgetAvailable",
  ]) {
    if (markers[key] && !/^\d+$/.test(markers[key])) {
      errors.push(`${key} must be an integer (USD cents)`);
    }
  }
  if (markers.runtimePaidMedia && !/^(OFF|ON)$/i.test(markers.runtimePaidMedia)) {
    errors.push("runtimePaidMedia must be OFF or ON");
  }
  if (markers.unitTests && !/^\d+\/\d+$/.test(markers.unitTests)) {
    errors.push("unitTests must look like 1572/1572");
  }

  return { ok: errors.length === 0, errors, warnings, markers };
}

export function findRepoRoot(startDir) {
  let dir = resolve(startDir);
  for (let i = 0; i < 8; i += 1) {
    if (
      existsSync(join(dir, "docs", "Developer-Handover", "CURRENT_STATE_AND_RESUME.md"))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("CURRENT_STATE_AND_RESUME.md not found from script cwd");
}

function gitSha(repoRoot, rev) {
  try {
    return execSync(`git rev-parse ${rev}`, {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

export function runFreshnessCheck(repoRoot = findRepoRoot(process.cwd())) {
  const livingPath = join(
    repoRoot,
    "docs",
    "Developer-Handover",
    "CURRENT_STATE_AND_RESUME.md",
  );
  const readmePath = join(repoRoot, "docs", "Developer-Handover", "00_README.md");
  if (!existsSync(livingPath)) {
    return {
      ok: false,
      errors: ["living handover file missing"],
      warnings: [],
      markers: {},
    };
  }
  const markdown = readFileSync(livingPath, "utf8");
  const readme = existsSync(readmePath) ? readFileSync(readmePath, "utf8") : "";
  return evaluateFreshness({
    markdown,
    repoRoot,
    gitHead: gitSha(repoRoot, "HEAD"),
    gitParent: gitSha(repoRoot, "HEAD~1"),
    readme,
  });
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const result = runFreshnessCheck();
  const payload = {
    ok: result.ok,
    errors: result.errors,
    warnings: result.warnings,
    documentedHead: result.markers.documentedHead ?? null,
    headStatus: result.markers.headStatus ?? null,
    nextPhase: result.markers.nextPhase ?? null,
  };
  console.log(JSON.stringify(payload, null, 2));
  if (!result.ok) process.exit(1);
}
