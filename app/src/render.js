// render.js — SUNSET PRESS layout, compositing and lettering.
//
// One hero photo, full-bleed top to bottom. A slanted three-panel stack
// on one side (never over a face). A huge gold-to-pink wordmark low on
// the poster, with a kicker above and a star/footer line below. Everything
// is drawn fresh per size — each of the three sizes re-lays the poster,
// it never just re-crops.
//
// Layout lessons carried here (from the fix rounds):
//  - Panels NEVER cover a face: the stack is ~27% wide and the hero is
//    reframed per size so the Subject Focus zone clears the stack.
//  - The hero is ONE full photo, no double-face strip above the title,
//    no skyline band splitting it. Sunset backdrop toggle defaults OFF.
//  - Panels are painted at OUTPUT resolution (a low-res paint + upscale
//    blurs half the ink away).
//  - The SCORE panel is brightened +20% so it reads.
//  - Portrait MUST carry a panel strip (FIX 4, Claude round 4 review),
//    and its title sits low (~81.5%) in the dark-clothes zone so the
//    two stacked faces stay clear of it.
//  - No serif anywhere: Anton for the wordmark, Bebas Neue for the
//    small text. Footer text is always "VICE CITY · TONIGHT".

import { paintPhoto } from './paint.js';

export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square 1080×1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080×1350' },
  wide: { w: 1920, h: 1080, label: 'Wide 1920×1080' },
};

export const SAMPLES = [
  { id: 'hero-real', src: 'samples/hero-real.jpg', label: 'Lakeside duo' },
  { id: 'friends-day', src: 'samples/friends-day.jpg', label: 'Friends day' },
  { id: 'group-night', src: 'samples/group-night.jpg', label: 'Group night' },
  { id: 'getaway', src: 'samples/getaway.jpg', label: 'Getaway' },
  { id: 'palm-beach', src: 'samples/palm-beach.jpg', label: 'Palm beach' },
  { id: 'beach-night', src: 'samples/beach-night.jpg', label: 'Beach night' },
  { id: 'hotel-night', src: 'samples/hotel-night.jpg', label: 'Hotel night' },
  { id: 'neon-street', src: 'samples/neon-street.jpg', label: 'Neon street' },
  { id: 'heist-duo', src: 'samples/heist-duo.jpg', label: 'Heist duo' },
  { id: 'selfie-day', src: 'samples/selfie-day.jpg', label: 'Selfie day' },
];

export function defaultState() {
  return {
    hero: 'samples/hero-real.jpg',
    panels: [
      { src: 'samples/friends-day.jpg', label: 'THE CREW', preset: 'sunset', crop: { x: 0.5, y: 0.4, zoom: 1.0 } },
      { src: 'samples/getaway.jpg', label: 'THE GETAWAY', preset: 'neon', crop: { x: 0.5, y: 0.5, zoom: 1.0 } },
      { src: 'samples/palm-beach.jpg', label: 'THE SCORE', preset: 'teal', crop: { x: 0.5, y: 0.5, zoom: 1.0 }, brighten: 1.2 },
    ],
    style: 'sunset',
    title: 'SUNSET HEIST',
    kicker: 'ONE LAST JOB.',
    footer: 'VICE CITY · TONIGHT · SUNSET PRESS',
    stars: '★★★★★',
    // Title baseline as a fraction of canvas height (Title Height slider shifts these).
    titleY: { square: 0.84, portrait: 0.84, wide: 0.84 },
    // Title width as a fraction of the hero (non-panel) width.
    titleFill: { square: 0.86, portrait: 0.88, wide: 0.85 },
    panelsSide: 'auto', // auto | left | right | off
    // Subject Focus ellipse, in photo fractions. Covers both faces of hero-real.
    focus: { x: 0.55, y: 0.42, rx: 0.3, ry: 0.26 },
    size: 'square',
  };
}

/** Panel stack geometry for a size. Returns null when panels are off. */
function stackFor(sizeKey, W, H, state) {
  let side = state.panelsSide;
  if (side === 'auto') side = state.focus.x > 0.5 ? 'left' : 'right';
  if (side === 'off') return null;
  const frac = sizeKey === 'portrait' ? 0.2 : sizeKey === 'wide' ? 0.28 : 0.27;
  const sw = Math.round(W * frac);
  const x = side === 'right' ? W - sw : 0;
  const top = Math.round(H * 0.05);
  const bottom = Math.round(H * 0.7);
  const gap = Math.max(8, Math.round(W * 0.008));
  const n = 3;
  const ph = Math.round((bottom - top - gap * (n - 1)) / n);
  const panels = [];
  for (let i = 0; i < n; i++) {
    panels.push({ x, y: top + i * (ph + gap), w: sw, h: ph });
  }
  return { side, x, w: sw, top, bottom, gap, panels };
}

/**
 * Reframe the hero crop so the focus (face) zone clears the panel stack
 * and stays above the title. Returns a crop { x, y, zoom }.
 * The face centre on canvas is W/2 + (fx - crop.x) * dw, so moving the
 * crop centre moves the face the opposite way; we solve for the crop
 * that puts the face centre in the middle of the free zone.
 */
function reframeHero(sizeKey, W, H, state, imgW, imgH, stack, titleTop) {
  const freeRight = stack ? (stack.side === 'right' ? stack.x : W) : W;
  const freeLeft = stack ? (stack.side === 'left' ? stack.x + stack.w : 0) : 0;
  const freeW = freeRight - freeLeft;
  const freeH = Math.max(120, titleTop - 24);
  // Target: face centre in the middle of the free zone.
  const tx = freeLeft + freeW * 0.5;
  const ty = freeH * 0.52;
  const fx = state.focus.x, fy = state.focus.y;
  const base = Math.max(W / imgW, H / imgH);
  // Face zone width on canvas must fit the free zone; shrink zoom if needed.
  let zoom = 1.06;
  const faceW = 2 * state.focus.rx * imgW * base * zoom;
  const faceH = 2 * state.focus.ry * imgH * base * zoom;
  if (faceW > freeW * 0.92) zoom *= (freeW * 0.92) / faceW;
  if (faceH > freeH * 0.9) zoom *= (freeH * 0.9) / faceH;
  zoom = Math.max(1, Math.min(zoom, 1.35));
  const dw = imgW * base * zoom;
  const dh = imgH * base * zoom;
  let cx = fx - (tx - W / 2) / dw;
  let cy = fy - (ty - H / 2) / dh;
  cx = Math.min(0.92, Math.max(0.08, cx));
  cy = Math.min(0.92, Math.max(0.08, cy));
  return { x: cx, y: cy, zoom };
}

/** Fit a font size so `text` is about `targetW` wide. Returns the size. */
function fitFontSize(ctx, text, family, weight, targetW, start) {
  let lo = 8, hi = start * 2, best = start;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    ctx.font = `${weight} ${mid}px ${family}`;
    const w = ctx.measureText(text).width;
    if (Math.abs(w - targetW) < 1) { best = mid; break; }
    if (w < targetW) { best = mid; lo = mid; } else { hi = mid; }
  }
  return best;
}

/** A slanted panel path (parallelogram shear, ~7 deg). */
function panelPath(ctx, r, shear) {
  ctx.beginPath();
  ctx.moveTo(r.x + shear, r.y);
  ctx.lineTo(r.x + r.w, r.y);
  ctx.lineTo(r.x + r.w - shear, r.y + r.h);
  ctx.lineTo(r.x, r.y + r.h);
  ctx.closePath();
}

/** Pill label drawn at the top of a panel. */
function drawPill(ctx, text, x, y, scale) {
  const fs = Math.max(11, Math.round(20 * scale));
  ctx.font = `400 ${fs}px "Bebas Neue", sans-serif`;
  const padX = Math.round(10 * scale);
  const tw = ctx.measureText(text).width;
  const bw = tw + padX * 2;
  const bh = Math.round(26 * scale);
  ctx.save();
  ctx.fillStyle = 'rgba(12, 6, 24, 0.88)';
  ctx.strokeStyle = 'rgba(255, 214, 140, 0.9)';
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.beginPath();
  ctx.roundRect(x, y, bw, bh, bh / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffe9b0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + bh / 2 + 1);
  ctx.restore();
}

/**
 * Draw the wordmark: gold-to-pink gradient fill, 3-layer dark extrusion,
 * dark outline, neon glow, thin white highlight on the top edge.
 * Returns { top, bottom } in canvas pixels.
 */
function drawTitle(ctx, text, cx, baselineY, targetW, scale) {
  const start = Math.max(40, targetW * 0.55);
  const size = fitFontSize(ctx, text, '"Anton", sans-serif', 400, targetW, start);
  const capH = size * 0.72;
  const top = baselineY - capH;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // Neon glow.
  ctx.shadowColor = 'rgba(255, 80, 160, 0.75)';
  ctx.shadowBlur = Math.max(6, size * 0.22);
  // Extrusion: 3 dark layers offset down-right, drawn first.
  ctx.font = `400 ${size}px "Anton", sans-serif`;
  ctx.fillStyle = '#2a0a2e';
  for (const [ox, oy] of [[size * 0.02, size * 0.03], [size * 0.04, size * 0.06], [size * 0.06, size * 0.09]]) {
    ctx.fillText(text, cx + ox, baselineY + oy);
  }
  // Main gradient fill (gold -> pink, top to bottom).
  const grad = ctx.createLinearGradient(0, top, 0, baselineY + size * 0.06);
  grad.addColorStop(0, '#ffe27a');
  grad.addColorStop(0.45, '#ffb347');
  grad.addColorStop(0.75, '#ff7a9e');
  grad.addColorStop(1, '#ff5e8a');
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, baselineY);
  ctx.shadowBlur = 0;
  // Dark outline.
  ctx.lineWidth = Math.max(2, size * 0.035);
  ctx.strokeStyle = 'rgba(30, 6, 34, 0.95)';
  ctx.strokeText(text, cx, baselineY);
  // Thin white highlight along the top edge of the letters.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top - size * 0.05, ctx.canvas.width, capH * 0.16);
  ctx.clip();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText(text, cx, baselineY - size * 0.015);
  ctx.restore();
  ctx.restore();
  return { top, bottom: baselineY + size * 0.09, size };
}

/**
 * Shared layout + hero-crop computation, used by renderPoster and by the
 * editor (to map a preview click back to photo fractions).
 * `scale` 1 = full export resolution; the preview passes its own scale so
 * every returned coordinate is in the canvas's own pixels.
 * Returns { crop, stack, titleTop, baselineY, heroW, heroCX }.
 */
export function heroCropFor(state, sizeKey, imgW, imgH, scale = 1) {
  const W = Math.round(SIZES[sizeKey].w * scale);
  const H = Math.round(SIZES[sizeKey].h * scale);
  const stack = stackFor(sizeKey, W, H, state);
  const heroW = stack ? (stack.side === 'right' ? stack.x : W - stack.x - stack.w) : W;
  const heroCX = stack ? (stack.side === 'right' ? stack.x / 2 : stack.x + stack.w + heroW / 2) : W / 2;
  const titleTargetW = heroW * state.titleFill[sizeKey];
  const baselineY = Math.round(H * state.titleY[sizeKey]);
  // Title size estimate (same fit as the draw step, at full resolution).
  const probe = document.createElement('canvas').getContext('2d');
  const estSize = fitFontSize(probe, state.title, '"Anton", sans-serif', 400, titleTargetW, Math.max(40, titleTargetW * 0.4));
  const titleTop = baselineY - estSize * 0.72;
  const crop = reframeHero(sizeKey, W, H, state, imgW, imgH, stack, titleTop);
  return { crop, stack, titleTop, baselineY, heroW, heroCX };
}

/** Map a poster point (full-res poster coords) back to photo fractions. */
export function posterToPhoto(state, sizeKey, img, px, py) {
  const { w: W, h: H } = SIZES[sizeKey];
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const { crop } = heroCropFor(state, sizeKey, iw, ih);
  const base = Math.max(W / iw, H / ih) * crop.zoom;
  const dw = iw * base, dh = ih * base;
  const dx = W / 2 - crop.x * dw;
  const dy = H / 2 - crop.y * dh;
  return { x: (px - dx) / dw, y: (py - dy) / dh };
}

/**
 * Render one poster. `images` maps sample src -> loaded HTMLImageElement.
 * `scale` 1 = export resolution; <1 = faster preview.
 * Returns the poster canvas at SIZES[sizeKey] * scale.
 */
export function renderPoster(state, sizeKey, images, scale = 1) {
  const { w: W0, h: H0 } = SIZES[sizeKey];
  const W = Math.round(W0 * scale);
  const H = Math.round(H0 * scale);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d0616';
  ctx.fillRect(0, 0, W, H);

  const heroImg = images[state.hero];
  if (!heroImg) throw new Error(`hero image not loaded: ${state.hero}`);
  const iw = heroImg.naturalWidth || heroImg.width;
  const ih = heroImg.naturalHeight || heroImg.height;

  // --- layout + hero crop (shared with the editor) ------------------------
  const { crop, stack, titleTop, baselineY, heroW, heroCX } = heroCropFor(state, sizeKey, iw, ih, scale);
  const titleTargetW = heroW * state.titleFill[sizeKey];

  // --- hero ---------------------------------------------------------------
  // Face zone in canvas fractions (for the ink-weakening mask).
  const base = Math.max(W / iw, H / ih) * crop.zoom;
  const dw = iw * base, dh = ih * base;
  const faceCX = (W / 2 + (state.focus.x - crop.x) * dw) / W;
  const faceCY = (H / 2 + (state.focus.y - crop.y) * dh) / H;
  const faceRX = (state.focus.rx * dw) / W;
  const faceRY = (state.focus.ry * dh) / H;
  const heroPainted = paintPhoto(heroImg, W, H, 'golden', {
    crop, gentle: true,
    face: { x: faceCX, y: faceCY, rx: faceRX, ry: faceRY },
  });
  ctx.drawImage(heroPainted, 0, 0);

  // --- bottom dark gradient (title legibility), under the panels ---------
  const gradY0 = Math.round(H * 0.58);
  const lg = ctx.createLinearGradient(0, gradY0, 0, H);
  lg.addColorStop(0, 'rgba(10, 4, 20, 0)');
  lg.addColorStop(0.55, 'rgba(10, 4, 20, 0.45)');
  lg.addColorStop(1, 'rgba(10, 4, 20, 0.78)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, gradY0, W, H - gradY0);

  // --- panels -------------------------------------------------------------
  // FIX 3: everything panel-related is clipped to the stack rect, so no
  // stray line (gold or otherwise) can escape into the hero.
  if (stack) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(stack.x, stack.top - 4, stack.w, stack.bottom - stack.top + 8);
    ctx.clip();
    const shear = Math.round(W * 0.012);
    stack.panels.forEach((r, i) => {
      const p = state.panels[i % state.panels.length];
      const img = images[p.src];
      if (!img) return;
      // Painted at OUTPUT resolution (never low-res + upscale).
      const painted = paintPhoto(img, r.w, r.h, p.preset, {
        crop: p.crop || { x: 0.5, y: 0.5, zoom: 1 },
        brighten: p.brighten || 1,
      });
      ctx.save();
      panelPath(ctx, r, shear);
      ctx.clip();
      ctx.drawImage(painted, r.x, r.y);
      // Thin neon gutter: the panel's own top edge.
      ctx.strokeStyle = 'rgba(255, 190, 120, 0.85)';
      ctx.lineWidth = Math.max(1.5, 2.5 * scale);
      ctx.beginPath();
      ctx.moveTo(r.x + shear, r.y);
      ctx.lineTo(r.x + r.w, r.y);
      ctx.stroke();
      ctx.restore();
      drawPill(ctx, p.label, r.x + Math.round(10 * scale), r.y + Math.round(10 * scale), scale);
    });
    ctx.restore();
  }

  // --- title, then kicker on top (so the title's neon glow never hides it) --
  const titleBox = drawTitle(ctx, state.title, heroCX, baselineY, titleTargetW, scale);

  const kickerSize = Math.max(12, Math.round(W * 0.016));
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${kickerSize}px "Bebas Neue", sans-serif`;
  ctx.fillStyle = '#ffe9b0';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = Math.max(3, kickerSize * 0.25);
  ctx.fillText(state.kicker, heroCX, titleBox.top - Math.round(kickerSize * 1.4));
  ctx.restore();

  // Stars + footer.
  const footSize = Math.max(12, Math.round(W * 0.017));
  const starY = baselineY + Math.round(footSize * 2.1);
  const footY = starY + Math.round(footSize * 1.5);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${footSize}px "Bebas Neue", sans-serif`;
  ctx.fillStyle = '#ffd76a';
  ctx.fillText(state.stars, heroCX, starY);
  ctx.fillStyle = '#f5e9ff';
  ctx.font = `400 ${Math.round(footSize * 0.92)}px "Bebas Neue", sans-serif`;
  ctx.fillText(state.footer, heroCX, footY);
  ctx.restore();

  // --- unified final grade: vignette --------------------------------------
  const vg = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  vg.addColorStop(0, 'rgba(10, 4, 20, 0)');
  vg.addColorStop(1, 'rgba(10, 4, 20, 0.32)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  return canvas;
}

/** Render + return a JPEG data URL for a size (used by export + screenshots). */
export function posterDataURL(state, sizeKey, images, quality = 0.92) {
  const canvas = renderPoster(state, sizeKey, images, 1);
  return canvas.toDataURL('image/jpeg', quality);
}
