// render.js — layout engine + cover renderer for SUNSET PRESS.
// The hero is FULL-BLEED (edge to edge, no dark column, no letterbox band).
// A three-panel stack sits on top of the hero, clipped to its own rect.
// The title is a huge gold-to-pink wordmark; it overlaps the hero's lower
// body, never a face. Every size is re-laid out, not re-cropped.

import { paintPhoto, drawCoverFit, GRADES, HERO_LEVELS, PAINT_LEVELS } from './paint.js';

export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
};

// Layout per size. titleY = top of the title as a fraction of canvas height.
// titleW = title width as a fraction of canvas width; cx = title centre.
// heroPan positions the hero photo so both faces sit clear of the panel
// stack (left) and the title (bottom). Tune by looking, not by guessing.
const LAYOUT = {
  square: {
    stackW: 0.24, stackTop: 0.03, stackBottom: 0.60,
    titleY: 0.80, titleW: 0.64, cx: 0.62, kickerGap: 0.035,
    hero: { panX: 0.85, panY: 0.5, zoom: 1.0 },
    face: { x: 0.62, y: 0.38, rx: 0.28, ry: 0.30 },
  },
  portrait: {
    stackW: 0.22, stackTop: 0.03, stackBottom: 0.58,
    titleY: 0.80, titleW: 0.64, cx: 0.60, kickerGap: 0.035,
    hero: { panX: 0.80, panY: 0.5, zoom: 1.0 },
    face: { x: 0.60, y: 0.35, rx: 0.30, ry: 0.28 },
  },
  wide: {
    stackW: 0.27, stackTop: 0.03, stackBottom: 0.60,
    // Wide is short: a width-fit title overflows the bottom, so the title
    // is narrower here and sits a touch higher, centred left of the
    // "Blessed" print on the shirt so the kicker never collides with it.
    titleY: 0.76, titleW: 0.58, cx: 0.55, kickerGap: 0.035,
    hero: { panX: 0.5, panY: 0.45, zoom: 1.0 },
    face: { x: 0.68, y: 0.35, rx: 0.25, ry: 0.32 },
  },
};

const PANELS = [
  { label: 'THE CREW', src: 'samples/friends-day.jpg', grade: 'crew', panY: 0.32 },
  { label: 'THE GETAWAY', src: 'samples/getaway.jpg', grade: 'neonNight', panY: 0.5 },
  // beach-night: a rich neon boardwalk (pink/teal, moon, palms) — a real
  // scene, not the flat vector sunset palm-beach was.
  { label: 'THE SCORE', src: 'samples/beach-night.jpg', grade: 'tealDusk', panY: 0.4 },
];

const HERO_SRC = 'samples/hero-real.jpg';
const TITLE_TEXT = 'SUNSET HEIST';
const KICKER_TEXT = 'ONE LAST JOB.';
const FOOTER_TEXT = 'VICE CITY · TONIGHT · SUNSET PRESS';

const imageCache = new Map();

export function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('cannot load ' + src));
    img.src = src;
  });
  imageCache.set(src, p);
  return p;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
}

// A slanted panel path: rectangle with the right edge sheared ~7 degrees.
function panelPath(ctx, x, y, w, h, slant) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - slant, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

// Pill label (dark chip, white condensed text) at a panel's top-left.
function drawPill(ctx, x, y, text, fontPx) {
  ctx.save();
  ctx.font = `${fontPx}px "Bebas Neue", sans-serif`;
  const tw = ctx.measureText(text).width;
  const padX = fontPx * 0.45;
  const padY = fontPx * 0.28;
  const bw = tw + padX * 2;
  const bh = fontPx + padY * 2;
  ctx.fillStyle = 'rgba(12,4,24,0.88)';
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1, fontPx * 0.06);
  const r = bh / 2;
  ctx.beginPath();
  ctx.roundRect(x, y, bw, bh, r);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, x + padX, y + bh / 2 + fontPx * 0.03);
  ctx.restore();
}

// The wordmark: gold-to-pink gradient, 3-layer extrusion, dark outline,
// neon glow, white top highlight. Sized to fill `targetW` of the canvas,
// then clamped so the title + extrusion + footer always fit inside the
// canvas (a width-fit title overflows the bottom on the short wide size).
function drawTitle(ctx, text, cx, topY, targetW, scale, canvasH) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // Fit the font size to the target width.
  let size = 200 * scale;
  ctx.font = `${size}px Anton, sans-serif`;
  const w0 = ctx.measureText(text).width;
  size = size * (targetW / Math.max(1, w0));
  // Clamp by the vertical room left: title + extrusion + stars + footer.
  // The reserve covers both footer lines so nothing is clipped at the
  // canvas bottom (round 6 v3 clipped the footer in wide).
  const maxSize = (canvasH - topY - canvasH * 0.10) / 1.15;
  size = Math.min(size, maxSize);
  ctx.font = `${size}px Anton, sans-serif`;
  const grad = ctx.createLinearGradient(0, topY, 0, topY + size * 1.05);
  grad.addColorStop(0, '#FFE9A8');
  grad.addColorStop(0.35, '#FFD34D');
  grad.addColorStop(0.7, '#FF7A6B');
  grad.addColorStop(1, '#FF5E8A');
  const ex = Math.max(2, 6 * scale);
  const ey = Math.max(2, 7 * scale);
  // Extrusion layers (dark, offset down-right).
  ctx.fillStyle = '#2A0A3A';
  for (let i = 3; i >= 1; i--) {
    ctx.fillText(text, cx + ex * i, topY + size + ey * i);
  }
  // Neon glow behind the letters.
  ctx.shadowColor = 'rgba(255,94,138,0.85)';
  ctx.shadowBlur = 22 * scale;
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, topY + size);
  ctx.shadowBlur = 0;
  // Dark outline.
  ctx.lineWidth = Math.max(2, 5 * scale);
  ctx.strokeStyle = '#1A0B2E';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, cx, topY + size);
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, topY + size);
  // Thin white highlight along the top edge of the letters.
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.strokeStyle = '#FFF6D8';
  ctx.strokeText(text, cx, topY + size - size * 0.02);
  ctx.restore();
  ctx.restore();
  return size;
}

function drawKicker(ctx, text, cx, y, fontPx) {
  ctx.save();
  ctx.font = `${fontPx}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFF3D6';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 6;
  // Letterspacing by hand (canvas has no letter-spacing everywhere).
  const spaced = text.split('').join('\u2009');
  ctx.fillText(spaced, cx, y);
  ctx.restore();
}

function drawFooter(ctx, cx, y, fontPx, scale) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // Stars.
  ctx.font = `${fontPx * 1.15}px sans-serif`;
  ctx.fillStyle = '#FFD34D';
  ctx.shadowColor = 'rgba(255,211,77,0.9)';
  ctx.shadowBlur = 10 * scale;
  ctx.fillText('★★★★★', cx, y);
  ctx.shadowBlur = 0;
  // Footer line.
  ctx.font = `${fontPx}px "Bebas Neue", sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fillText(FOOTER_TEXT, cx, y + fontPx * 1.55);
  ctx.restore();
}

// Render the full poster for one size. Returns a canvas at exact size.
export async function renderCover(sizeName, opts = {}) {
  const size = SIZES[sizeName];
  if (!size) throw new Error('unknown size ' + sizeName);
  const L = LAYOUT[sizeName];
  const W = size.w;
  const H = size.h;
  const scale = W / 1080;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const heroImg = await loadImage(HERO_SRC);
  const panelImgs = [];
  for (const p of PANELS) panelImgs.push(await loadImage(p.src));

  // 1. HERO, full-bleed: covers the whole canvas, edge to edge.
  const facePx = {
    x: L.face.x * W, y: L.face.y * H,
    rx: L.face.rx * W, ry: L.face.ry * H,
  };
  const heroPainted = paintPhoto(heroImg, W, H, {
    grade: GRADES.sunset, levels: HERO_LEVELS,
    panX: L.hero.panX, panY: L.hero.panY, zoom: L.hero.zoom,
    face: facePx, blur: 2, vignette: 0.14,
  });
  ctx.drawImage(heroPainted, 0, 0);

  // 1b. A soft dark gradient across the bottom of the hero, so the title
  //     and footer always read against the bright golden-hour photo.
  //     Drawn before the panels and title, so it never covers them.
  {
    const g = ctx.createLinearGradient(0, H * 0.58, 0, H);
    g.addColorStop(0, 'rgba(10,4,20,0)');
    g.addColorStop(1, 'rgba(10,4,20,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.58, W, H * 0.42);
  }

  // 2. PANEL STACK (left), clipped to its own rect so nothing leaks out
  //    as a stray line. Three slanted panels with a gutter between them.
  const stackX = 0;
  const stackW = Math.round(W * L.stackW);
  const stackTop = Math.round(H * L.stackTop);
  const stackBottom = Math.round(H * L.stackBottom);
  const stackH = stackBottom - stackTop;
  const gutter = Math.max(4, Math.round(H * 0.012));
  const panelH = Math.round((stackH - gutter * 2) / 3);
  const slant = Math.max(6, Math.round(stackW * 0.09));
  ctx.save();
  ctx.beginPath();
  ctx.rect(stackX, stackTop, stackW + slant, stackH);
  ctx.clip();
  PANELS.forEach((p, i) => {
    const py = stackTop + i * (panelH + gutter);
    const grade = GRADES[p.grade];
    const painted = paintPhoto(panelImgs[i], stackW + slant, panelH, {
      grade, levels: PAINT_LEVELS,
      panX: 0.5, panY: p.panY, zoom: 1.0,
      face: null, blur: 2, vignette: 0.10,
    });
    ctx.save();
    panelPath(ctx, stackX, py, stackW + slant, panelH, slant);
    ctx.clip();
    ctx.drawImage(painted, stackX, py);
    ctx.restore();
    // Neon pink border around the panel (the GTA neon-pop that makes the
    // stack read as key art, not a collage). Stroked after the clip so it
    // sits cleanly on the panel edge.
    ctx.save();
    panelPath(ctx, stackX, py, stackW + slant, panelH, slant);
    ctx.strokeStyle = '#FF5E8A';
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.shadowColor = 'rgba(255,94,138,0.8)';
    ctx.shadowBlur = 8 * scale;
    ctx.stroke();
    ctx.restore();
    // Label pill.
    drawPill(ctx, stackX + Math.max(6, 10 * scale), py + Math.max(6, 8 * scale), p.label, Math.max(13, 20 * scale));
  });
  ctx.restore();

  // 3. TITLE BLOCK (bottom). The title overlaps the hero's lower body,
  //    never a face: titleY sits well below the chins.
  const cx = W * L.cx;
  const titleTop = H * L.titleY;
  const kickerY = titleTop - H * L.kickerGap;
  drawKicker(ctx, KICKER_TEXT, cx, kickerY, Math.max(16, 30 * scale));
  const titleSize = drawTitle(ctx, TITLE_TEXT, cx, titleTop, W * L.titleW, scale, H);
  const footerY = titleTop + titleSize * 1.08;
  drawFooter(ctx, cx, footerY + Math.max(14, 22 * scale), Math.max(14, 24 * scale), scale);

  return canvas;
}

// Export one size as a PNG data URL.
export async function exportPNG(sizeName) {
  const canvas = await renderCover(sizeName);
  return canvas.toDataURL('image/png');
}

export const __layout = LAYOUT;
export const __panels = PANELS;
