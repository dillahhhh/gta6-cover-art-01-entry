// render.js — SUNSET PRESS cover engine: layout, hero framing, panels, lettering, export.
// One photo in, a multi-panel GTA-style poster out, in 1080x1080, 1080x1350 and 1920x1080.
import { paintPhoto, unsharp, drawSunsetBackdrop, PRESETS } from './paint.js';

export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square 1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
  wide: { w: 1920, h: 1080, label: 'Wide 1920 × 1080' },
};

// Sample photos bundled under app/samples/. focus = where the faces are (fractions of the photo).
// frame = per-size reframing that keeps faces clear of the panels and the title:
//   fx/fy override the focus point for that size; zoom > 1 crops tighter around it.
export const PHOTOS = {
  'hero-real.jpg': {
    label: 'Lakeside duo (real photo)', focus: { x: 0.6, y: 0.45 },
    frame: {
      square: { zoom: 1, fx: 0.5, fy: 0.44 },
      wide: { zoom: 1.1, fx: 0.63, fy: 0.5 },
      portrait: { zoom: 1, fx: 0.6, fy: 0.5 },
    },
  },
  'heist-duo.jpg': {
    label: 'Heist duo (illustration)', focus: { x: 0.42, y: 0.2 },
    frame: {
      square: { zoom: 1, fx: 0.566, fy: 0.5 },
      wide: { zoom: 1, fx: 0.5, fy: 0.35 },
      portrait: { zoom: 1, fx: 0.5, fy: 0.3 },
    },
  },
  'group-night.jpg': {
    label: 'Group night', focus: { x: 0.5, y: 0.42 },
    frame: {
      square: { zoom: 1, fx: 0.5, fy: 0.42 },
      wide: { zoom: 1, fx: 0.5, fy: 0.42 },
      portrait: { zoom: 1, fx: 0.5, fy: 0.42 },
    },
  },
  'friends-day.jpg': {
    label: 'Friends day', focus: { x: 0.5, y: 0.4 },
    frame: {
      square: { zoom: 1, fx: 0.5, fy: 0.4 },
      wide: { zoom: 1, fx: 0.5, fy: 0.4 },
      portrait: { zoom: 1, fx: 0.5, fy: 0.4 },
    },
  },
  'getaway.jpg': {
    label: 'The getaway', focus: { x: 0.5, y: 0.5 },
    frame: {
      square: { zoom: 1, fx: 0.5, fy: 0.5 },
      wide: { zoom: 1, fx: 0.5, fy: 0.5 },
      portrait: { zoom: 1, fx: 0.5, fy: 0.5 },
    },
  },
  'beach-night.jpg': {
    label: 'Beach night', focus: { x: 0.5, y: 0.5 },
    frame: {
      square: { zoom: 1, fx: 0.5, fy: 0.5 },
      wide: { zoom: 1, fx: 0.5, fy: 0.5 },
      portrait: { zoom: 1, fx: 0.5, fy: 0.5 },
    },
  },
  'hotel-night.jpg': {
    label: 'Hotel night', focus: { x: 0.5, y: 0.45 },
    frame: {
      square: { zoom: 1, fx: 0.5, fy: 0.45 },
      wide: { zoom: 1, fx: 0.5, fy: 0.45 },
      portrait: { zoom: 1, fx: 0.5, fy: 0.45 },
    },
  },
  'palm-beach.jpg': {
    label: 'Palm beach', focus: { x: 0.5, y: 0.45 },
    frame: {
      square: { zoom: 1, fx: 0.5, fy: 0.45 },
      wide: { zoom: 1, fx: 0.5, fy: 0.45 },
      portrait: { zoom: 1, fx: 0.5, fy: 0.45 },
    },
  },
  'neon-street.jpg': {
    label: 'Neon street', focus: { x: 0.5, y: 0.45 },
    frame: {
      square: { zoom: 1, fx: 0.5, fy: 0.45 },
      wide: { zoom: 1, fx: 0.5, fy: 0.45 },
      portrait: { zoom: 1, fx: 0.5, fy: 0.45 },
    },
  },
  'selfie-day.jpg': {
    label: 'Selfie day', focus: { x: 0.5, y: 0.3 },
    frame: {
      square: { zoom: 1, fx: 0.5, fy: 0.3 },
      wide: { zoom: 1, fx: 0.5, fy: 0.3 },
      portrait: { zoom: 1, fx: 0.5, fy: 0.3 },
    },
  },
};

// The three supporting panels: label, photo, paint preset. Labels are brightened (+20%)
// so they stay readable at thumbnail size.
export const PANEL_DEFS = [
  { label: 'THE CREW', photo: 'friends-day.jpg', preset: 'neon' },
  { label: 'THE GETAWAY', photo: 'getaway.jpg', preset: 'sunset' },
  { label: 'THE SCORE', photo: 'beach-night.jpg', preset: 'teal' },
];

export const DEFAULT_STATE = {
  photo: 'hero-real.jpg',
  preset: 'sunset',
  title: 'SUNSET HEIST',
  kicker: 'ONE LAST JOB.',
  subtitle: 'VICE CITY · TONIGHT',
  footer: 'SUNSET PRESS',
  panels: 'auto', // auto | left | right | off
  backdrop: false,
  titleLift: 0, // -100..100, shifts the title band up/down
  size: 'square',
  zoom: 1,
  focus: null, // null = the photo's built-in focus point
};

const imageCache = new Map();
export function loadImage(src) {
  if (!imageCache.has(src)) {
    imageCache.set(src, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('cannot load ' + src));
      img.src = src;
    }));
  }
  return imageCache.get(src);
}

export async function waitForFonts() {
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('100px "Bebas Neue"'),
      document.fonts.load('16px "Bebas Neue"'),
    ]);
    await document.fonts.ready;
  } catch { /* fonts fall back to sans-serif; the cover still renders */ }
}

// Cover-fit source window for an image of iw x ih drawn into a cw x ch rect,
// centred on (fx, fy) with a zoom. Returns photo-pixel {sx, sy, sw, sh}, clamped.
export function coverWindow(iw, ih, cw, ch, fx, fy, zoom) {
  const scale = Math.max(cw / iw, ch / ih) * (zoom || 1);
  let sw = cw / scale;
  let sh = ch / scale;
  if (sw > iw) { sw = iw; sh = sw * (ch / cw); }
  if (sh > ih) { sh = ih; sw = sh * (cw / ch); }
  let sx = fx * iw - sw / 2;
  let sy = fy * ih - sh / 2;
  sx = Math.max(0, Math.min(iw - sw, sx));
  sy = Math.max(0, Math.min(ih - sh, sy));
  return { sx, sy, sw, sh };
}

// Which side the panel stack goes on. Auto puts it opposite the faces; when the
// faces sit in the middle (group shots) it turns the panels off instead of covering one.
export function resolvePanels(state) {
  if (state.panels === 'off') return null;
  if (state.panels === 'left') return 'left';
  if (state.panels === 'right') return 'right';
  const meta = PHOTOS[state.photo] || PHOTOS['hero-real.jpg'];
  const fx = (state.focus && state.focus.x) ?? meta.focus.x;
  if (fx > 0.55) return 'left';
  if (fx < 0.45) return 'right';
  return null;
}

// Layout numbers for one size. All fractions of the canvas.
export function layoutFor(sizeName, panelsSide) {
  const { w, h } = SIZES[sizeName];
  const panelFrac = sizeName === 'square' ? 0.27 : sizeName === 'wide' ? 0.28 : 0.2;
  const titleY = sizeName === 'square' ? 0.7 : sizeName === 'wide' ? 0.78 : 0.815;
  const titleFill = sizeName === 'square' ? 0.72 : sizeName === 'wide' ? 0.5 : 0.86;
  return {
    w, h,
    panelW: panelsSide ? Math.round(w * panelFrac) : 0,
    side: panelsSide,
    titleY, titleFill,
    gutter: Math.max(4, Math.round(w * 0.005)),
    labelH: Math.max(18, Math.round(h * 0.026)),
  };
}

function fitFont(ctx, text, fontFamily, maxWidth, startPx) {
  let px = startPx;
  ctx.font = `${px}px ${fontFamily}`;
  while (px > 24 && ctx.measureText(text).width > maxWidth) {
    px = Math.max(24, Math.round(px * 0.94));
    ctx.font = `${px}px ${fontFamily}`;
  }
  return px;
}

// The big wordmark: gold-to-pink gradient, three-layer hard extrusion, dark outline,
// neon glow, thin white top highlight.
function drawTitle(ctx, text, cx, topY, maxWidth, canvasW) {
  const startPx = Math.round(canvasW * 0.17);
  const px = fitFont(ctx, text, 'Anton, "Arial Narrow", sans-serif', maxWidth, startPx);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // Neon glow.
  ctx.shadowColor = 'rgba(255, 95, 162, 0.85)';
  ctx.shadowBlur = Math.round(px * 0.16);
  ctx.font = `${px}px Anton, "Arial Narrow", sans-serif`;
  ctx.fillStyle = '#ffd166';
  ctx.fillText(text, cx, topY);
  ctx.shadowBlur = 0;
  // Hard extrusion, three layers down-right.
  const layers = ['#3a0a2e', '#2a0830', '#1c0626'];
  layers.forEach((color, i) => {
    const off = Math.round(px * 0.012 * (i + 1));
    ctx.fillStyle = color;
    ctx.fillText(text, cx + off, topY + off);
  });
  // Main gradient fill.
  const grad = ctx.createLinearGradient(0, topY, 0, topY + px);
  grad.addColorStop(0, '#ffe9a8');
  grad.addColorStop(0.45, '#ffd166');
  grad.addColorStop(0.75, '#ff7a9e');
  grad.addColorStop(1, '#ff5fa2');
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, topY);
  // Dark outline.
  ctx.lineWidth = Math.max(2, Math.round(px * 0.02));
  ctx.strokeStyle = '#1c0626';
  ctx.strokeText(text, cx, topY);
  // White top highlight: the same text in white, shifted up two pixels, overdrawn
  // by the gradient fill shifted down — only the top edge stays white.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fillText(text, cx, topY - Math.max(2, Math.round(px * 0.02)));
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, topY + Math.max(1, Math.round(px * 0.012)));
  ctx.restore();
  return { px, bottom: topY + px * 1.08 };
}

function drawPillLabel(ctx, text, x, y, maxW, h) {
  ctx.save();
  ctx.font = `${Math.round(h * 0.52)}px "Bebas Neue", "Arial Narrow", sans-serif`;
  const tw = Math.min(maxW - 12, ctx.measureText(text).width + 18);
  const bx = x + (maxW - tw) / 2;
  ctx.fillStyle = 'rgba(12, 8, 24, 0.88)';
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 1.5;
  const r = h * 0.5;
  ctx.beginPath();
  ctx.roundRect(bx, y, tw, h, r);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
  ctx.shadowBlur = 4;
  ctx.fillText(text, bx + tw / 2, y + h / 2 + 1);
  ctx.restore();
}

// One supporting panel: painted photo, slanted cut, neon gutter, bright pill label.
async function drawPanel(ctx, def, rect, slant, state) {
  const img = await loadImage('samples/' + def.photo);
  const painted = paintPhoto(img, Math.max(8, rect.w), Math.max(8, rect.h), def.preset, 0.45);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(rect.x + slant, rect.y);
  ctx.lineTo(rect.x + rect.w, rect.y);
  ctx.lineTo(rect.x + rect.w - slant, rect.y + rect.h);
  ctx.lineTo(rect.x, rect.y + rect.h);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(painted, rect.x, rect.y, rect.w, rect.h);
  // A little extra grade over the panel so it reads painted, not pasted.
  ctx.fillStyle = 'rgba(255, 95, 162, 0.06)';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  // Neon edge on the panel's inner side.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rect.x + slant, rect.y);
  ctx.lineTo(rect.x, rect.y + rect.h);
  ctx.stroke();
  ctx.restore();
  // The label is drawn later, after the title, so it can be moved clear of it.
}

function drawFooter(ctx, state, w, h, titleBottom) {
  const cy = h - Math.round(h * 0.028);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(h * 0.02)}px "Bebas Neue", "Arial Narrow", sans-serif`;
  ctx.fillStyle = '#ffd166';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 4;
  ctx.fillText('★ ★ ★ ★ ★', w / 2, cy - Math.round(h * 0.032));
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(h * 0.024)}px "Bebas Neue", "Arial Narrow", sans-serif`;
  ctx.fillText(`${state.subtitle}   ·   ${state.footer}`, w / 2, cy);
  ctx.restore();
  return titleBottom;
}

// Render one cover into ctx at the given size. Returns the layout used.
export async function drawCover(ctx, state, sizeName) {
  const side = resolvePanels(state);
  const L = layoutFor(sizeName, side);
  const { w, h } = L;
  const meta = PHOTOS[state.photo] || PHOTOS['hero-real.jpg'];
  const frame = (meta.frame && meta.frame[sizeName]) || { zoom: 1, fx: meta.focus.x, fy: meta.focus.y };
  const fx = (state.focus && state.focus.x) ?? frame.fx;
  const fy = (state.focus && state.focus.y) ?? frame.fy;
  const zoom = (state.zoom || 1) * (frame.zoom || 1);

  // Backdrop first when the toggle is on; the hero sits inside a feathered ellipse on it.
  if (state.backdrop) drawSunsetBackdrop(ctx, w, h);

  const heroImg = await loadImage('samples/' + state.photo);
  const painted = paintPhoto(heroImg, w, h, state.preset, PRESETS[state.preset].strength);
  if (sizeName === 'portrait') unsharp(painted, 0.4, 1.2);

  if (state.backdrop) {
    // Feathered subject-focus mask: the painted hero shows through an ellipse
    // centred on the focus point; the backdrop shows around it.
    const mask = document.createElement('canvas');
    mask.width = w; mask.height = h;
    const mctx = mask.getContext('2d');
    const ex = fx * w, ey = fy * h;
    const grad = mctx.createRadialGradient(ex, ey, 0, ex, ey, Math.max(w, h) * 0.62);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.72, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    mctx.fillStyle = grad;
    mctx.fillRect(0, 0, w, h);
    const heroCut = document.createElement('canvas');
    heroCut.width = w; heroCut.height = h;
    const hctx = heroCut.getContext('2d');
    const win = coverWindow(painted.width, painted.height, w, h, fx, fy, zoom);
    hctx.drawImage(painted, win.sx, win.sy, win.sw, win.sh, 0, 0, w, h);
    hctx.globalCompositeOperation = 'destination-in';
    hctx.drawImage(mask, 0, 0);
    ctx.drawImage(heroCut, 0, 0);
  } else {
    const win = coverWindow(painted.width, painted.height, w, h, fx, fy, zoom);
    ctx.drawImage(painted, win.sx, win.sy, win.sw, win.sh, 0, 0, w, h);
  }

  // Supporting panels down the chosen side. Labels are collected here and
  // drawn after the title, so a label never hides behind the wordmark.
  const panelLabels = [];
  if (side) {
    const px = side === 'left' ? 0 : w - L.panelW;
    const gap = L.gutter;
    const n = PANEL_DEFS.length;
    const totalH = h;
    const eachH = Math.round((totalH - gap * (n - 1)) / n);
    const slant = Math.round(L.panelW * 0.16);
    for (let i = 0; i < n; i++) {
      const rect = { x: px, y: i * (eachH + gap), w: L.panelW, h: eachH };
      await drawPanel(ctx, PANEL_DEFS[i], rect, i % 2 === 0 ? slant : -slant, state);
      panelLabels.push({ def: PANEL_DEFS[i], rect });
    }
  }

  // Dark legibility gradient under the title band.
  const titleTop = Math.round(h * (L.titleY + (state.titleLift || 0) * 0.00035));
  const grad = ctx.createLinearGradient(0, titleTop - h * 0.14, 0, h);
  grad.addColorStop(0, 'rgba(8, 4, 18, 0)');
  grad.addColorStop(0.45, 'rgba(8, 4, 18, 0.55)');
  grad.addColorStop(1, 'rgba(8, 4, 18, 0.88)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, titleTop - h * 0.14, w, h - (titleTop - h * 0.14));

  // Kicker above the title, title, then the footer row.
  const kickerY = titleTop - Math.round(h * 0.03);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${Math.round(h * 0.026)}px "Bebas Neue", "Arial Narrow", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  const kicker = state.kicker || '';
  if (kicker) ctx.fillText(kicker.split('').join(' '), w / 2, kickerY);
  ctx.restore();

  const titleMax = Math.round(w * L.titleFill);
  const drawn = drawTitle(ctx, state.title || 'SUNSET HEIST', w / 2, titleTop, titleMax, w);
  // Panel labels, on top of everything: a label whose pill would cross the
  // wordmark is slid down to just below it, still inside its own panel.
  const titleRect = { x0: w / 2 - titleMax / 2, x1: w / 2 + titleMax / 2, y0: titleTop, y1: drawn.bottom };
  for (const { def, rect } of panelLabels) {
    const lh = Math.max(18, Math.round(rect.h * 0.09));
    let ly = rect.y + Math.round(rect.h * 0.06);
    ctx.save();
    ctx.font = `${Math.round(lh * 0.52)}px "Bebas Neue", "Arial Narrow", sans-serif`;
    const tw = Math.min(rect.w - 12, ctx.measureText(def.label).width + 18);
    ctx.restore();
    const lx0 = rect.x + (rect.w - tw) / 2;
    const lx1 = lx0 + tw;
    const hitsTitle = lx1 > titleRect.x0 && lx0 < titleRect.x1 && ly + lh > titleRect.y0 && ly < titleRect.y1;
    if (hitsTitle) ly = Math.min(titleRect.y1 + 14, rect.y + rect.h - lh - 8);
    drawPillLabel(ctx, def.label, rect.x, ly, rect.w, lh);
  }
  drawFooter(ctx, state, w, h, drawn.bottom);
  return L;
}

// Render a cover at its exact export size into a fresh canvas.
export async function renderCover(state, sizeName) {
  await waitForFonts();
  const { w, h } = SIZES[sizeName];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  await drawCover(ctx, state, sizeName);
  return canvas;
}

// Export one size as a PNG download. Returns the blob for tests.
export async function exportCover(state, sizeName) {
  const canvas = await renderCover(state, sizeName);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sunset-press-${SIZES[sizeName].w}x${SIZES[sizeName].h}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return blob;
}

export async function exportAllSizes(state) {
  const out = {};
  for (const name of Object.keys(SIZES)) {
    out[name] = await exportCover(state, name);
  }
  return out;
}
