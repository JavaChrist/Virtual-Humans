import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Génère toutes les tailles d'icônes à partir d'une icône maître carrée "plein cadre".
// Usage : node scripts/make-icons.mjs
const __dirname = dirname(fileURLToPath(import.meta.url));
const PUB = join(__dirname, "..", "public");
const MASTER = join(PUB, "icons", "icon-master.png");
const BG = "#0b0d12"; // fond de marque (opaque)

async function square(size) {
  return sharp(MASTER).resize(size, size, { fit: "cover" }).png().toBuffer();
}

// Maskable : le contenu important doit tenir dans la zone centrale ~80%.
async function maskable(size) {
  const inner = Math.round(size * 0.78);
  const pad = Math.round((size - inner) / 2);
  const badge = await sharp(MASTER).resize(inner, inner, { fit: "cover" }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: badge, top: pad, left: pad }])
    .png()
    .toBuffer();
}

// Aplati sur fond opaque (Apple/tuiles n'aiment pas la transparence).
async function flat(size) {
  return sharp(MASTER).resize(size, size, { fit: "cover" }).flatten({ background: BG }).png().toBuffer();
}

// Favicon : depuis le master 3D (comme les logos), aplati sur fond opaque.
async function faviconPng(size) {
  return flat(size);
}

async function run() {
  const outputs = {
    [join(PUB, "icons", "icon-192.png")]: await square(192),
    [join(PUB, "icons", "icon-512.png")]: await square(512),
    [join(PUB, "icons", "icon-1024.png")]: await square(1024),
    [join(PUB, "icons", "icon-maskable-512.png")]: await maskable(512),
    [join(PUB, "icons", "apple-touch-icon.png")]: await flat(180),
  };
  for (const [file, buf] of Object.entries(outputs)) {
    await writeFile(file, buf);
    console.log("écrit", file);
  }

  // Favicon .ico multi-tailles (16/32/48/64) → depuis le SVG simple → 3 emplacements.
  const ico = await pngToIco([
    await faviconPng(16),
    await faviconPng(32),
    await faviconPng(48),
    await faviconPng(64),
  ]);
  for (const f of [
    join(PUB, "favicon.ico"),
    join(PUB, "icons", "favicon.ico"),
    join(__dirname, "..", "src", "app", "favicon.ico"),
  ]) {
    await writeFile(f, ico);
    console.log("écrit", f);
  }

  // icon.svg = conteneur du rendu 3D (Chrome privilégie le SVG pour l'onglet).
  const emb = (await flat(256)).toString("base64");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><image width="512" height="512" href="data:image/png;base64,${emb}"/></svg>\n`;
  const svgPath = join(PUB, "icon.svg");
  await writeFile(svgPath, svg);
  console.log("écrit", svgPath);

  console.log("Terminé.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
