/**
 * Local geometric vector font for Phase 11A compositor 1.2.0.
 * No system fonts, no download, no native deps. Unknown glyphs fail closed.
 */
import { overlayCodepoints } from "./phase-11a-overlay-latin-bitmap";

export const PHASE_11A_VECTOR_FONT_FAMILY = "vhs-overlay-latin-vector-v1" as const;
export const PHASE_11A_VECTOR_FONT_ID = "vhs-overlay-latin-vector-outlines-v1" as const;
export const PHASE_11A_VECTOR_FONT_LICENSE = "original-work-in-repo" as const;
export const PHASE_11A_VECTOR_EM = 1000 as const;

type Stroke =
  | { k: "line"; x0: number; y0: number; x1: number; y1: number; w: number }
  | { k: "ring"; cx: number; cy: number; r: number; w: number }
  | { k: "arc"; cx: number; cy: number; r: number; a0: number; a1: number; w: number };

type GlyphDef = { adv: number; strokes: Stroke[] };

const STEM = 88;
const THIN = 76;
const CAP = 720;
const XH = 520;
const BASE = 80;
const MID = 400;

const UNIT_X = new Float64Array(64);
const UNIT_Y = new Float64Array(64);
for (let i = 0; i < 64; i++) {
  const a = (i / 64) * Math.PI * 2;
  UNIT_X[i] = Math.cos(a);
  UNIT_Y[i] = Math.sin(a);
}

function line(x0: number, y0: number, x1: number, y1: number, w = STEM): Stroke {
  return { k: "line", x0, y0, x1, y1, w };
}
function ring(cx: number, cy: number, r: number, w = STEM): Stroke {
  return { k: "ring", cx, cy, r, w };
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number, w = STEM): Stroke {
  return { k: "arc", cx, cy, r, a0, a1, w };
}
function g(adv: number, strokes: Stroke[]): GlyphDef {
  return { adv, strokes };
}

function distSeg(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-9) {
    const ex = px - x0;
    const ey = py - y0;
    return Math.hypot(ex, ey);
  }
  let t = ((px - x0) * dx + (py - y0) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

function distRing(px: number, py: number, cx: number, cy: number, r: number): number {
  return Math.abs(Math.hypot(px - cx, py - cy) - r);
}

function distArc(
  px: number,
  py: number,
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
): number {
  const n = 16;
  let best = 1e9;
  const span = ((a1 - a0 + 64) % 64) || 64;
  for (let i = 0; i < n; i++) {
    const t0 = a0 + (span * i) / n;
    const t1 = a0 + (span * (i + 1)) / n;
    const i0 = ((Math.round(t0) % 64) + 64) % 64;
    const i1 = ((Math.round(t1) % 64) + 64) % 64;
    best = Math.min(
      best,
      distSeg(px, py, cx + r * UNIT_X[i0]!, cy + r * UNIT_Y[i0]!, cx + r * UNIT_X[i1]!, cy + r * UNIT_Y[i1]!),
    );
  }
  return best;
}

function minDist(px: number, py: number, strokes: Stroke[]): { d: number; w: number } {
  let d = 1e9;
  let w = STEM;
  for (const s of strokes) {
    let sd = 1e9;
    if (s.k === "line") sd = distSeg(px, py, s.x0, s.y0, s.x1, s.y1);
    else if (s.k === "ring") sd = distRing(px, py, s.cx, s.cy, s.r);
    else sd = distArc(px, py, s.cx, s.cy, s.r, s.a0, s.a1);
    if (sd < d) {
      d = sd;
      w = s.w;
    }
  }
  return { d, w };
}

const GLYPHS = new Map<number, GlyphDef>();

function set(ch: string | number, def: GlyphDef): void {
  const cp = typeof ch === "number" ? ch : ch.codePointAt(0)!;
  GLYPHS.set(cp, def);
}

function build(): void {
  set(" ", g(280, []));
  set(0xa0, g(280, []));
  set("!", g(300, [line(150, CAP, 150, 220), line(150, 140, 150, BASE, THIN)]));
  set(".", g(280, [ring(140, BASE + 40, 28, 56)]));
  set(",", g(280, [ring(140, BASE + 40, 28, 56), line(160, BASE + 20, 110, BASE - 80, THIN)]));
  set("-", g(420, [line(80, MID, 340, MID, THIN)]));
  set("'", g(240, [line(120, CAP, 120, 560, THIN)]));
  set(0x2018, g(260, [line(140, CAP, 100, 560, THIN)]));
  set(0x2019, g(260, [line(120, CAP, 160, 560, THIN)]));
  set("?", g(560, [arc(280, 560, 180, 36, 12), line(280, 360, 280, 240), line(280, 140, 280, BASE, THIN)]));

  set("A", g(740, [line(80, BASE, 370, CAP), line(370, CAP, 660, BASE), line(200, 280, 540, 280, THIN)]));
  set("B", g(700, [line(120, BASE, 120, CAP), arc(300, 540, 180, 48, 16), arc(320, 240, 200, 48, 16), line(120, CAP, 280, CAP, THIN), line(120, BASE, 300, BASE, THIN)]));
  set("C", g(700, [arc(400, 400, 300, 20, 44)]));
  set("D", g(740, [line(120, BASE, 120, CAP), arc(280, 400, 300, 48, 16), line(120, CAP, 260, CAP, THIN), line(120, BASE, 260, BASE, THIN)]));
  set("E", g(640, [line(120, BASE, 120, CAP), line(120, CAP, 560, CAP), line(120, MID, 480, MID, THIN), line(120, BASE, 560, BASE)]));
  set("F", g(600, [line(120, BASE, 120, CAP), line(120, CAP, 540, CAP), line(120, MID, 460, MID, THIN)]));
  set("G", g(740, [arc(400, 400, 300, 18, 46), line(700, 400, 700, BASE), line(480, 400, 700, 400, THIN)]));
  set("H", g(740, [line(120, BASE, 120, CAP), line(620, BASE, 620, CAP), line(120, MID, 620, MID)]));
  set("I", g(360, [line(180, BASE, 180, CAP), line(60, CAP, 300, CAP, THIN), line(60, BASE, 300, BASE, THIN)]));
  set("J", g(520, [line(400, CAP, 400, 220), arc(260, 220, 160, 0, 32), line(280, CAP, 480, CAP, THIN)]));
  set("K", g(700, [line(120, BASE, 120, CAP), line(120, 360, 600, CAP), line(280, 420, 620, BASE)]));
  set("L", g(600, [line(120, BASE, 120, CAP), line(120, BASE, 540, BASE)]));
  set("M", g(860, [line(100, BASE, 100, CAP), line(100, CAP, 430, 240), line(430, 240, 760, CAP), line(760, CAP, 760, BASE)]));
  set("N", g(760, [line(120, BASE, 120, CAP), line(120, CAP, 640, BASE), line(640, BASE, 640, CAP)]));
  set("O", g(780, [ring(390, 400, 300)]));
  set("P", g(660, [line(120, BASE, 120, CAP), arc(300, 520, 200, 48, 16), line(120, CAP, 280, CAP, THIN)]));
  set("Q", g(780, [ring(390, 400, 300), line(500, 220, 700, BASE - 20)]));
  set("R", g(700, [line(120, BASE, 120, CAP), arc(300, 520, 200, 48, 16), line(320, 360, 620, BASE), line(120, CAP, 280, CAP, THIN)]));
  set("S", g(620, [arc(310, 540, 180, 18, 56), line(180, 400, 440, 360, THIN), arc(310, 230, 180, 50, 18)]));
  set("T", g(680, [line(340, BASE, 340, CAP), line(80, CAP, 600, CAP)]));
  set("U", g(760, [line(120, CAP, 120, 260), line(640, CAP, 640, 260), arc(380, 260, 260, 32, 0)]));
  set("V", g(740, [line(80, CAP, 370, BASE), line(370, BASE, 660, CAP)]));
  set("W", g(920, [line(60, CAP, 220, BASE), line(220, BASE, 460, 420), line(460, 420, 700, BASE), line(700, BASE, 860, CAP)]));
  set("X", g(700, [line(100, CAP, 600, BASE), line(600, CAP, 100, BASE)]));
  set("Y", g(680, [line(80, CAP, 340, 360), line(600, CAP, 340, 360), line(340, 360, 340, BASE)]));
  set("Z", g(640, [line(80, CAP, 560, CAP), line(560, CAP, 80, BASE), line(80, BASE, 560, BASE)]));

  set("a", g(620, [ring(280, 280, 170), line(500, BASE, 500, XH)]));
  set("b", g(640, [line(120, BASE, 120, CAP), ring(360, 300, 200)]));
  set("c", g(580, [arc(340, 300, 200, 18, 46)]));
  set("d", g(640, [line(520, BASE, 520, CAP), ring(280, 300, 200)]));
  set("e", g(600, [arc(320, 300, 200, 6, 54), line(130, 300, 510, 300, THIN)]));
  set("f", g(400, [line(220, BASE, 220, 560), arc(300, 600, 120, 32, 56), line(80, XH, 340, XH, THIN)]));
  set("g", g(640, [ring(320, 300, 200), line(520, 100, 520, 300), arc(320, 80, 200, 0, 32)]));
  set("h", g(640, [line(120, BASE, 120, CAP), arc(340, 340, 180, 32, 0), line(520, BASE, 520, 340)]));
  set("i", g(280, [line(140, BASE, 140, XH), ring(140, 640, 32, 64)]));
  set("j", g(300, [line(160, 80, 160, XH), ring(160, 640, 32, 64), arc(40, 80, 140, 0, 28)]));
  set("k", g(600, [line(120, BASE, 120, CAP), line(120, 280, 500, XH), line(280, 320, 520, BASE)]));
  set("l", g(280, [line(140, BASE, 140, CAP)]));
  set("m", g(860, [line(100, BASE, 100, XH), arc(260, 360, 140, 32, 0), line(400, BASE, 400, 360), arc(540, 360, 140, 32, 0), line(680, BASE, 680, 360)]));
  set("n", g(640, [line(120, BASE, 120, XH), arc(340, 360, 180, 32, 0), line(520, BASE, 520, 360)]));
  set("o", g(640, [ring(320, 300, 200)]));
  set("p", g(640, [line(120, BASE - 200, 120, XH), ring(360, 300, 200)]));
  set("q", g(640, [line(520, BASE - 200, 520, XH), ring(280, 300, 200)]));
  set("r", g(440, [line(120, BASE, 120, XH), arc(280, 380, 140, 28, 56)]));
  set("s", g(560, [arc(280, 410, 145, 18, 56), line(170, 320, 390, 260, THIN), arc(280, 200, 145, 50, 18)]));
  set("t", g(400, [line(200, BASE + 40, 200, 620), line(80, XH, 340, XH, THIN), arc(280, BASE + 80, 100, 40, 8)]));
  set("u", g(640, [line(120, XH, 120, 260), line(520, XH, 520, BASE), arc(320, 260, 200, 32, 0)]));
  set("v", g(600, [line(80, XH, 300, BASE), line(300, BASE, 520, XH)]));
  set("w", g(820, [line(60, XH, 200, BASE), line(200, BASE, 410, 360), line(410, 360, 620, BASE), line(620, BASE, 760, XH)]));
  set("x", g(600, [line(80, XH, 520, BASE), line(520, XH, 80, BASE)]));
  set("y", g(600, [line(80, XH, 300, BASE), line(520, XH, 220, BASE - 200)]));
  set("z", g(560, [line(80, XH, 480, XH), line(480, XH, 80, BASE), line(80, BASE, 480, BASE)]));

  for (let d = 0; d <= 9; d++) {
    const labels = [
      g(620, [ring(310, 400, 260)]),
      g(420, [line(220, BASE, 220, CAP), line(120, 600, 220, CAP, THIN)]),
      g(600, [arc(300, 520, 180, 36, 8), line(460, 400, 120, BASE), line(120, BASE, 500, BASE)]),
      g(600, [arc(300, 540, 160, 40, 12), arc(300, 240, 170, 44, 8)]),
      g(620, [line(420, BASE, 420, CAP), line(420, CAP, 120, 280), line(120, 280, 520, 280, THIN)]),
      g(600, [line(480, CAP, 160, CAP), line(160, CAP, 160, 400), arc(300, 240, 180, 48, 8)]),
      g(620, [arc(320, 280, 200, 0, 64), line(160, 360, 200, 620), arc(320, 560, 180, 28, 48)]),
      g(600, [line(120, CAP, 500, CAP), line(500, CAP, 220, BASE)]),
      g(620, [ring(310, 540, 150), ring(310, 240, 160)]),
      g(620, [ring(310, 500, 160), line(450, 400, 420, 160), arc(300, 220, 160, 48, 12)]),
    ];
    set(String(d), labels[d]!);
  }

  function accented(base: string, kind: "acute" | "grave" | "circ" | "diaeresis" | "cedilla"): GlyphDef {
    const src = GLYPHS.get(base.codePointAt(0)!)!;
    const extra: Stroke[] = [];
    const cx = src.adv / 2;
    if (kind === "acute") extra.push(line(cx + 20, 820, cx + 120, 940, THIN));
    if (kind === "grave") extra.push(line(cx + 120, 820, cx + 20, 940, THIN));
    if (kind === "circ") extra.push(line(cx - 40, 840, cx + 40, 940, THIN), line(cx + 40, 940, cx + 120, 840, THIN));
    if (kind === "diaeresis") extra.push(ring(cx - 20, 900, 22, 44), ring(cx + 80, 900, 22, 44));
    if (kind === "cedilla") extra.push(line(cx, BASE, cx, BASE - 80, THIN), arc(cx + 40, BASE - 80, 50, 32, 8, THIN));
    return g(src.adv, [...src.strokes, ...extra]);
  }

  set(0xe0, accented("a", "grave"));
  set(0xe2, accented("a", "circ"));
  set(0xe4, accented("a", "diaeresis"));
  set(0xe7, accented("c", "cedilla"));
  set(0xe8, accented("e", "grave"));
  set(0xe9, accented("e", "acute"));
  set(0xea, accented("e", "circ"));
  set(0xeb, accented("e", "diaeresis"));
  set(0xee, accented("i", "circ"));
  set(0xef, accented("i", "diaeresis"));
  set(0xf4, accented("o", "circ"));
  set(0xf9, accented("u", "grave"));
  set(0xfb, accented("u", "circ"));
  set(0xfc, accented("u", "diaeresis"));
  set(0xc0, accented("A", "grave"));
  set(0xc9, accented("E", "acute"));
  set(0xc8, accented("E", "grave"));
  set(0xca, accented("E", "circ"));
  set(0xc7, accented("C", "cedilla"));
}

build();

const KERN: Record<string, number> = {
  AV: -70,
  VA: -70,
  To: -40,
  "Té": -40,
  "L’": -30,
  "’i": -20,
  "De": -20,
};

export function hasPhase11AVectorGlyph(cp: number): boolean {
  return GLYPHS.has(cp);
}

export function assertPhase11AVectorGlyph(cp: number): void {
  if (!GLYPHS.has(cp)) {
    throw new Error(`overlay_glyph_unsupported:U+${cp.toString(16).toUpperCase()}`);
  }
}

export function vectorAdvance(cp: number): number {
  assertPhase11AVectorGlyph(cp);
  return GLYPHS.get(cp)!.adv;
}

export function vectorKerning(left: number, right: number): number {
  const key = `${String.fromCodePoint(left)}${String.fromCodePoint(right)}`;
  return KERN[key] ?? 0;
}

export function measurePhase11AVectorText(
  text: string,
  pixelSize: number,
  trackingEm = 0,
): number {
  const cps = overlayCodepoints(text);
  let w = 0;
  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i]!;
    assertPhase11AVectorGlyph(cp);
    w += vectorAdvance(cp);
    if (i + 1 < cps.length) w += vectorKerning(cp, cps[i + 1]!) + trackingEm;
  }
  return (w * pixelSize) / PHASE_11A_VECTOR_EM;
}

export type VectorGlyphRaster = {
  width: number;
  height: number;
  originX: number;
  originY: number;
  coverage: Uint8Array;
};

const rasterCache = new Map<string, VectorGlyphRaster>();

export function rasterizePhase11AVectorGlyph(cp: number, pixelSize: number, bold: boolean): VectorGlyphRaster {
  assertPhase11AVectorGlyph(cp);
  const key = `${cp}:${pixelSize}:${bold ? 1 : 0}`;
  const hit = rasterCache.get(key);
  if (hit) return hit;
  const def = GLYPHS.get(cp)!;
  const pad = Math.ceil(pixelSize * 0.28) + 2;
  const width = Math.max(1, Math.ceil((def.adv * pixelSize) / PHASE_11A_VECTOR_EM) + pad * 2);
  const height = Math.max(1, Math.ceil(pixelSize * 1.35) + pad * 2);
  const originX = pad;
  const originY = pad + Math.ceil(pixelSize * 0.22);
  const coverage = new Uint8Array(width * height);
  const scale = pixelSize / PHASE_11A_VECTOR_EM;
  const fat = bold ? 1.12 : 1;
  const ss = 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const gx = (x + (sx + 0.5) / ss - originX) / scale;
          const gy = CAP - (y + (sy + 0.5) / ss - originY) / scale;
          const { d, w } = minDist(gx, gy, def.strokes);
          const half = (w * fat) / 2;
          const edge = 22;
          acc += Math.max(0, Math.min(1, (half + edge - d) / (edge * 2)));
        }
      }
      coverage[y * width + x] = Math.round((acc / (ss * ss)) * 255);
    }
  }
  const raster = { width, height, originX, originY, coverage };
  rasterCache.set(key, raster);
  return raster;
}

export { overlayCodepoints };
