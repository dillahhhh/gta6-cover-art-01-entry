'use strict';
/* SUNSET PRESS — painted photo pipeline.
 *
 * Turns an ordinary photo into flat painted key-art: a soft smoothing pass,
 * a posterized gradient map, a Sobel ink outline, shadow grain and a rim
 * light. Everything runs on plain 2D canvas, no libraries, no network.
 * Also draws the procedural Vice City sunset backdrop (sky, striped sun,
 * cloud bands, neon skyline, palm silhouettes) — all shapes, no images.
 */

const SP_RAMPS = {
  sunset: ['#1d0b33', '#5b1a5e', '#c22a6b', '#ff6b4a', '#ffb347', '#ffe9a8'],
  neon:   ['#050b2e', '#1b2a6b', '#7a2ea6', '#ff2e88', '#ff7ad9', '#b8f6ff'],
  teal:   ['#041e2b', '#0b4a5e', '#0e8a8a', '#3ec6a7', '#f2d492', '#ffffff'],
  mono:   ['#12060f', '#3d0f2e', '#8a2a5e', '#e0609e', '#ffb3d1', '#ffffff'],
  golden: ['#1c0f04', '#5e2f08', '#b25e14', '#ff9a2a', '#ffd98a', '#fff6d8'],
  vice:   ['#1a0533', '#5b1a8a', '#c22a86', '#ff5e3a', '#ffc93a', '#ffffff'],
};

/* The 6 poster styles. Each one sets the hero ramp, the four panel
 * treatments (one per supporting panel, in order), the neon accent, the
 * title gradient and which backdrop it paints behind the hero. */
const SP_STYLES = {
  sunset: { label: 'Sunset', ramp: 'sunset', panels: ['sunset', 'neon', 'teal', 'mono'],
            accent: '#ff2e88', gutter: '#ff5e9e', titleTop: '#ffe9a8', titleBottom: '#ff2e88',
            sub: '#ffd9ec', backdrop: 'sunset' },
  neon:   { label: 'Neon Night', ramp: 'neon', panels: ['neon', 'vice', 'sunset', 'mono'],
            accent: '#00e5ff', gutter: '#00e5ff', titleTop: '#b8f6ff', titleBottom: '#ff2e88',
            sub: '#c8f4ff', backdrop: 'neon' },
  teal:   { label: 'Teal Dusk', ramp: 'teal', panels: ['teal', 'sunset', 'neon', 'golden'],
            accent: '#2affd5', gutter: '#2affd5', titleTop: '#ffffff', titleBottom: '#0e8a8a',
            sub: '#d8fff4', backdrop: 'teal' },
  mono:   { label: 'Mono Pink', ramp: 'mono', panels: ['mono', 'neon', 'sunset', 'vice'],
            accent: '#ff7ab8', gutter: '#ff7ab8', titleTop: '#ffffff', titleBottom: '#e0609e',
            sub: '#ffd3e6', backdrop: 'mono' },
  golden: { label: 'Golden Hour', ramp: 'golden', panels: ['golden', 'sunset', 'vice', 'teal'],
            accent: '#ffb300', gutter: '#ffb300', titleTop: '#fff6d8', titleBottom: '#ff9a2a',
            sub: '#ffe9bf', backdrop: 'golden' },
  vice:   { label: 'Vice Pop', ramp: 'vice', panels: ['vice', 'neon', 'golden', 'sunset'],
            accent: '#ffea00', gutter: '#ffea00', titleTop: '#ffffff', titleBottom: '#ff5e3a',
            sub: '#fff3b0', backdrop: 'vice' },
};

function spCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function spLoadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('cannot load ' + src));
    img.src = src;
  });
}

/* Hex colour -> [r, g, b]. */
function spHex(rgb) {
  return [parseInt(rgb.slice(1, 3), 16), parseInt(rgb.slice(3, 5), 16), parseInt(rgb.slice(5, 7), 16)];
}

/* Sample a ramp (array of hex stops) at t in [0, 1], linearly. */
function spRampAt(ramp, t) {
  const stops = SP_RAMPS[ramp];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = spHex(stops[i]);
  const b = spHex(stops[i + 1]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/* Draw img to cover (dx, dy, dw, dh) with a crop transform.
 * crop: {x, y} centre in 0..1 of the source, scale >= 1 zoom, rot radians. */
function spCoverDraw(ctx, img, dx, dy, dw, dh, crop) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(dw / iw, dh / ih) * (crop.scale || 1);
  const cx = dx + dw / 2;
  const cy = dy + dh / 2;
  ctx.save();
  ctx.translate(cx, cy);
  if (crop.rot) ctx.rotate(crop.rot);
  ctx.translate(-cx, -cy);
  const sw = iw * base;
  const sh = ih * base;
  const ox = cx - sw / 2 + (0.5 - (crop.x ?? 0.5)) * sw * 0.35;
  const oy = cy - sh / 2 + (0.5 - (crop.y ?? 0.5)) * sh * 0.35;
  ctx.drawImage(img, ox, oy, sw, sh);
  ctx.restore();
}

/* Paint a photo: smoothing, a LIGHT posterized gradient map blended back
 * with the original photo (fix round 2, item 4: ~35% paint so faces keep
 * their detail instead of turning into blobs), ink outline, grain, rim
 * light. Returns a canvas of W x H. */
function spPaintPhoto(img, rampName, W, H, crop, strength) {
  const s = strength == null ? 0.35 : strength;
  const work = spCanvas(W, H);
  const wctx = work.getContext('2d');
  spCoverDraw(wctx, img, 0, 0, W, H, crop || { x: 0.5, y: 0.5, scale: 1, rot: 0 });

  // 1. Smoothing: a soft blur flattens the photo into paint regions.
  const soft = spCanvas(W, H);
  const sctx = soft.getContext('2d');
  sctx.filter = 'blur(2px)';
  sctx.drawImage(work, 0, 0);
  sctx.filter = 'none';

  const src = sctx.getImageData(0, 0, W, H);
  const d = src.data;
  // The smoothed original, kept so the painted result can be blended
  // back toward the photo (item 4): faces keep eyes, mouths, hair.
  const orig = new Uint8ClampedArray(d);
  const n = W * H;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    lum[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  // 2. Sobel edges on the luminance, for the ink outline pass.
  const edge = new Float32Array(n);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = -lum[i - W - 1] - 2 * lum[i - 1] - lum[i + W - 1]
               + lum[i - W + 1] + 2 * lum[i + 1] + lum[i + W + 1];
      const gy = -lum[i - W - 1] - 2 * lum[i - W] - lum[i - W + 1]
               + lum[i + W - 1] + 2 * lum[i + W] + lum[i + W + 1];
      edge[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // 3. Posterize to 9 levels (item 4: 8+ levels keeps facial detail),
  // map through the ramp, ink the edges, grain the shadows, then blend
  // the painted result back toward the original photo at strength s.
  const levels = 9;
  for (let i = 0; i < n; i++) {
    const l = lum[i];
    const q = Math.floor(l * levels) / levels; // posterized level
    const c = spRampAt(rampName, q);
    let r = c[0], g = c[1], b = c[2];
    const e = edge[i];
    if (e > 0.28) { // ink outline: pull strong edges toward near-black
      const k = Math.min(1, (e - 0.28) * 3.2) * 0.85 * s;
      r = r * (1 - k) + 16 * k;
      g = g * (1 - k) + 5 * k;
      b = b * (1 - k) + 16 * k;
    }
    if (l < 0.38) { // halftone-ish grain in the shadows only
      const nz = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 21 - 10.5;
      r += nz; g += nz; b += nz;
    }
    if (rampName === 'golden' && l > 0.45 && l < 0.85) {
      // Skin lives in this band: pull ~15% of the yellow warmth out so
      // faces stay human under the golden grade (fix round, item 9).
      // The sky keeps its gold — it comes from the backdrop, not this ramp.
      const avg = (r + g + b) / 3;
      r = r * 0.85 + avg * 0.15;
      g = g * 0.85 + avg * 0.15;
      b = b * 0.85 + avg * 0.15;
    }
    // Blend: s of paint, (1 - s) of the smoothed original photo, so the
    // result reads as a light painting over a real face, not a blob.
    const m = s;
    d[i * 4] = Math.max(0, Math.min(255, r * m + orig[i * 4] * (1 - m)));
    d[i * 4 + 1] = Math.max(0, Math.min(255, g * m + orig[i * 4 + 1] * (1 - m)));
    d[i * 4 + 2] = Math.max(0, Math.min(255, b * m + orig[i * 4 + 2] * (1 - m)));
  }
  wctx.putImageData(src, 0, 0);

  // 4. Rim light: a soft warm wash from the upper-right (sun side).
  const rim = wctx.createLinearGradient(W, 0, 0, H);
  rim.addColorStop(0, 'rgba(255, 214, 140, 0.20)');
  rim.addColorStop(0.55, 'rgba(255, 214, 140, 0)');
  rim.addColorStop(1, 'rgba(20, 6, 40, 0.10)');
  wctx.globalCompositeOperation = 'screen';
  wctx.fillStyle = rim;
  wctx.fillRect(0, 0, W, H);
  wctx.globalCompositeOperation = 'source-over';
  return work;
}

/* Full-bleed hero mask (fix round 2, longer fade in fix round 3,
 * item 3): the photo fills the hero to all four edges and fades out
 * vertically — opaque to 40% of the height, gone by 62% — so the
 * subjects' heads and shoulders sit over the sunset and the car hood
 * below never shows. The longer fade (was 14% of the height) melts
 * the photo out instead of stepping across a diagonal shoulder.
 * No ellipse, so the hero reads as a poster photo, not a sticker. */
function spHeroMask(w, h) {
  const mask = spCanvas(w, h);
  const ctx = mask.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h * 0.40);
  const fade = ctx.createLinearGradient(0, h * 0.40, 0, h * 0.62);
  fade.addColorStop(0, '#fff');
  fade.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, h * 0.40, w, h * 0.22);
  return mask;
}

/* A feathered ellipse mask canvas (white centre fading to transparent),
 * for the subject-focus cutout. focus: {x, y} in 0..1, rx/ry in pixels. */
function spFocusMask(W, H, focus, rx, ry) {
  const m = spCanvas(W, H);
  const ctx = m.getContext('2d');
  const cx = focus.x * W;
  const cy = focus.y * H;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1);
  // Radial gradients are circular; scale the context to make it elliptical.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  // Fully opaque across 80% of the radius (fix round 3, item 3: the
  // old 92% stop left only an 8% feather, which cut a hard step
  // across the chin where the title breakout dips over the letters),
  // with a 20% feather at the edge so the breakout melts into the
  // title instead of slicing across a face.
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.80, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  return m;
}

/* Seeded pseudo-random, so the backdrop is identical on every render. */
function spRand(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t * 1664525 + 1013904223) >>> 0;
    return t / 4294967296;
  };
}

function spPalm(ctx, x, y, s, lean, colour) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.scale(s, s);
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineCap = 'round';
  // Trunk: a tapering curve.
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.quadraticCurveTo(-2, -60, 4, -96);
  ctx.lineTo(10, -96);
  ctx.quadraticCurveTo(4, -58, 6, 0);
  ctx.closePath();
  ctx.fill();
  // Fronds: arcs drooping from the crown.
  ctx.lineWidth = 5;
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.08 + i * 0.14);
    const ex = Math.cos(a) * 62 * (i % 2 ? 1 : -1);
    const ey = -96 - Math.sin(a) * 26 - 8;
    ctx.beginPath();
    ctx.moveTo(6, -96);
    ctx.quadraticCurveTo(ex * 0.55, -96 - 26, ex, ey + 22);
    ctx.stroke();
  }
  ctx.restore();
}

/* Face zone per sample photo (fix round 2, item 5): the vertical centre
 * of the faces, as a fraction of the photo height, so panel crops frame
 * faces instead of cutting heads. */
const SP_FACE_Y = {
  'samples/selfie-day.jpg': 0.22,
  'samples/friends-day.jpg': 0.10,
  'samples/group-night.jpg': 0.22,
  'samples/heist-duo.jpg': 0.30,
  'samples/beach-night.jpg': 0.5,
  'samples/getaway.jpg': 0.3,
  'samples/hotel-night.jpg': 0.4,
  'samples/neon-street.jpg': 0.4,
  'samples/palm-beach.jpg': 0.5,
};
function spFaceY(src) {
  return SP_FACE_Y[src] == null ? 0.35 : SP_FACE_Y[src];
}

/* (fix round 2, item 2: the painted-sky brushwork is gone — its bands
 * read as glitch stripes on the hero. The sky stays a clean gradient
 * with faint clouds and uniform fine grain from the final grade.) */

/* Procedural Vice City sunset: banded sky, striped sun, cloud bands,
 * art-deco neon skyline, palm silhouettes. Drawn into (x, y, w, h). */
function spDrawBackdrop(ctx, x, y, w, h, presetName) {
  const ramp = SP_RAMPS[presetName] || SP_RAMPS.sunset;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, ramp[0]);
  sky.addColorStop(0.45, ramp[1]);
  sky.addColorStop(0.72, ramp[2]);
  sky.addColorStop(0.92, ramp[3]);
  sky.addColorStop(1, ramp[4]);
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);

  // Striped sun LOW over the skyline (fix round 2, item 3): a high sun
  // sat on the hero's forehead. Down here it reads as a setting sun
  // over the city and can never touch a face.
  const sunR = h * 0.13;
  const sunX = x + w * 0.85;
  const sunY = y + h * 0.70;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 2.2);
  glow.addColorStop(0, 'rgba(255, 214, 140, 0.35)');
  glow.addColorStop(1, 'rgba(255, 214, 140, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - sunR * 2.6, sunY - sunR * 2.6, sunR * 5.2, sunR * 5.2);
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();
  const disc = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  disc.addColorStop(0, '#fff6d8');
  disc.addColorStop(0.55, '#ffb347');
  disc.addColorStop(1, '#ff5e3a');
  ctx.fillStyle = disc;
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
  // Retro stripes cut across the lower half of the disc.
  ctx.fillStyle = ramp[1];
  let sy = sunY + sunR * 0.05;
  let th = sunR * 0.05;
  while (sy < sunY + sunR) {
    ctx.fillRect(sunX - sunR, sy, sunR * 2, th);
    sy += th * 2.4;
    th *= 1.25;
  }
  ctx.restore();

  // Cloud bands: faint now (fix round 2, item 2 — the old 0.20 ellipses
  // read as fog). Five soft clouds, no stripes.
  const rnd = spRand(20261121);
  ctx.fillStyle = 'rgba(255, 170, 190, 0.10)';
  for (let i = 0; i < 5; i++) {
    const cw = w * (0.22 + rnd() * 0.3);
    const cx = x + rnd() * w;
    const cy = y + h * (0.10 + rnd() * 0.42);
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw / 2, h * 0.018, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Art-deco skyline with neon windows, low so it frames the subject
  // instead of cutting across it.
  const base = y + h * 0.90;
  const dark = ramp[0];
  let bx = x;
  const rnd2 = spRand(77);
  while (bx < x + w) {
    const bw = w * (0.05 + rnd2() * 0.07);
    // Taller skyline (fix round 2, item 1): with the hero photo ending
    // at the subjects' chests, the lower hero is city, not empty sky.
    const bh = h * (0.10 + rnd2() * 0.16);
    const deco = rnd2() > 0.6;
    ctx.fillStyle = dark;
    ctx.fillRect(bx, base - bh, bw, bh);
    if (deco) {
      ctx.fillRect(bx + bw * 0.25, base - bh - h * 0.04, bw * 0.5, h * 0.04);
      ctx.fillRect(bx + bw * 0.38, base - bh - h * 0.07, bw * 0.24, h * 0.03);
    }
    // Neon windows.
    const winCols = ['#ff2e88', '#00e5ff', '#ffea00', '#ff9a2a'];
    for (let wy = base - bh + 6; wy < base - 8; wy += 12) {
      for (let wx = bx + 5; wx < bx + bw - 6; wx += 11) {
        if (rnd2() > 0.45) {
          ctx.fillStyle = winCols[Math.floor(rnd2() * winCols.length)];
          ctx.globalAlpha = 0.75;
          ctx.fillRect(wx, wy, 4, 6);
          ctx.globalAlpha = 1;
        }
      }
    }
    bx += bw + 2;
  }
  // Neon horizon line.
  ctx.fillStyle = 'rgba(255, 46, 136, 0.8)';
  ctx.fillRect(x, base, w, 2);

  // Palm silhouettes, small and soft, at the corners only.
  spPalm(ctx, x + w * 0.06, base + h * 0.06, h / 430, -0.12, ramp[1]);
  spPalm(ctx, x + w * 0.95, base + h * 0.06, h / 480, 0.14, ramp[1]);
  ctx.restore();
}
