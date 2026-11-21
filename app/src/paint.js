// paint.js — the "ink and paint" pipeline for SUNSET PRESS.
// Turns an ordinary photo into flat painted key art, entirely on canvas.
// Bar: BETTER than fix 9 (Ting 9.4/10). The hero must be smooth AND
// detailed, the panels genuinely readable — not merely "not broken".
// Rules learned the hard way:
//  - Ink (Sobel) is computed at FULL resolution; never downsample the edge
//    field (that made 4x4px blocks in round 4).
//  - Posterize with enough levels (13-14) plus ordered dithering, so skin
//    does not band into contour stripes ("poster edges").
//  - Blend a lot of the original photo back in, so faces and cars stay
//    readable instead of turning into purple mush.

export const PAINT_LEVELS = 10;
export const HERO_LEVELS = 10;

// Sunset gradient stops: luminance 0..1 -> [r, g, b].
const SUNSET_STOPS = [
  [0.0, 26, 11, 46], // deep violet shadow
  [0.22, 91, 26, 94], // purple
  [0.42, 194, 39, 94], // magenta
  [0.62, 255, 107, 74], // coral
  [0.82, 255, 179, 71], // peach gold
  [1.0, 255, 233, 168], // pale gold highlight
];

const NEON_STOPS = [
  [0.0, 16, 8, 48],
  [0.25, 72, 18, 110],
  [0.45, 168, 32, 140],
  [0.65, 255, 64, 160],
  [0.85, 255, 150, 200],
  [1.0, 255, 220, 240],
];

const TEAL_STOPS = [
  [0.0, 6, 32, 44],
  [0.25, 14, 90, 110],
  [0.45, 32, 150, 150],
  [0.65, 120, 200, 180],
  [0.85, 255, 200, 120],
  [1.0, 255, 240, 190],
];

export const GRADES = {
  // gradientMix = how much of the sunset gradient shows; photoBlend = how
  // much raw (unposterized) photo is mixed back for smoothness. The
  // original colour is posterized too — that is what makes the flat paint
  // bands visible. Fix 9's hero reads as paint because its levels are few
  // and its grade is strong; round 6 v1/v2 used 13-14 levels and read as a
  // plain photo. 10 levels + ordered dithering + a touch more blur keeps
  // the bands soft (paint, not contour lines) while making them visible.
  sunset: { stops: SUNSET_STOPS, gradientMix: 0.65, photoBlend: 0.2, ink: 0.45, brightness: 1.0, blur: 3 },
  crew: { stops: SUNSET_STOPS, gradientMix: 0.55, photoBlend: 0.25, ink: 0.4, brightness: 1.02, blur: 2 },
  neonNight: { stops: NEON_STOPS, gradientMix: 0.55, photoBlend: 0.25, ink: 0.38, brightness: 1.06, blur: 2 },
  tealDusk: { stops: TEAL_STOPS, gradientMix: 0.5, photoBlend: 0.25, ink: 0.4, brightness: 1.15, blur: 2 },
};

// 4x4 Bayer matrix for ordered dithering (breaks posterize banding).
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function gradientColor(stops, lum) {
  for (let i = 1; i < stops.length; i++) {
    if (lum <= stops[i][0]) {
      const [l0, r0, g0, b0] = stops[i - 1];
      const [l1, r1, g1, b1] = stops[i];
      const t = (lum - l0) / Math.max(1e-6, l1 - l0);
      return [r0 + (r1 - r0) * t, g0 + (g1 - g0) * t, b0 + (b1 - b0) * t];
    }
  }
  const last = stops[stops.length - 1];
  return [last[1], last[2], last[3]];
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// Draw an image cover-fit into a box, with pan (0..1, 0.5 = centred) and zoom.
export function drawCoverFit(ctx, img, x, y, w, h, panX = 0.5, panY = 0.5, zoom = 1) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) * panX;
  const dy = y + (h - dh) * panY;
  ctx.drawImage(img, dx, dy, dw, dh);
}

// Light smoothing pass: a small blur flattens sensor noise into paint.
function smoothCanvas(src, blurPx) {
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.filter = `blur(${blurPx}px)`;
  ctx.drawImage(src, 0, 0);
  ctx.filter = 'none';
  return c;
}

// One per-pixel pass: posterize + gradient map + blend original + grain.
// The ORIGINAL colour is posterized too (with dithering) — that is what
// makes the flat paint bands visible. Mixing the gradient with an
// unposterized original washes the paint out entirely (round 6 v1 looked
// like a plain photo). Only a little raw photo is blended back, to soften
// the bands without erasing them.
function paintPixels(canvas, original, grade, levels) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, w, h);
  const orig = original.getContext('2d').getImageData(0, 0, w, h);
  const d = img.data;
  const o = orig.data;
  const gm = grade.gradientMix;
  const pb = grade.photoBlend;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // Ordered dither: nudges the value before quantizing so flat skin
      // becomes fine grain instead of hard contour bands.
      const dither = (BAYER4[y & 3][x & 3] - 7.5) / 16;
      // Posterized original colour (the paint's flat regions).
      const rq = Math.round((o[i] / 255) * (levels - 1) + dither) / (levels - 1) * 255;
      const gq = Math.round((o[i + 1] / 255) * (levels - 1) + dither) / (levels - 1) * 255;
      const bq = Math.round((o[i + 2] / 255) * (levels - 1) + dither) / (levels - 1) * 255;
      const lum = (0.2126 * rq + 0.7152 * gq + 0.0722 * bq) / 255;
      const [gr, gg, gb] = gradientColor(grade.stops, lum);
      // Posterized original mixed with the sunset gradient colour.
      let r = rq * (1 - gm) + gr * gm;
      let g = gq * (1 - gm) + gg * gm;
      let b = bq * (1 - gm) + gb * gm;
      // A little raw photo back in: softens the bands, keeps faces smooth.
      r = r * (1 - pb) + o[i] * pb;
      g = g * (1 - pb) + o[i + 1] * pb;
      b = b * (1 - pb) + o[i + 2] * pb;
      // Brightness lift (the teal SCORE panel needs it to read).
      r = Math.min(255, r * grade.brightness);
      g = Math.min(255, g * grade.brightness);
      b = Math.min(255, b * grade.brightness);
      // Light grain, shadows only.
      const grain = (Math.random() - 0.5) * 10 * (1 - lum);
      d[i] = Math.max(0, Math.min(255, r + grain));
      d[i + 1] = Math.max(0, Math.min(255, g + grain));
      d[i + 2] = Math.max(0, Math.min(255, b + grain));
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Sobel ink at FULL resolution. `face` weakens ink inside the face ellipse
// (feathered edge) so faces keep soft features instead of harsh outlines.
function inkPass(canvas, smoothed, grade, face) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const lum = new Float32Array(w * h);
  const sdata = smoothed.getContext('2d').getImageData(0, 0, w, h).data;
  for (let i = 0; i < w * h; i++) {
    lum[i] = (0.2126 * sdata[i * 4] + 0.7152 * sdata[i * 4 + 1] + 0.0722 * sdata[i * 4 + 2]) / 255;
  }
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const strength = grade.ink;
  const threshold = 0.09;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1] +
        lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1];
      const gy =
        -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] +
        lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
      const mag = Math.sqrt(gx * gx + gy * gy) / 4;
      if (mag <= threshold) continue;
      let alpha = Math.min(1, (mag - threshold) / 0.35) * strength;
      // Weaken ink inside the face ellipse (feathered).
      if (face) {
        const nx = (x - face.x) / face.rx;
        const ny = (y - face.y) / face.ry;
        const dist = nx * nx + ny * ny;
        if (dist < 1) {
          const feather = Math.min(1, (1 - dist) / 0.25 + 0.15);
          alpha *= 0.3 + 0.7 * (1 - feather);
        }
      }
      const p = i * 4;
      const keep = 1 - alpha * 0.85;
      d[p] *= keep;
      d[p + 1] *= keep;
      d[p + 2] *= keep;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Subtle vignette: darkens the corners so the poster feels finished.
function vignette(canvas, strength = 0.16) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.45,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(10,4,20,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// The full pipeline: img -> painted canvas of size w x h.
// opts: { grade, levels, panX, panY, zoom, face, blur, vignette }
export function paintPhoto(img, w, h, opts = {}) {
  const grade = opts.grade || GRADES.sunset;
  const levels = opts.levels || PAINT_LEVELS;
  const out = makeCanvas(w, h);
  const octx = out.getContext('2d');
  // 1. Original, cover-fit (kept for blending).
  const original = makeCanvas(w, h);
  const orgCtx = original.getContext('2d');
  drawCoverFit(orgCtx, img, 0, 0, w, h, opts.panX ?? 0.5, opts.panY ?? 0.5, opts.zoom ?? 1);
  // 2. Smoothed copy (a touch more blur for the hero softens the posterize
  //    bands into paint instead of hard contour lines).
  const smoothed = smoothCanvas(original, opts.blur ?? grade.blur ?? 2);
  octx.drawImage(smoothed, 0, 0);
  // 3. Posterize + gradient + blend + grain.
  paintPixels(out, original, grade, levels);
  // 4. Ink at full resolution.
  inkPass(out, smoothed, grade, opts.face || null);
  // 5. Vignette.
  if (opts.vignette !== false) vignette(out, opts.vignette ?? 0.16);
  return out;
}
