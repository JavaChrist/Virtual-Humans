#!/usr/bin/env node
/** Read-only compositor diagnostic for the new provider PNG. No upload, no second submit. */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const TITLE = "De l\u2019idée à la structure";
const CTA = "Découvrir Virtual Humans Studio";

function loadEnvFile(path) {
  const map = {};
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    map[m[1]] = v;
  }
  return map;
}

const remote = loadEnvFile(resolve(studioRoot, ".env.remote.local"));
const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: assets, error } = await db
  .from("assets")
  .select("id,storage_path,checksum,width,height,size_bytes")
  .eq("project_id", PROJECT_ID)
  .eq("kind", "image");
if (error) throw new Error(error.message);
const asset = (assets || []).find((a) => String(a.id).startsWith("7832765d"));
if (!asset) throw new Error("provider asset missing");
const { data: file, error: dlErr } = await db.storage
  .from("director-final-assets")
  .download(asset.storage_path);
if (dlErr || !file) throw new Error(dlErr?.message || "download failed");
const buf = new Uint8Array(await file.arrayBuffer());
const colorType = buf[25];
const bitDepth = buf[24];
const pngSig = [0x89, 0x50, 0x4e, 0x47].every((b, i) => buf[i] === b);

const overlayMod = await import(
  pathToFileURL(join(studioRoot, "src/domain/production/image-text-overlay.ts")).href
);
const composeMod = await import(
  pathToFileURL(
    join(studioRoot, "src/application/production/phase-11a-deterministic-compositor.ts"),
  ).href
);
const spec = overlayMod.createDefaultPhase11AOverlaySpec({
  locale: "fr",
  title: TITLE,
  callToAction: CTA,
});
let composeError = null;
try {
  composeMod.composePhase11ADeterministicOverlay({ providerPng: buf, spec });
} catch (e) {
  composeError = String(e.message || e).slice(0, 180);
}

const out = {
  providerPrefix: String(asset.id).slice(0, 8),
  checksumPrefix: String(asset.checksum).slice(0, 16),
  sizeBytes: buf.byteLength,
  pngSignature: pngSig,
  bitDepth,
  colorType,
  colorTypeName:
    { 0: "gray", 2: "rgb", 3: "indexed", 4: "gray-alpha", 6: "rgba" }[colorType] || "unknown",
  composeError,
  wroteStorage: false,
  providerCalled: false,
};
if (/sk-|data:image\/|base64,/.test(JSON.stringify(out))) throw new Error("leak");
mkdirSync(join(studioRoot, ".tmp"), { recursive: true });
writeFileSync(
  join(studioRoot, ".tmp", "phase-11a-text-free-paid-compositor-diag.json"),
  `${JSON.stringify(out, null, 2)}\n`,
);
console.log(JSON.stringify(out, null, 2));
