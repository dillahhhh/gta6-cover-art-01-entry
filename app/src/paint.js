// paint.js — SUNSET PRESS "ink and paint" pipeline.
//
// Turns an ordinary photo into flat painted key art, all in Canvas 2D:
//   smooth (box blur) -> posterize luminance -> gradient map -> ink outline
//   (full-resolution Sobel) -> fine grain.
//
// Two hard lessons baked in here (Claude review of round 4, 21 Nov):
//   FIX 1 — the ink edge field is computed at FULL output resolution.
//   Round 4 computed it at 1/4 resolution and nearest-sampled it back up,
//   which turned every outline into visible 4x4 px blocks on faces
//   (eyes/mouths in THE CREW panel and the editor preview). We never
//   downsample the edge field. Ink is also weakened inside the face zone
//   (the Subject Focus ellipse), so faces keep their features.
//   FIX 2 — the hero is painted GENTLY. Round 4 pushed the hero as hard
//   as the panels: leaves and sky collapsed into noise clumps with broken
//   yellow outlines and faces "melted" under a gold halo. The hero gets
//   more smoothing, more posterize levels, weaker ink and a softer
//   gradient map, so it stays clean with smooth golden-hour light.
//
// No ML, no network, no library. Pure canvas + ImageData math.

export const PRESETS = {
  sunset: {
    label: 'Sunset',
    levels: 8,
    smooth: 2,
    ink: 0.5,
    inkThreshold: 0.14,
    mapStrength: 0.9,
    grain: 0.05,
    // deep violet -> magenta -> coral -> peach -> gold
    stops: [
      [0.0, 26, 11, 46],
      [0.3, 123, 45, 139],
      [0.58, 232, 93, 117],
      [0.82, 249, 168, 106],
      [1.0, 255, 217, 138],
    ],
  },
  neon: {
    label: 'Neon Night',
    levels: 7,
    smooth: 2,
    ink: 0.62,
    inkThreshold: 0.12,
    mapStrength: 0.92,
    grain: 0.06,
    stops: [
      [0.0, 8, 6, 32],
      [0.3, 96, 24, 130],
      [0.55, 214, 36, 140],
      [0.8, 255, 92, 168],
      [1.0, 120, 240, 255],
    ],
  },
  teal: {
    label: 'Teal Dusk',
    levels: 7,
    smooth: 2,
    ink: 0.55,
    inkThreshold: 0.13,
    mapStrength: 0.9,
    grain: 0.05,
    stops: [
      [0.0, 6, 26, 38],
      [0.3, 14, 94, 110],
      [0.58, 64, 170, 158],
      [0.82, 240, 200, 140],
      [1.0, 255, 236, 190],
    ],
  },
  mono: {
    label: 'Mono Pink',
    levels: 6,
    smooth: 2,
    ink: 0.45,
    inkThreshold: 0.15,
    mapStrength: 0.9,
    grain: 0.06,
    stops: [
      [0.0, 30, 8, 38],
      [0.35, 122, 30, 96],
      [0.65, 214, 84, 150],
      [1.0, 255, 205, 225],
    ],
  },
  golden: {
    label: 'Golden Hour',
    levels: 9,
    smooth: 3,
    ink: 0.35,
    inkThreshold: 0.16,
    mapStrength: 0.75,
    grain: 0.04,
    stops: [
      [0.0, 38, 20, 44],
      [0.3, 128, 62, 96],
      [0.58, 214, 116, 92],
      [0.82, 246, 178, 110],
      [1.0, 255, 226, 160],
    ],
  },
  noir: {
    label: 'Vice Noir',
    levels: 7,
    smooth: 2,
    ink: 0.7,
    inkThreshold: 0.11,
    mapStrength: 0.9,
    grain: 0.07,
    stops: [
      [0.0, 6, 6, 12],
      [0.35, 70, 22, 72],
      [0.65, 168, 48, 96],
      [1.0, 250, 214, 200],
    ],
  },
};

/** Separable box blur on ImageData (RGB; alpha untouched). O(n) per pass. */
function boxBlur(data, w, h, radius) {
  const tmp = new Float32Array(data.length);
  const win = radius * 2 + 1;
  // horizontal pass
  for (let y = 0; y < h; y++) {
    let sr = 0, sg = 0, sb = 0;
    const row = y * w * 4;
    for (let x = -radius; x <= radius; x++) {
      const cx = Math.min(w - 1, Math.max(0, x));
      const i = row + cx * 4;
      sr += data[i]; sg += data[i + 1]; sb += data[i + 2];
    }
    for (let x = 0; x < w; x++) {
      const i = row + x * 4;
      tmp[i] = sr / win; tmp[i + 1] = sg / win; tmp[i + 2] = sb / win;
      tmp[i + 3] = data[i + 3];
      const xa = Math.min(w - 1, x + radius + 1);
      const xr = Math.max(0, x - radius);
      const ia = row + xa * 4;
      const ir = row + xr * 4;
      sr += data[ia] - data[ir];
      sg += data[ia + 1] - data[ir + 1];
      sb += data[ia + 2] - data[ir + 2];
    }
  }
  // vertical pass
  for (let x = 0; x < w; x++) {
    let sr = 0, sg = 0, sb = 0;
    for (let y = -radius; y <= radius; y++) {
      const cy = Math.min(h - 1, Math.max(0, y));
      const i = (cy * w + x) * 4;
      sr += tmp[i]; sg += tmp[i + 1]; sb += tmp[i + 2];
    }
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      data[i] = sr / win; data[i + 1] = sg / win; data[i + 2] = sb / win;
      const ya = Math.min(h - 1, y + radius + 1);
      const yr = Math.max(0, y - radius);
      const ia = (ya * w + x) * 4;
      const ir = (yr * w + x) * 4;
      sr += tmp[ia] - tmp[ir];
      sg += tmp[ia + 1] - tmp[ir + 1];
      sb += tmp[ia + 2] - tmp[ir + 2];
    }
  }
}

/** Quantize luminance to `levels` steps, preserving hue (scale RGB by lum ratio). */
function posterize(data, levels) {
  const step = 255 / (levels - 1);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 1) continue;
    const q = Math.round(lum / step) * step;
    const s = q / lum;
    data[i] = Math.min(255, r * s);
    data[i + 1] = Math.min(255, g * s);
    data[i + 2] = Math.min(255, b * s);
  }
}

/** Map luminance through a gradient, blended with the original by `amount`. */
function gradientMap(data, stops, amount) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    let a = stops[0], b2 = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (lum >= stops[s][0] && lum <= stops[s + 1][0]) { a = stops[s]; b2 = stops[s + 1]; break; }
    }
    const span = (b2[0] - a[0]) || 1;
    const t = Math.min(1, Math.max(0, (lum - a[0]) / span));
    const gr = a[1] + (b2[1] - a[1]) * t;
    const gg = a[2] + (b2[2] - a[2]) * t;
    const gb = a[3] + (b2[3] - a[3]) * t;
    data[i] = r + (gr - r) * amount;
    data[i + 1] = g + (gg - g) * amount;
    data[i + 2] = b + (gb - b) * amount;
  }
}

/** Sobel edge magnitude at FULL resolution. Never downsampled (FIX 1). */
function sobelMagnitude(data, w, h) {
  const mag = new Float32Array(w * h);
  const lumAt = (x, y) => {
    x = Math.min(w - 1, Math.max(0, x));
    y = Math.min(h - 1, Math.max(0, y));
    const i = (y * w + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx =
        -lumAt(x - 1, y - 1) - 2 * lumAt(x - 1, y) - lumAt(x - 1, y + 1) +
        lumAt(x + 1, y - 1) + 2 * lumAt(x + 1, y) + lumAt(x + 1, y + 1);
      const gy =
        -lumAt(x - 1, y - 1) - 2 * lumAt(x, y - 1) - lumAt(x + 1, y - 1) +
        lumAt(x - 1, y + 1) + 2 * lumAt(x, y + 1) + lumAt(x + 1, y + 1);
      mag[y * w + x] = Math.min(1, Math.sqrt(gx * gx + gy * gy) / 1020);
    }
  }
  return mag;
}

/** Soft elliptical face mask (0..1) in canvas fractions; 1 = inside the face zone. */
function faceMaskAt(x, y, w, h, face) {
  if (!face) return 0;
  const dx = (x / w - face.x) / Math.max(0.02, face.rx);
  const dy = (y / h - face.y) / Math.max(0.02, face.ry);
  const d = dx * dx + dy * dy;
  if (d >= 1.44) return 0; // outside the soft edge
  if (d <= 0.64) return 1; // solid inside
  return (1.44 - d) / 0.8; // soft falloff
}

/** Dark violet ink where edges are strong; weakened inside the face zone (FIX 1). */
function inkPass(data, mag, w, h, threshold, strength, face) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const m = mag[y * w + x];
      if (m <= threshold) continue;
      let s = strength * Math.min(1, (m - threshold) / (1 - threshold));
      const fm = faceMaskAt(x, y, w, h, face);
      s *= 1 - 0.72 * fm; // faces keep ~28% of the ink
      if (s <= 0.01) continue;
      const i = (y * w + x) * 4;
      // dark violet ink, not pure black — keeps the sunset palette
      data[i] = data[i] * (1 - s) + 18 * s;
      data[i + 1] = data[i + 1] * (1 - s) + 8 * s;
      data[i + 2] = data[i + 2] * (1 - s) + 34 * s;
    }
  }
}

/** Fine deterministic grain, stronger in the shadows. */
function grainPass(data, amount) {
  for (let i = 0; i < data.length; i += 4) {
    const px = i / 4;
    // deterministic per-pixel hash so re-renders are identical
    let hsh = (px * 2654435761) >>> 0;
    hsh ^= hsh >> 13; hsh = (hsh * 1274126177) >>> 0; hsh ^= hsh >> 16;
    const n = (hsh / 4294967295 - 0.5) * 2;
    const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    const a = amount * (1.25 - lum); // shadows get more grain
    data[i] = Math.min(255, Math.max(0, data[i] + n * 255 * a * 0.5));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n * 255 * a * 0.5));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n * 255 * a * 0.5));
  }
}

/**
 * Paint a photo into a canvas of exactly (w, h).
 *
 * img: an HTMLImageElement / canvas (already loaded).
 * presetName: one of PRESETS.
 * opts: {
 *   crop: { x, y, zoom } — pan/zoom in photo fractions (0..1 centre, zoom >= 1),
 *   gentle: boolean — hero treatment (FIX 2): more smoothing, more levels,
 *           weaker ink, softer gradient map,
 *   face: { x, y, rx, ry } — face zone in canvas fractions (ink weakened there),
 *   brighten: number — extra brightness multiplier for the painted result
 *           (used for the SCORE panel, +20%),
 * }
 */
export function paintPhoto(img, w, h, presetName, opts = {}) {
  const preset = PRESETS[presetName] || PRESETS.sunset;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Cover-fit draw with pan/zoom from the crop (photo fractions).
  const crop = opts.crop || { x: 0.5, y: 0.5, zoom: 1 };
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(w / iw, h / ih) * (crop.zoom || 1);
  const dw = iw * base, dh = ih * base;
  const dx = w / 2 - crop.x * dw;
  const dy = h / 2 - crop.y * dh;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, dw, dh);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const levels = opts.gentle ? Math.max(preset.levels, 9) : preset.levels;
  const smoothPasses = opts.gentle ? preset.smooth + 1 : preset.smooth;
  const ink = opts.gentle ? preset.ink * 0.6 : preset.ink;
  const mapAmount = opts.gentle ? Math.min(preset.mapStrength, 0.75) : preset.mapStrength;

  for (let p = 0; p < smoothPasses; p++) boxBlur(data, w, h, 2);
  posterize(data, levels);
  gradientMap(data, preset.stops, mapAmount);

  // FIX 1: Sobel at full resolution — never a downsampled edge field.
  const mag = sobelMagnitude(data, w, h);
  inkPass(data, mag, w, h, preset.inkThreshold, ink, opts.face || null);

  grainPass(data, preset.grain);

  if (opts.brighten && opts.brighten !== 1) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, data[i] * opts.brighten);
      data[i + 1] = Math.min(255, data[i + 1] * opts.brighten);
      data[i + 2] = Math.min(255, data[i + 2] * opts.brighten);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
