/**
 * Synthetic 1024×1024 fixtures for Phase 11A typography 1.2.0.
 * No Production media. No network.
 */
import { encodeRgbPng, decodeRgbPng } from "./phase-11a-png-rgb";
import type { OverlayLineBox } from "./phase-11a-deterministic-compositor";

export const PHASE_11A_FIXTURE_CANVAS = 1024 as const;

function rgbPng(fill: (x: number, y: number) => [number, number, number]): Uint8Array {
  const rgb = new Uint8Array(PHASE_11A_FIXTURE_CANVAS * PHASE_11A_FIXTURE_CANVAS * 3);
  for (let y = 0; y < PHASE_11A_FIXTURE_CANVAS; y++) {
    for (let x = 0; x < PHASE_11A_FIXTURE_CANVAS; x++) {
      const i = (y * PHASE_11A_FIXTURE_CANVAS + x) * 3;
      const [r, g, b] = fill(x, y);
      rgb[i] = r;
      rgb[i + 1] = g;
      rgb[i + 2] = b;
    }
  }
  return encodeRgbPng({ width: PHASE_11A_FIXTURE_CANVAS, height: PHASE_11A_FIXTURE_CANVAS, rgb });
}

export function syntheticDarkPng(): Uint8Array {
  return rgbPng(() => [28, 32, 40]);
}

export function syntheticLightPng(): Uint8Array {
  return rgbPng(() => [236, 232, 224]);
}

export function syntheticVariableContrastPng(): Uint8Array {
  return rgbPng((x, y) => {
    const t = (x + y) / (PHASE_11A_FIXTURE_CANVAS * 2);
    const v = Math.round(40 + t * 180);
    return [v, Math.round(v * 0.92), Math.round(v * 0.84)];
  });
}

export function syntheticScene2GridPng(): Uint8Array {
  return rgbPng((x, y) => {
    const cell = ((Math.floor(x / 48) + Math.floor(y / 48)) & 1) === 0;
    const band = y > 620 ? 18 : 0;
    return cell ? [58 - band, 68 - band, 82 - band] : [86 - band, 94 - band, 108 - band];
  });
}

export function paintDebugLayout(input: {
  png: Uint8Array;
  boxes: readonly OverlayLineBox[];
  safe: { top: number; right: number; bottom: number; left: number };
}): Uint8Array {
  const decoded = decodeRgbPng(input.png);
  const rgb = decoded.rgb.slice();
  const canvas = decoded.width;
  const stroke = (x: number, y: number, color: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= canvas || y >= decoded.height) return;
    const i = (y * canvas + x) * 3;
    rgb[i] = color[0];
    rgb[i + 1] = color[1];
    rgb[i + 2] = color[2];
  };
  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: [number, number, number],
  ) => {
    for (let i = 0; i < w; i++) {
      stroke(x + i, y, color);
      stroke(x + i, y + h - 1, color);
    }
    for (let i = 0; i < h; i++) {
      stroke(x, y + i, color);
      stroke(x + w - 1, y + i, color);
    }
  };
  rect(
    input.safe.left,
    input.safe.top,
    canvas - input.safe.left - input.safe.right,
    decoded.height - input.safe.top - input.safe.bottom,
    [80, 200, 255],
  );
  for (const box of input.boxes) {
    rect(box.x, box.y, box.width, box.height, box.role === "title" ? [255, 210, 80] : [120, 255, 160]);
  }
  return encodeRgbPng({ width: decoded.width, height: decoded.height, rgb });
}

export function cropRgbPng(input: {
  png: Uint8Array;
  x: number;
  y: number;
  w: number;
  h: number;
}): Uint8Array {
  const decoded = decodeRgbPng(input.png);
  const rgb = new Uint8Array(input.w * input.h * 3);
  for (let y = 0; y < input.h; y++) {
    for (let x = 0; x < input.w; x++) {
      const sx = input.x + x;
      const sy = input.y + y;
      const si = (sy * decoded.width + sx) * 3;
      const di = (y * input.w + x) * 3;
      rgb[di] = decoded.rgb[si] ?? 0;
      rgb[di + 1] = decoded.rgb[si + 1] ?? 0;
      rgb[di + 2] = decoded.rgb[si + 2] ?? 0;
    }
  }
  return encodeRgbPng({ width: input.w, height: input.h, rgb });
}

export function stitchSideBySide(left: Uint8Array, right: Uint8Array): Uint8Array {
  const a = decodeRgbPng(left);
  const b = decodeRgbPng(right);
  const canvas = PHASE_11A_FIXTURE_CANVAS;
  const half = canvas / 2;
  const rgb = new Uint8Array(canvas * canvas * 3);
  const blitHalf = (src: typeof a, ox: number) => {
    for (let y = 0; y < canvas; y++) {
      for (let x = 0; x < half; x++) {
        const sx = Math.min(src.width - 1, Math.floor((x * src.width) / half));
        const sy = Math.min(src.height - 1, Math.floor((y * src.height) / canvas));
        const si = (sy * src.width + sx) * 3;
        const di = (y * canvas + ox + x) * 3;
        rgb[di] = src.rgb[si] ?? 0;
        rgb[di + 1] = src.rgb[si + 1] ?? 0;
        rgb[di + 2] = src.rgb[si + 2] ?? 0;
      }
    }
  };
  blitHalf(a, 0);
  blitHalf(b, half);
  return encodeRgbPng({ width: canvas, height: canvas, rgb });
}
