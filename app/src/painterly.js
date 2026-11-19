// The Painterly / Ink Art Engine: one named treatment, applied the same way
// to every panel, so the cover reads as ONE illustrative poster instead of
// raw photos pasted on a template.
//
// What it does, offline on a canvas (no network, no service):
//   * posterized colour separation — each channel is snapped to a few levels,
//     so flat areas of colour read as printed ink, not a photograph;
//   * edge-aware ink outlines — a Sobel gradient on luminance darkens strong
//     edges toward ink, like a comic inker tracing the drawing;
//   * halftone dots — in mid-tones and shadows a rotated dot screen prints
//     the tone, the way a poster press does;
//   * cinematic light — an S-curve lifts the highlights warm and deepens the
//     shadows cool, so the picture has contrast a flat photo lacks;
//   * print grain — a seeded low-frequency mottle plus fine hash grain, so
//     the surface feels like paper stock, not random sensor noise.
// Skin-safe: warm skin-toned pixels are blended back toward the original
// photo (by `faceProtect`) and skip the ink and halftone, so faces stay
// natural while the background goes full poster.
//
// Deterministic: the same photo + settings always produce the same pixels
// (seeded grain, no Math.random, no time). Treated images are cached per
// photo + settings, so a redraw reuses them instead of re-running the pass.
import { isSkinPixel } from './focus.js';

const TREATMENTS = {
  // Ink crime poster: few levels, hard ink, strong halftone.
  ink: { levels: 5, ink: 0.9, halftone: 0.85, curve: 0.34, blend: 1.0, warm: 0.1 },
  // Painterly: mid levels, visible ink, halftone present but lighter.
  painterly: { levels: 6, ink: 0.65, halftone: 0.55, curve: 0.26, blend: 1.0, warm: 0.08 },
  // Airbrushed retro: many levels, almost no ink, mostly a soft grade.
  airbrush: { levels: 9, ink: 0.18, halftone: 0.15, curve: 0.16, blend: 0.55, warm: 0.06 },
};

export const TREATMENT_IDS = Object.keys(TREATMENTS);

const cache = new Map();

function cacheKey(photo, art) {
  return [
    photo.id || photo.url || '',
    art.treatment,
    Math.round((art.strength ?? 0.7) * 20) / 20,
    art.skinSafe ? 1 : 0,
    Math.round((art.faceProtect ?? 0.6) * 20) / 20,
  ].join('|');
}

/** Deterministic fine grain for one pixel: an integer hash of x, y, seed. */
function hashGrain(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296 - 0.5;
}

/** Seeded low-frequency paper mottle: a small random grid, bilinearly read. */
function mottleGrid(seed) {
  const gw = 24;
  const gh = 14;
  const grid = new Float32Array((gw + 1) * (gh + 1));
  let s = seed >>> 0;
  for (let i = 0; i < grid.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    grid[i] = s / 4294967296 - 0.5;
  }
  return {
    at(x, y) {
      const gx = Math.min(gw - 1, Math.max(0, x * gw));
      const gy = Math.min(gh - 1, Math.max(0, y * gh));
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = gx - x0;
      const fy = gy - y0;
      const g00 = grid[y0 * (gw + 1) + x0];
      const g10 = grid[y0 * (gw + 1) + x0 + 1];
      const g01 = grid[(y0 + 1) * (gw + 1) + x0];
      const g11 = grid[(y0 + 1) * (gw + 1) + x0 + 1];
      return (g00 * (1 - fx) + g10 * fx) * (1 - fy) + (g01 * (1 - fx) + g11 * fx) * fy;
    },
  };
}

/**
 * Treat one loaded image and return a canvas (same aspect). `art` is
 * { treatment, strength 0..1, skinSafe, faceProtect 0..1 }.
 * Treatment runs at most 1024 px wide: posterized art survives upscaling,
 * and the pass stays fast enough to re-run when a slider moves.
 */
export function treatPhoto(img, art) {
  const t = TREATMENTS[art.treatment] || TREATMENTS.painterly;
  const strength = Math.max(0, Math.min(1, art.strength ?? 0.7));
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.min(1, 1024 / iw);
  const w = Math.max(16, Math.round(iw * scale));
  const h = Math.max(16, Math.round(ih * scale));

  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;

  // Luminance + skin mask, one pass.
  const lum = new Float32Array(w * h);
  const skin = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    lum[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (art.skinSafe && isSkinPixel(d[i], d[i + 1], d[i + 2])) skin[p] = 1;
  }

  // Sobel edge magnitude on luminance (interior pixels only).
  const edge = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const gx =
        -lum[p - w - 1] - 2 * lum[p - 1] - lum[p + w - 1] +
        lum[p - w + 1] + 2 * lum[p + 1] + lum[p + w + 1];
      const gy =
        -lum[p - w - 1] - 2 * lum[p - w] - lum[p - w + 1] +
        lum[p + w - 1] + 2 * lum[p + w] + lum[p + w + 1];
      edge[p] = Math.min(255, Math.hypot(gx, gy) / 4);
    }
  }

  const levels = t.levels;
  const step = 255 / (levels - 1);
  const post = (v) => Math.max(0, Math.min(255, Math.round(v / step) * step));
  // S-curve: v' = v + curve * (v - 128) * (1 - |v - 128| / 128), plus a warm
  // lift in the shadows (red up, blue down) and a cool lift in highlights.
  const curve = (v) => {
    const n = (v - 128) / 128;
    return Math.max(0, Math.min(255, v + t.curve * strength * 128 * n * (1 - Math.abs(n))));
  };
  const mottle = mottleGrid(20261119);
  const seed = 7919;
  // Halftone screen: dots on a grid rotated ~15 degrees, radius from tone.
  const spacing = 7;
  const cos = Math.cos(0.26);
  const sin = Math.sin(0.26);

  const faceProtect = art.skinSafe ? (art.faceProtect ?? 0.6) : 0;
  const inkCol = [16, 5, 26]; // deep violet ink, not pure black

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const i = p * 4;
      const isSkin = skin[p] === 1;
      // Skin pixels get a weaker pass: less posterize, no ink, no halftone.
      const s = isSkin ? strength * (1 - faceProtect) : strength;
      if (s <= 0.01) continue;
      const orig = [d[i], d[i + 1], d[i + 2]];
      // 1. Cinematic curve, then posterize.
      let r = post(curve(orig[0]));
      let g = post(curve(orig[1]));
      let b = post(curve(orig[2]));
      // Warm shadows: a touch of red in the darks, cool in the brights.
      const l = lum[p];
      const warmAmt = t.warm * s * (l < 128 ? (128 - l) / 128 : -(l - 128) / 256);
      r = Math.max(0, Math.min(255, r + warmAmt * 255 * 0.12));
      b = Math.max(0, Math.min(255, b - warmAmt * 255 * 0.12));
      // 2. Ink outlines on strong edges (skipped on skin).
      if (!isSkin && t.ink > 0) {
        const e = Math.max(0, (edge[p] - 42) / 90);
        const inkAmt = Math.min(1, e) * t.ink * s;
        if (inkAmt > 0) {
          r = r * (1 - inkAmt) + inkCol[0] * inkAmt;
          g = g * (1 - inkAmt) + inkCol[1] * inkAmt;
          b = b * (1 - inkAmt) + inkCol[2] * inkAmt;
        }
      }
      // 3. Halftone dots in mid-tones and shadows (skipped on skin).
      if (!isSkin && t.halftone > 0 && l < 190) {
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        const cx = rx - Math.floor(rx / spacing) * spacing - spacing / 2;
        const cy = ry - Math.floor(ry / spacing) * spacing - spacing / 2;
        const dist = Math.hypot(cx, cy);
        const radius = spacing * 0.5 * (1 - l / 210);
        if (dist < radius) {
          const dotAmt = 0.55 * t.halftone * s * (1 - l / 210);
          r = r * (1 - dotAmt) + inkCol[0] * dotAmt;
          g = g * (1 - dotAmt) + inkCol[1] * dotAmt;
          b = b * (1 - dotAmt) + inkCol[2] * dotAmt;
        }
      }
      // 4. Print grain: low-frequency mottle + fine hash grain.
      const grain = mottle.at(x / w, y / h) * 0.14 * s + hashGrain(x, y, seed) * 0.09 * s;
      r = Math.max(0, Math.min(255, r + grain * 255));
      g = Math.max(0, Math.min(255, g + grain * 255));
      b = Math.max(0, Math.min(255, b + grain * 255));
      // 5. Blend toward the treated colour. Airbrush keeps part of the
      //    original photo (soft), and skin keeps more of itself.
      const eff = s * (isSkin ? (1 - faceProtect * 0.7) : t.blend);
      d[i] = orig[0] * (1 - eff) + r * eff;
      d[i + 1] = orig[1] * (1 - eff) + g * eff;
      d[i + 2] = orig[2] * (1 - eff) + b * eff;
    }
  }
  ctx.putImageData(image, 0, 0);
  return cv;
}

/** The treated image for a photo under the current art settings, cached.
 *  Returns the original image when the treatment is off. */
export function treatedImageFor(photo, art) {
  if (!art || art.treatment === 'off' || (art.strength ?? 0.7) <= 0) return photo.img;
  const key = cacheKey(photo, art);
  const hit = cache.get(key);
  if (hit) return hit;
  const treated = treatPhoto(photo.img, art);
  if (cache.size >= 8) cache.delete(cache.keys().next().value);
  cache.set(key, treated);
  return treated;
}

/** How many treated images are cached (for tests). */
export function treatedCacheSize() {
  return cache.size;
}
