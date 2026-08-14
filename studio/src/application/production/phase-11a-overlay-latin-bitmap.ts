/**
 * Hand-authored 8×8 Latin bitmap atlas for vhs-overlay-latin-bitmap-v1.
 * Bit 7 = leftmost pixel (matches paintGlyph). No remote font, no hash motifs.
 */
export const PHASE_11A_BITMAP_GLYPH_CELL = 8 as const;
export const PHASE_11A_BITMAP_GLYPH_ATLAS_ID = "vhs-overlay-latin-bitmap-shapes-v1" as const;

/** 8 hex bytes, MSB-left. */
const ASCII_HEX: Record<string, string> = {
  " ": "0000000000000000",
  "!": "1818181800181800",
  '"': "6666240000000000",
  "#": "24247E247E242400",
  $: "083E483C0A7C0800",
  "%": "6264080810264600",
  "&": "3848443850543800",
  "'": "1818100000000000",
  "(": "0810202020100800",
  ")": "1008040404081000",
  "*": "0028187E18180000",
  "+": "0008187E18180000",
  ",": "0000000000181808",
  "-": "0000007E00000000",
  ".": "0000000000181800",
  "/": "0204081020400000",
  "0": "3C464A5262463C00",
  "1": "0818280808083E00",
  "2": "3C42020C30407E00",
  "3": "3C42021C02423C00",
  "4": "0C1424447E040400",
  "5": "7E407C0242423C00",
  "6": "1C20407C42423C00",
  "7": "7E02040810101000",
  "8": "3C42423C42423C00",
  "9": "3C42423E02043800",
  ":": "0018180000181800",
  ";": "0018180000181808",
  "<": "0408102010080400",
  "=": "00007E00007E0000",
  ">": "2010080408102000",
  "?": "3C42040800080800",
  "@": "3C4A565E40423C00",
  A: "183C66667E666600",
  B: "7C66667C66667C00",
  C: "3C66404040663C00",
  D: "786C6666666C7800",
  E: "7E40407C40407E00",
  F: "7E40407C40404000",
  G: "3C66404E46663C00",
  H: "6666667E66666600",
  I: "3C18181818183C00",
  J: "1E0C0C0C4C4C3800",
  K: "664C78784C666600",
  L: "4040404040407E00",
  M: "42667E5A42424200",
  N: "426262725A4E4600",
  O: "3C66666666663C00",
  P: "7C66667C40404000",
  Q: "3C666666665C3A00",
  R: "7C66667C4C666600",
  S: "3C66403C06463C00",
  T: "7E18181818181800",
  U: "6666666666663C00",
  V: "66666666663C1800",
  W: "4242425A5A7E6600",
  X: "66663C183C666600",
  Y: "66663C1818181800",
  Z: "7E060C1830607E00",
  "[": "3810101010103800",
  "\\": "4020100804020000",
  "]": "1C04040404041C00",
  "^": "183C660000000000",
  _: "000000000000007E",
  "`": "2010080000000000",
  a: "00003C063E663E00",
  b: "40407C6666667C00",
  c: "00003C6060603C00",
  d: "06063E6666663E00",
  e: "00003C667E603C00",
  f: "1C203C2020202000",
  g: "00003E66663E063C",
  h: "40407C6666666600",
  i: "1800181818181C00",
  j: "0C000C0C0C0C4C38",
  k: "40404C58704C6600",
  l: "1818181818181C00",
  m: "0000765A5A5A5A00",
  n: "00007C6666666600",
  o: "00003C6666663C00",
  p: "00007C66667C4040",
  q: "00003E66663E0606",
  r: "00005C7660606000",
  s: "00003E603C067C00",
  t: "10207C1010101C00",
  u: "0000666666663E00",
  v: "00006666663C1800",
  w: "0000425A5A5A7E00",
  x: "0000663C183C6600",
  y: "00006666663E063C",
  z: "00007E0C18307E00",
  "{": "0C10102010100C00",
  "|": "1818180018181800",
  "}": "3008080408083000",
  "~": "0000324C00000000",
};

type Accent = "acute" | "grave" | "circ" | "diaeresis" | "cedilla";

const ACCENT_ROW: Record<Accent, number> = {
  acute: 0x0c,
  grave: 0x30,
  circ: 0x18,
  diaeresis: 0x24,
  cedilla: 0x00,
};

const COMPOSED: Array<[number, string, Accent]> = [
  [0x00c0, "A", "grave"],
  [0x00c2, "A", "circ"],
  [0x00c4, "A", "diaeresis"],
  [0x00c7, "C", "cedilla"],
  [0x00c8, "E", "grave"],
  [0x00c9, "E", "acute"],
  [0x00ca, "E", "circ"],
  [0x00cb, "E", "diaeresis"],
  [0x00ce, "I", "circ"],
  [0x00cf, "I", "diaeresis"],
  [0x00d4, "O", "circ"],
  [0x00d9, "U", "grave"],
  [0x00db, "U", "circ"],
  [0x00dc, "U", "diaeresis"],
  [0x00e0, "a", "grave"],
  [0x00e2, "a", "circ"],
  [0x00e4, "a", "diaeresis"],
  [0x00e7, "c", "cedilla"],
  [0x00e8, "e", "grave"],
  [0x00e9, "e", "acute"],
  [0x00ea, "e", "circ"],
  [0x00eb, "e", "diaeresis"],
  [0x00ee, "i", "circ"],
  [0x00ef, "i", "diaeresis"],
  [0x00f4, "o", "circ"],
  [0x00f9, "u", "grave"],
  [0x00fb, "u", "circ"],
  [0x00fc, "u", "diaeresis"],
  [0x00ff, "y", "diaeresis"],
];

const EXTRA_HEX: Record<number, string> = {
  0x00a0: "0000000000000000",
  0x00ab: "0012244800000000",
  0x00bb: "0048241200000000",
  0x00b0: "1824000000000000",
  0x0152: "7E50507C52527F00",
  0x0153: "00007A127E525F00",
  0x2018: "0810100000000000",
  0x2019: "1818080000000000",
  0x20ac: "1C227C207C221C00",
};

function parseHex(hex: string): Uint8Array {
  if (!/^[0-9A-Fa-f]{16}$/.test(hex)) {
    throw new Error("overlay_glyph_atlas_corrupt");
  }
  const rows = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    rows[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return rows;
}

function applyAccent(baseHex: string, accent: Accent): Uint8Array {
  const rows = parseHex(baseHex);
  if (accent === "cedilla") {
    rows[7] = ((rows[7] ?? 0) | 0x18) & 0xff;
    return rows;
  }
  const top = rows[0] ?? 0;
  rows[0] = ACCENT_ROW[accent] | (top & 0x81);
  return rows;
}

const ATLAS = new Map<number, Uint8Array>();

for (let cp = 0x20; cp <= 0x7e; cp++) {
  const ch = String.fromCodePoint(cp);
  const hex = ASCII_HEX[ch];
  if (!hex) throw new Error(`overlay_glyph_atlas_missing_ascii:U+${cp.toString(16)}`);
  ATLAS.set(cp, parseHex(hex));
}
for (const [cp, base, accent] of COMPOSED) {
  const hex = ASCII_HEX[base];
  if (!hex) throw new Error(`overlay_glyph_atlas_missing_base:${base}`);
  ATLAS.set(cp, applyAccent(hex, accent));
}
for (const [cp, hex] of Object.entries(EXTRA_HEX)) {
  ATLAS.set(Number(cp), parseHex(hex));
}

export function overlayCodepoints(text: string): number[] {
  return Array.from(text, (ch) => ch.codePointAt(0) ?? 0);
}

export function hasPhase11ABitmapGlyph(cp: number): boolean {
  return ATLAS.has(cp);
}

export function listPhase11ABitmapGlyphCodepoints(): number[] {
  return [...ATLAS.keys()].sort((a, b) => a - b);
}

export function bitmapGlyphRows(cp: number): Uint8Array {
  const rows = ATLAS.get(cp);
  if (!rows) {
    throw new Error(`overlay_glyph_unsupported:U+${cp.toString(16).toUpperCase()}`);
  }
  return new Uint8Array(rows);
}

export function bitmapGlyphInkCount(rows: Uint8Array): number {
  let n = 0;
  for (const row of rows) {
    for (let b = 0; b < 8; b++) if (((row >> b) & 1) === 1) n += 1;
  }
  return n;
}

/** Legacy hash motif that produced unreadable “letters” in compositor 1.0.0. */
export function legacyHashGlyphRows(cp: number): Uint8Array {
  const rows = new Uint8Array(8);
  if (cp === 0x20 || cp === 0xa0) return rows;
  let s = (Math.imul(cp + 1, 0x9e3779b1) >>> 0) || 1;
  for (let y = 0; y < 8; y++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    rows[y] = (s >>> 10) & 0x7e;
  }
  rows[0] = (rows[0] ?? 0) | 0x18;
  rows[7] = (rows[7] ?? 0) | 0x18;
  return rows;
}

export function glyphRowsEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
