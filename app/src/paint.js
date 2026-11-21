// paint.js — SUNSET PRESS painted-look pipeline (hand-written canvas, no libraries).
// One photo in, flat "ink and paint" poster art out: smooth, posterize, gradient-map,
// ink outline, grain, vignette. Plus the procedural Vice City sunset backdrop.

export const PRESETS = {
  sunset: {
    label: 'Sunset',
    levels: 7, strength: 0.52, sat: 1.18, bright: 1.04, warm: 0.10,
    stops: [[0, 38, 14, 66], [0.28, 122, 32, 96], [0.55, 216, 74, 110], [0.8, 255, 158, 96], [1, 255, 214, 130]],
  },
  neon: {
    label: 'Neon Night',
    levels: 6, strength: 0.58, sat: 1.28, bright: 1.0, warm: 0.0,
    stops: [[0, 12, 14, 48], [0.3, 96, 26, 128], [0.58, 178, 58, 158], [0.82, 255, 120, 190], [1, 125, 243, 232]],
  },
  teal: {
    label: 'Teal Dusk',
    levels: 7, strength: 0.5, sat: 1.12, bright: 1.03, warm: 0.04,
    stops: [[0, 8, 34, 46], [0.3, 34, 96, 110], [0.58, 64, 142, 138], [0.82, 255, 190, 130], [1, 255, 226, 160]],
  },
  mono: {
    label: 'Mono Pink',
    levels: 6, strength: 0.55, sat: 0.92, bright: 1.05, warm: 0.06,
    stops: [[0, 24, 24, 34], [0.32, 96, 52, 84], [0.6, 168, 92, 122], [0.84, 244, 168, 200], [1, 255, 226, 238]],
  },
};

function lerp(a, b, t) { return a + (b - a) * t; }

function mapStops(stops, t) {
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (t <= b[0]) {
      const k = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
      return [lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)];
    }
  }
  const last = stops[stops.length - 1];
  return [last[1], last[2], last[3]];
}

// Cheap two-pass box blur through a half-size canvas: flattens photo detail into paint regions.
function smoothStep(src, w, h, scale) {
  const sw = Math.max(2, Math.round(w * scale));
  const sh = Math.max(2, Math.round(h * scale));
  const small = document.createElement('canvas');
  small.width = sw; small.height = sh;
  const sctx = small.getContext('2d');
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(src, 0, 0, sw, sh);
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(small, 0, 0, w, h);
  return out;
}

function luminance(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

// Sobel edge strength on a small luminance grid; returns a 0..1 Float32Array.
function edgeField(img, w, h) {
  const d = img.data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = luminance(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) / 255;
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1] + lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1];
      const gy = -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] + lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
      out[i] = Math.min(1, Math.sqrt(gx * gx + gy * gy) * 0.9);
    }
  }
  return out;
}

// Paint a photo (Image/Canvas) into a fresh canvas at w x h with a preset.
// strength 0 = the plain photo, 1 = fully painted.
export function paintPhoto(source, w, h, presetName, strength = 0.5) {
  const preset = PRESETS[presetName] || PRESETS.sunset;
  const s = strength == null ? preset.strength : strength;
  const base = document.createElement('canvas');
  base.width = w; base.height = h;
  const bctx = base.getContext('2d');
  bctx.drawImage(source, 0, 0, w, h);

  // Flatten detail: two smoothing rounds at half and 0.7 scale.
  let flat = smoothStep(base, w, h, 0.5);
  flat = smoothStep(flat, w, h, 0.72);

  const fctx = flat.getContext('2d');
  const img = fctx.getImageData(0, 0, w, h);
  const d = img.data;

  // Edge field at quarter size for speed.
  const ew = Math.max(2, Math.round(w / 4));
  const eh = Math.max(2, Math.round(h / 4));
  const edgeSmall = document.createElement('canvas');
  edgeSmall.width = ew; edgeSmall.height = eh;
  edgeSmall.getContext('2d').drawImage(flat, 0, 0, ew, eh);
  const edgeImg = edgeSmall.getContext('2d').getImageData(0, 0, ew, eh);
  const edges = edgeField(edgeImg, ew, eh);

  const levels = preset.levels;
  const sat = preset.sat, bright = preset.bright, warm = preset.warm;
  // Deterministic grain: a tiny hash per pixel, no Math.random in the loop.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r0 = d[i], g0 = d[i + 1], b0 = d[i + 2];
      const lum = luminance(r0, g0, b0) / 255;
      // Posterize the luminance into flat paint levels.
      const q = Math.min(levels - 1, Math.floor(lum * levels)) / (levels - 1);
      const [mr, mg, mb] = mapStops(preset.stops, q);
      // Painted colour = gradient-mapped, blended toward the photo by (1 - s).
      let r = mr * s + r0 * (1 - s);
      let g = mg * s + g0 * (1 - s);
      let b = mb * s + b0 * (1 - s);
      // Saturation + brightness + a touch of warmth.
      const l2 = luminance(r, g, b);
      r = l2 + (r - l2) * sat;
      g = l2 + (g - l2) * sat;
      b = l2 + (b - l2) * sat;
      r = r * bright + warm * 14;
      g = g * bright;
      b = b * bright - warm * 8;
      // Ink outline: darken where the edge field is strong (sampled from quarter size).
      const ex = Math.min(ew - 1, (x * ew / w) | 0);
      const ey = Math.min(eh - 1, (y * eh / h) | 0);
      const e = edges[ey * ew + ex];
      if (e > 0.28) {
        const ink = Math.min(1, (e - 0.28) * 2.2) * 0.55;
        r *= 1 - ink; g *= 1 - ink; b *= 1 - ink;
      }
      // Grain, stronger in the shadows.
      const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const n = (hash - Math.floor(hash) - 0.5) * 16 * (1 - lum * 0.6);
      r += n; g += n; b += n;
      // Vignette: darken the corners gently.
      const nx = (x / w - 0.5) * 2, ny = (y / h - 0.5) * 2;
      const v = 1 - 0.22 * Math.max(0, nx * nx + ny * ny - 0.55);
      d[i] = Math.max(0, Math.min(255, r * v));
      d[i + 1] = Math.max(0, Math.min(255, g * v));
      d[i + 2] = Math.max(0, Math.min(255, b * v));
    }
  }
  fctx.putImageData(img, 0, 0);
  return flat;
}

// Light unsharp mask: original + amount * (original - blurred).
export function unsharp(canvas, amount, radiusPx) {
  const w = canvas.width, h = canvas.height;
  const blur = document.createElement('canvas');
  blur.width = w; blur.height = h;
  const bctx = blur.getContext('2d');
  bctx.filter = `blur(${radiusPx}px)`;
  bctx.drawImage(canvas, 0, 0);
  const cctx = canvas.getContext('2d');
  const a = cctx.getImageData(0, 0, w, h);
  const b = bctx.getImageData(0, 0, w, h);
  const da = a.data, db = b.data;
  for (let i = 0; i < da.length; i += 4) {
    da[i] = Math.max(0, Math.min(255, da[i] + (da[i] - db[i]) * amount));
    da[i + 1] = Math.max(0, Math.min(255, da[i + 1] + (da[i + 1] - db[i + 1]) * amount));
    da[i + 2] = Math.max(0, Math.min(255, da[i + 2] + (da[i + 2] - db[i + 2]) * amount));
  }
  cctx.putImageData(a, 0, 0);
  return canvas;
}

// Procedural Vice City sunset backdrop: sun disc, banded clouds, palm silhouettes, skyline.
// Drawn once per cover when the Sunset Backdrop toggle is on (default off).
export function drawSunsetBackdrop(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2b1150');
  sky.addColorStop(0.42, '#a83a7c');
  sky.addColorStop(0.68, '#ff7a59');
  sky.addColorStop(1, '#ffc46b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // Sun disc with a soft halo.
  const sx = w * 0.68, sy = h * 0.42, sr = Math.min(w, h) * 0.16;
  const halo = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 2.4);
  halo.addColorStop(0, 'rgba(255, 236, 170, 0.85)');
  halo.addColorStop(1, 'rgba(255, 236, 170, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();
  // Banded clouds: a few soft horizontal bars.
  ctx.fillStyle = 'rgba(255, 150, 120, 0.35)';
  for (let i = 0; i < 5; i++) {
    const cy = h * (0.16 + i * 0.09);
    const cw = w * (0.5 + ((i * 37) % 30) / 100);
    const cx = w * (((i * 53) % 40) / 100);
    ctx.beginPath();
    ctx.ellipse(cx + cw / 2, cy, cw / 2, h * 0.018, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Art-deco skyline along the bottom.
  ctx.fillStyle = '#241033';
  let bx = 0;
  let seed = 7;
  while (bx < w) {
    seed = (seed * 37 + 11) % 97;
    const bw = w * (0.05 + (seed % 9) / 100);
    const bh = h * (0.10 + (seed % 13) / 100);
    ctx.fillRect(bx, h - bh, bw, bh);
    // Neon roof line.
    ctx.fillStyle = '#ff5fa2';
    ctx.fillRect(bx, h - bh, bw, Math.max(2, h * 0.004));
    ctx.fillStyle = '#241033';
    bx += bw + w * 0.008;
  }
  // Two palm silhouettes.
  drawPalm(ctx, w * 0.08, h * 0.98, h * 0.34, '#1c0b2e');
  drawPalm(ctx, w * 0.94, h * 0.99, h * 0.28, '#1c0b2e');
}

function drawPalm(ctx, x, y, size, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(3, size * 0.03);
  ctx.lineCap = 'round';
  // Trunk: a gentle curve.
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + size * 0.06, y - size * 0.55, x - size * 0.04, y - size);
  ctx.stroke();
  // Fronds: seven arcs fanning from the crown.
  const cx = x - size * 0.04, cy = y - size;
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.08 + (i / 6) * 0.84);
    const tx = cx + Math.cos(a) * size * 0.42;
    const ty = cy + Math.sin(a) * size * 0.22 - size * 0.1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + Math.cos(a) * size * 0.22, cy - size * 0.16, tx, ty);
    ctx.stroke();
  }
  // Coconuts.
  ctx.beginPath();
  ctx.arc(cx - size * 0.02, cy + size * 0.03, size * 0.035, 0, Math.PI * 2);
  ctx.arc(cx + size * 0.03, cy + size * 0.04, size * 0.03, 0, Math.PI * 2);
  ctx.fill();
}
