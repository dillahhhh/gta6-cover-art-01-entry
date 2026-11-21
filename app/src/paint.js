// SUNSET PRESS — painted-look pipeline (hand-written canvas, no ML, no library).
//
// One photo in, one painted panel out. The look is "ink and paint": smooth the
// photo into flat regions, posterize its light into a few levels, wash those
// levels through a sunset gradient, lay a thin dark ink line on the strong
// edges, then let a little of the real photo back in so faces stay readable.
// Grain is kept very light on purpose: a clean painted surface, never sandpaper.
//
// Locked render values (round 6, the best build so far): 10 posterize levels,
// gradientMix 0.65, photoBlend 0.2, blur ~3 px at working scale.

const GRADES = {
  // Sunset: deep violet shadows, magenta-coral mids, peach-gold highlights.
  sunset: [
    [0.0, 38, 16, 64],
    [0.25, 94, 32, 96],
    [0.5, 198, 64, 110],
    [0.75, 242, 138, 110],
    [1.0, 255, 214, 140],
  ],
  // Neon Night: colder, more magenta in the mids, electric pink highlights.
  neon: [
    [0.0, 16, 8, 52],
    [0.25, 72, 24, 110],
    [0.5, 168, 48, 150],
    [0.75, 232, 84, 150],
    [1.0, 255, 190, 220],
  ],
  // Teal Dusk: teal shadows, dusty rose mids, pale gold highlights.
  teal: [
    [0.0, 10, 42, 54],
    [0.25, 38, 84, 96],
    [0.5, 150, 96, 116],
    [0.75, 226, 158, 128],
    [1.0, 250, 222, 168],
  ],
  // Golden Hour: warm all the way down, amber shadows, honey highlights.
  golden: [
    [0.0, 58, 26, 30],
    [0.25, 120, 52, 48],
    [0.5, 200, 96, 70],
    [0.75, 240, 158, 96],
    [1.0, 255, 220, 150],
  ],
  // Warm Crew: a deeper, toastier gold than Golden Hour.
  warm: [
    [0.0, 66, 30, 22],
    [0.25, 132, 60, 40],
    [0.5, 208, 110, 66],
    [0.75, 244, 172, 100],
    [1.0, 255, 226, 160],
  ],
  // Vice Nights: indigo shadows, cyan-teal mids, hot pink highlights.
  vice: [
    [0.0, 12, 10, 58],
    [0.25, 46, 44, 128],
    [0.5, 92, 120, 168],
    [0.75, 210, 96, 170],
    [1.0, 255, 120, 190],
  ],
};

const lutCache = new Map();

function gradientLut(stops) {
  const key = stops.map((s) => s.join(',')).join('|');
  if (lutCache.has(key)) return lutCache.get(key);
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let k = 0; k < stops.length - 1; k++) {
      if (t >= stops[k][0] && t <= stops[k + 1][0]) {
        a = stops[k];
        b = stops[k + 1];
        break;
      }
    }
    const span = b[0] - a[0] || 1;
    const f = Math.max(0, Math.min(1, (t - a[0]) / span));
    lut[i * 3] = Math.round(a[1] + (b[1] - a[1]) * f);
    lut[i * 3 + 1] = Math.round(a[2] + (b[2] - a[2]) * f);
    lut[i * 3 + 2] = Math.round(a[3] + (b[3] - a[3]) * f);
  }
  lutCache.set(key, lut);
  return lut;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// Cover-fit framing: the focus point (fx, fy in 0..1 of the photo) lands on the
// canvas centre, then the result is clamped so no edge of the photo shows.
// zoom > 1 crops in; zoom 1 is a plain cover fit.
export function framePhoto(img, w, h, focusX, focusY, zoom) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const s = Math.max(w / iw, h / ih) * (zoom || 1);
  const dw = iw * s;
  const dh = ih * s;
  let dx = w / 2 - focusX * dw;
  let dy = h / 2 - focusY * dh;
  if (dw > w) dx = Math.max(w - dw, Math.min(0, dx));
  else dx = (w - dw) / 2;
  if (dh > h) dy = Math.max(h - dh, Math.min(0, dy));
  else dy = (h - dh) / 2;
  return { dx, dy, dw, dh };
}

// One smoothing pass: draw the canvas down to half size and back up. Two passes
// at working scale read as a ~3 px blur and flatten the photo into paint.
function smoothTwice(src) {
  const half = makeCanvas(Math.max(2, src.width >> 1), Math.max(2, src.height >> 1));
  const hctx = half.getContext('2d', { willReadFrequently: true });
  hctx.imageSmoothingEnabled = true;
  hctx.imageSmoothingQuality = 'high';
  hctx.drawImage(src, 0, 0, half.width, half.height);
  const out = makeCanvas(src.width, src.height);
  const octx = out.getContext('2d', { willReadFrequently: true });
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(half, 0, 0, out.width, out.height);
  return out;
}

// Thin dark ink on the strong edges only. Computed on a small luminance copy so
// it stays fast, drawn back scaled up at low alpha: a line, not a poster edge.
function inkEdges(ctx, w, h, strength) {
  const small = 320;
  const sw = small;
  const sh = Math.max(2, Math.round((small * h) / w));
  const sc = makeCanvas(sw, sh);
  const sctx = sc.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(ctx.canvas, 0, 0, sw, sh);
  const data = sctx.getImageData(0, 0, sw, sh).data;
  const lum = new Float32Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) {
    lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  const edge = makeCanvas(sw, sh);
  const ectx = edge.getContext('2d');
  const out = ectx.createImageData(sw, sh);
  const threshold = 42;
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const i = y * sw + x;
      const gx =
        -lum[i - sw - 1] - 2 * lum[i - 1] - lum[i + sw - 1] +
        lum[i - sw + 1] + 2 * lum[i + 1] + lum[i + sw + 1];
      const gy =
        -lum[i - sw - 1] - 2 * lum[i - sw] - lum[i - sw + 1] +
        lum[i + sw - 1] + 2 * lum[i + sw] + lum[i + sw + 1];
      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag > threshold) {
        const a = Math.min(255, (mag - threshold) * 2.2);
        out.data[i * 4] = 24;
        out.data[i * 4 + 1] = 6;
        out.data[i * 4 + 2] = 44;
        out.data[i * 4 + 3] = a;
      }
    }
  }
  ectx.putImageData(out, 0, 0);
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(edge, 0, 0, w, h);
  ctx.restore();
}

let noiseTile = null;
function grainTile() {
  if (noiseTile) return noiseTile;
  const t = makeCanvas(128, 128);
  const tctx = t.getContext('2d');
  const img = tctx.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) {
    const v = 118 + Math.floor(Math.random() * 20);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  noiseTile = t;
  return t;
}

// Paint one framed photo. Returns a canvas of exactly w x h.
export function paintPhoto(img, w, h, frame, opts = {}) {
  const levels = opts.levels ?? 10;
  const gradientMix = opts.gradientMix ?? 0.65;
  const photoBlend = opts.photoBlend ?? 0.2;
  const ink = opts.ink ?? 0.16;
  const grain = opts.grain ?? 0.035;
  const grade = GRADES[opts.grade ?? 'sunset'] || GRADES.sunset;

  // 1. Frame the photo on the working canvas.
  const work = makeCanvas(w, h);
  const ctx = work.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, frame.dx, frame.dy, frame.dw, frame.dh);
  const framed = makeCanvas(w, h);
  framed.getContext('2d').drawImage(work, 0, 0);

  // 2. Smooth into flat paint regions.
  let painted = smoothTwice(work);
  painted = smoothTwice(painted);

  // 3. Posterize the light into `levels` steps, then wash it through the
  // sunset gradient at gradientMix strength.
  const pctx = painted.getContext('2d', { willReadFrequently: true });
  const image = pctx.getImageData(0, 0, w, h);
  const d = image.data;
  const lut = gradientLut(grade);
  const step = 255 / (levels - 1);
  // Bayer 4x4 ordered dither: nudges each pixel's light up or down by up to
  // half a posterize step before quantizing, so a smooth gradient stays
  // smooth instead of breaking into flat contour bands on skin and sky.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const x = p % w;
    const y = (p / w) | 0;
    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const dither = (BAYER[(x & 3) + ((y & 3) << 2)] - 7.5) * (step / 16);
    const q = Math.round((l + dither) / step) * step;
    const qi = Math.max(0, Math.min(255, Math.round(q)));
    const g = gradientMix;
    d[i] = lut[qi * 3] * g + q * (1 - g);
    d[i + 1] = lut[qi * 3 + 1] * g + q * (1 - g);
    d[i + 2] = lut[qi * 3 + 2] * g + q * (1 - g);
  }
  pctx.putImageData(image, 0, 0);

  // 4. Ink the strong edges, thin and quiet.
  if (ink > 0) inkEdges(pctx, w, h, ink);

  // 5. Let a little of the real photo back in so faces stay readable.
  if (photoBlend > 0) {
    pctx.save();
    pctx.globalAlpha = photoBlend;
    pctx.drawImage(framed, 0, 0);
    pctx.restore();
  }

  // 6. A whisper of grain over the whole surface, nothing more.
  if (grain > 0) {
    pctx.save();
    pctx.globalAlpha = grain;
    pctx.fillStyle = pctx.createPattern(grainTile(), 'repeat');
    pctx.fillRect(0, 0, w, h);
    pctx.restore();
  }

  // 7. A mild lift so panels never read murky: a touch brighter, a touch richer.
  if (opts.brighten || opts.saturate) {
    const lift = makeCanvas(w, h);
    const lctx = lift.getContext('2d');
    lctx.filter = `brightness(${opts.brighten ?? 1.06}) saturate(${opts.saturate ?? 1.1})`;
    lctx.drawImage(painted, 0, 0);
    return lift;
  }
  return painted;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('cannot load ' + src));
    img.src = src;
  });
}
