// paint.js — "ink and paint" pipeline for SUNSET PRESS.
//
// Turns an ordinary photo into flat painted regions with a thin ink outline,
// all on canvas, no ML. The pipeline is:
//   1. gentle smoothing (a cheap down/up blur) so flat areas read as paint;
//   2. luminance posterize to N levels, with a whisper of dither so the steps
//      never read as contour bands on skin;
//   3. a gradient map (shadows deep violet, mids magenta/coral, highlights
//      peach/gold) blended back with the original photo, so faces stay smooth
//      and readable instead of going flat vector;
//   4. a full-resolution Sobel ink outline (never a quarter-res edge field:
//      that is what made 4x4 block artefacts on faces in an earlier round);
//   5. fine uniform grain only — no halftone dot pattern, so the sky stays
//      clean in the editor preview as well as in the export.
//
// Everything here is written for this round; nothing is copied from an
// earlier build.

// A colour stop: [position 0..1, r, g, b].
function rampAt(stops, t) {
  if (t <= stops[0][0]) return [stops[0][1], stops[0][2], stops[0][3]];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, r0, g0, b0] = stops[i - 1];
      const [t1, r1, g1, b1] = stops[i];
      const f = (t - t0) / (t1 - t0 || 1);
      return [r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f];
    }
  }
  const last = stops[stops.length - 1];
  return [last[1], last[2], last[3]];
}

export const PRESETS = {
  // Warm golden-hour sunset. The default hero grade. Kept gentle: more
  // levels and more of the original photo, so faces stay smooth and the
  // paint reads as a grade, not as flat vector bands.
  sunset: {
    stops: [
      [0.0, 26, 10, 46],
      [0.3, 110, 28, 84],
      [0.55, 214, 58, 92],
      [0.78, 255, 158, 74],
      [1.0, 255, 232, 179],
    ],
    levels: 12,
    photoBlend: 0.36,
    blur: 3,
    ink: 0.22,
    grain: 0.05,
  },
  // Magenta night, for the getaway panel. Brightened so the car stays
  // readable: lighter mids and more of the original photo.
  neonNight: {
    stops: [
      [0.0, 20, 12, 52],
      [0.32, 110, 30, 130],
      [0.58, 235, 60, 150],
      [0.8, 255, 130, 165],
      [1.0, 255, 225, 235],
    ],
    levels: 10,
    photoBlend: 0.38,
    blur: 2,
    ink: 0.26,
    grain: 0.05,
  },
  // Teal dusk, for the score panel. Brightened so the boardwalk, moon and
  // palms read instead of sinking into murk.
  tealDusk: {
    stops: [
      [0.0, 14, 36, 58],
      [0.32, 28, 115, 135],
      [0.58, 60, 180, 175],
      [0.8, 150, 225, 205],
      [1.0, 240, 252, 242],
    ],
    levels: 10,
    photoBlend: 0.38,
    blur: 2,
    ink: 0.22,
    grain: 0.05,
  },
  // Warm crew grade: a little softer, skin stays natural.
  warmCrew: {
    stops: [
      [0.0, 34, 16, 40],
      [0.32, 122, 44, 70],
      [0.58, 222, 96, 84],
      [0.8, 255, 178, 110],
      [1.0, 255, 238, 200],
    ],
    levels: 12,
    photoBlend: 0.42,
    blur: 2,
    ink: 0.2,
    grain: 0.045,
  },
  // Golden hour pushed warmer.
  goldenHour: {
    stops: [
      [0.0, 30, 14, 40],
      [0.3, 124, 52, 66],
      [0.56, 232, 110, 62],
      [0.8, 255, 190, 90],
      [1.0, 255, 240, 196],
    ],
    levels: 12,
    photoBlend: 0.36,
    blur: 3,
    ink: 0.22,
    grain: 0.05,
  },
  // Vice nights: deep purple-pink, high contrast.
  viceNights: {
    stops: [
      [0.0, 22, 10, 48],
      [0.32, 110, 28, 118],
      [0.58, 215, 58, 152],
      [0.8, 255, 110, 170],
      [1.0, 255, 218, 226],
    ],
    levels: 10,
    photoBlend: 0.34,
    blur: 2,
    ink: 0.28,
    grain: 0.055,
  },
};

// Cheap smoothing: draw the image at half size, then back up with smoothing.
// This flattens photo noise into paint-like regions without a blur filter.
function smoothed(img, w, h, passes) {
  const half = document.createElement('canvas');
  half.width = Math.max(2, w >> 1);
  half.height = Math.max(2, h >> 1);
  const hc = half.getContext('2d');
  hc.imageSmoothingEnabled = true;
  hc.imageSmoothingQuality = 'high';
  hc.drawImage(img, 0, 0, half.width, half.height);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const oc = out.getContext('2d');
  oc.imageSmoothingEnabled = true;
  oc.imageSmoothingQuality = 'high';
  for (let i = 0; i < passes; i++) {
    oc.drawImage(half, 0, 0, w, h);
    hc.drawImage(out, 0, 0, half.width, half.height);
  }
  oc.drawImage(half, 0, 0, w, h);
  return out;
}

// Sobel magnitude on a luminance Float32Array, full resolution.
// Returns a Uint8ClampedArray of edge strength (0..255).
function sobelEdges(lum, w, h) {
  const edges = new Uint8ClampedArray(w * h);
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    const up = row - w;
    const dn = row + w;
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -lum[up + x - 1] - 2 * lum[row + x - 1] - lum[dn + x - 1] +
        lum[up + x + 1] + 2 * lum[row + x + 1] + lum[dn + x + 1];
      const gy =
        -lum[up + x - 1] - 2 * lum[up + x] - lum[up + x + 1] +
        lum[dn + x - 1] + 2 * lum[dn + x] + lum[dn + x + 1];
      const m = Math.sqrt(gx * gx + gy * gy);
      edges[row + x] = m > 255 ? 255 : m;
    }
  }
  return edges;
}

// Paint a photo into a canvas of exactly w x h (cover fit, centred on the
// focus point fx/fy in 0..1 of the source image). Returns the canvas.
// `preset` is one of PRESETS (or a compatible object).
export function paintPhoto(img, w, h, preset, fx = 0.5, fy = 0.5) {
  const p = preset;
  // Cover-fit source rect centred on the focus point.
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  let sx = fx * img.naturalWidth - sw / 2;
  let sy = fy * img.naturalHeight - sh / 2;
  sx = Math.max(0, Math.min(img.naturalWidth - sw, sx));
  sy = Math.max(0, Math.min(img.naturalHeight - sh, sy));

  const base = document.createElement('canvas');
  base.width = w;
  base.height = h;
  const bc = base.getContext('2d');
  bc.imageSmoothingEnabled = true;
  bc.imageSmoothingQuality = 'high';
  bc.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

  const smooth = smoothed(base, w, h, p.blur);
  const sc = smooth.getContext('2d');
  const data = sc.getImageData(0, 0, w, h);
  const px = data.data;
  const lum = new Float32Array(w * h);
  const levels = p.levels;
  const blend = p.photoBlend;
  const grainAmt = p.grain * 255;

  // One pass: luminance, dither, posterize, gradient map, blend, grain.
  for (let i = 0, n = w * h; i < n; i++) {
    const o = i * 4;
    const r = px[o];
    const g = px[o + 1];
    const b = px[o + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    lum[i] = l;
    // Dither before quantising: breaks contour bands on skin/sky.
    const dithered = l + (Math.random() - 0.5) * (255 / levels) * 0.9;
    const q = Math.max(0, Math.min(levels - 1, Math.floor((dithered / 256) * levels)));
    const t = (q + 0.5) / levels;
    const [pr, pg, pb] = rampAt(p.stops, t);
    const gr = (Math.random() - 0.5) * grainAmt;
    px[o] = pr + (r - pr) * blend + gr;
    px[o + 1] = pg + (g - pg) * blend + gr;
    px[o + 2] = pb + (b - pb) * blend + gr;
  }
  sc.putImageData(data, 0, 0);

  // Ink outline: full-resolution Sobel, thresholded, drawn as dark lines.
  // The threshold is kept high so only real edges ink in — a low threshold
  // outlines every leaf and freckle and the faces go harsh.
  if (p.ink > 0) {
    const edges = sobelEdges(lum, w, h);
    const threshold = 68;
    const inkData = sc.getImageData(0, 0, w, h);
    const ip = inkData.data;
    const strength = p.ink;
    for (let i = 0, n = w * h; i < n; i++) {
      const e = edges[i];
      if (e > threshold) {
        const o = i * 4;
        const f = Math.min(1, ((e - threshold) / 120) * strength * 2.2);
        ip[o] *= 1 - f * 0.85;
        ip[o + 1] *= 1 - f * 0.85;
        ip[o + 2] *= 1 - f * 0.85;
      }
    }
    sc.putImageData(inkData, 0, 0);
  }
  return smooth;
}
