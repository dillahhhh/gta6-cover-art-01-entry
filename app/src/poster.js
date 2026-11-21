// SUNSET PRESS — poster layout, compositing and lettering.
//
// One hero photo full-bleed, three slanted supporting panels stacked on the
// left, and one huge gold-to-pink wordmark. Every size re-lays the poster
// (it never just re-crops), so nothing is ever cut off.
//
// The wide layout is the one that changed this round: the whole title block
// (kicker + title + stars + footer) sits bottom-LEFT, centred around x 0.235
// of the canvas — that corner is lake water, far from both faces — and the
// kicker carries a thin shadow only, never a dark box behind it.

import { framePhoto, paintPhoto } from './paint.js';

export const SIZES = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  wide: { w: 1920, h: 1080 },
};

// Where each photo's focus point sits, per size, in 0..1 of the photo.
// Wide: the visible band is photo y 0.06..0.90, so the front man's mouth
// (photo y 0.63) lands at canvas y 0.68 and his chin (0.70) at 0.76 — both
// clear of the title block, which starts at canvas y 0.79.
// Square / portrait: the band is shifted right so the front man's face starts
// clear of the left panel stack (his left cheek at canvas x 330, panels end 316).
const HERO_FRAME = {
  wide: { fx: 0.5, fy: 0.48, zoom: 1.0 },
  square: { fx: 0.5375, fy: 0.52, zoom: 1.1 },
  portrait: { fx: 0.52, fy: 0.5, zoom: 1.0 },
};

const PANEL_GEOMETRY = {
  wide: { x: 24, w: 520, h: 195, gap: 14, y: 24, slant: 20 },
  square: { x: 16, w: 300, h: 185, gap: 12, y: 16, slant: 14 },
  portrait: { x: 16, w: 300, h: 200, gap: 12, y: 16, slant: 14 },
};

// Title block placement per size. Wide is bottom-left (cx 0.235); square and
// portrait keep the round-6 bottom-centre-right placement that was clean.
const TITLE_BLOCK = {
  wide: { cx: 0.23, kickerY: 0.745, titleBase: 0.895, starsY: 0.926, footerY: 0.962, width: 0.44 },
  square: { cx: 0.66, kickerY: 0.76, titleBase: 0.89, starsY: 0.92, footerY: 0.955, width: 0.57 },
  portrait: { cx: 0.64, kickerY: 0.79, titleBase: 0.91, starsY: 0.935, footerY: 0.965, width: 0.62 },
};

const PANELS = [
  // THE CREW: the friends photo has heads at its very top edge, so this panel
  // is drawn slightly inset (0.94) for headroom on every side, and its label
  // sits bottom-left, over jeans and ground — never over a face.
  { key: 'crew', label: 'THE CREW', img: 'crew', focus: { fx: 0.5, fy: 0.3 }, inset: 0.94, labelAt: 'bottom' },
  // THE GETAWAY: the car sits centre-frame; the label goes top-left, over sky.
  { key: 'getaway', label: 'THE GETAWAY', img: 'getaway', focus: { fx: 0.42, fy: 0.52 }, inset: 1.0, labelAt: 'top' },
  // THE SCORE: boardwalk and moon; the label goes top-left, over pink cloud.
  { key: 'score', label: 'THE SCORE', img: 'score', focus: { fx: 0.5, fy: 0.42 }, inset: 1.0, labelAt: 'top' },
];

const PAINT = { levels: 10, gradientMix: 0.65, photoBlend: 0.2, ink: 0.16, grain: 0.035 };

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
}

function fitFont(ctx, text, family, startSize, targetWidth) {
  let size = startSize;
  ctx.font = `${size}px ${family}`;
  const w = ctx.measureText(text).width;
  if (w > 0) size = Math.floor((size * targetWidth) / w);
  ctx.font = `${size}px ${family}`;
  return size;
}

function drawWordmark(ctx, text, cx, baselineY, targetWidth, h) {
  const u = h / 1080; // scale unit: 1 at 1080 px tall
  const size = fitFont(ctx, text, 'Anton, "Arial Black", sans-serif', Math.round(h * 0.17), targetWidth);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const grad = ctx.createLinearGradient(0, baselineY - size, 0, baselineY + size * 0.12);
  grad.addColorStop(0, '#FFD76A');
  grad.addColorStop(0.45, '#FF9E57');
  grad.addColorStop(1, '#FF4D8D');
  // Hard offset extrusion, three dark layers stacked below the letters.
  ctx.fillStyle = '#2A0A3A';
  for (const off of [3, 6, 9]) {
    ctx.fillText(text, cx, baselineY + off * u);
  }
  // Thin white light on the top edge of the letters.
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.fillText(text, cx, baselineY - 2 * u);
  // Main fill: gold-to-pink gradient, dark outline, soft pink glow.
  ctx.shadowColor = 'rgba(255,77,141,0.55)';
  ctx.shadowBlur = 18 * u;
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, baselineY);
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(2, size * 0.02);
  ctx.strokeStyle = '#1C0530';
  ctx.strokeText(text, cx, baselineY);
  ctx.restore();
  return size;
}

function drawKicker(ctx, text, cx, y, h) {
  const u = h / 1080;
  ctx.save();
  ctx.font = `${Math.round(h * 0.032)}px "Bebas Neue", "Arial Narrow", sans-serif`;
  try {
    ctx.letterSpacing = `${Math.round(8 * u)}px`;
  } catch {
    // Older canvas: no letterSpacing, plain text still reads.
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Thin shadow only. No dark box, no pill, nothing behind the words.
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 4 * u;
  ctx.shadowOffsetY = 2 * u;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, cx, y);
  ctx.restore();
}

function drawFooter(ctx, text, cx, y, h) {
  const u = h / 1080;
  ctx.save();
  ctx.font = `${Math.round(h * 0.021)}px "Bebas Neue", "Arial Narrow", sans-serif`;
  try {
    ctx.letterSpacing = `${Math.round(4 * u)}px`;
  } catch {
    // No letterSpacing support; plain text still reads.
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 3 * u;
  ctx.shadowOffsetY = 1 * u;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(text, cx, y);
  ctx.restore();
}

function drawStars(ctx, cx, y, h) {
  const u = h / 1080;
  ctx.save();
  ctx.font = `${Math.round(h * 0.03)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 3 * u;
  ctx.shadowOffsetY = 1 * u;
  ctx.fillStyle = '#FFC93C';
  ctx.fillText('★★★★★', cx, y);
  ctx.restore();
}

function drawLabel(ctx, text, x, y, fontSize) {
  ctx.save();
  ctx.font = `${fontSize}px "Bebas Neue", "Arial Narrow", sans-serif`;
  const padX = Math.round(fontSize * 0.55);
  const padY = Math.round(fontSize * 0.3);
  const tw = ctx.measureText(text).width;
  const bw = tw + padX * 2;
  const bh = fontSize + padY * 2;
  ctx.fillStyle = 'rgba(22,10,36,0.88)';
  ctx.beginPath();
  ctx.roundRect(x, y, bw, bh, bh / 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + bh / 2 + 1);
  ctx.restore();
  return bh;
}

// One slanted panel: painted photo clipped to a parallelogram, neon pink edge.
function drawPanel(ctx, panel, img, x, y, w, h, slant, grade) {
  const u = h / 1080;
  const frame = framePhoto(img, w, h, panel.focus.fx, panel.focus.fy, 1.0);
  const painted = paintPhoto(img, w, h, frame, {
    ...PAINT,
    grade,
    // Panels take a stronger gradient wash than the hero so their colour
    // stays rich instead of reading pale and washed out.
    gradientMix: 0.72,
    brighten: 1.08,
    saturate: 1.12,
  });
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - slant, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.clip();
  if (panel.inset < 1) {
    // Slightly inset photo on a dark plum bed: headroom on every side.
    ctx.fillStyle = '#1B0B2E';
    ctx.fillRect(x, y, w, h);
    const iw = w * panel.inset;
    const ih = h * panel.inset;
    ctx.drawImage(painted, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  } else {
    ctx.drawImage(painted, x, y, w, h);
  }
  ctx.restore();
  // Neon pink border following the slant.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - slant, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.lineWidth = Math.max(2, 3 * u);
  ctx.strokeStyle = '#FF4D9D';
  ctx.stroke();
  ctx.restore();
  // Label: CREW bottom-left (over jeans/ground), the rest top-left (over sky).
  // Sized from the panel height so it is always legible, never a speck.
  const labelFont = Math.max(14, Math.round(h * 0.115));
  const labelH = labelFont + Math.round(labelFont * 0.6);
  const lx = x + Math.max(6, Math.round(w * 0.02));
  const ly = panel.labelAt === 'bottom' ? y + h - labelH - 8 : y + 8;
  drawLabel(ctx, panel.label, lx, ly, labelFont);
}

// The full cover at export resolution. `images` holds the four loaded photos;
// `state` holds grade, title, kicker, title shift and hero pan/zoom tweaks.
export function drawCover(sizeKey, images, state) {
  const { w, h } = SIZES[sizeKey];
  const out = makeCanvas(w, h);
  const ctx = out.getContext('2d');
  const grade = state.grade || 'sunset';

  // 1. Hero, painted, full-bleed.
  const hf = HERO_FRAME[sizeKey];
  const fx = hf.fx + (state.heroPanX || 0);
  const fy = hf.fy + (state.heroPanY || 0);
  const heroFrame = framePhoto(images.hero, w, h, fx, fy, hf.zoom * (state.heroZoom || 1));
  const hero = paintPhoto(images.hero, w, h, heroFrame, { ...PAINT, grade });
  ctx.drawImage(hero, 0, 0);

  // 2. A soft dark wash over the bottom third so the wordmark always reads.
  // This is a full-width gradient, not a box behind any line of text.
  const wash = ctx.createLinearGradient(0, h * 0.6, 0, h);
  wash.addColorStop(0, 'rgba(18,4,30,0)');
  wash.addColorStop(1, 'rgba(18,4,30,0.5)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, h * 0.6, w, h * 0.4);

  // 3. The three supporting panels, stacked on the left.
  const g = PANEL_GEOMETRY[sizeKey];
  const photoByKey = { crew: images.crew, getaway: images.getaway, score: images.score };
  PANELS.forEach((panel, i) => {
    const y = g.y + i * (g.h + g.gap);
    drawPanel(ctx, panel, photoByKey[panel.img], g.x, y, g.w, g.h, g.slant, grade);
  });

  // 4. The title block.
  const tb = TITLE_BLOCK[sizeKey];
  const shift = (state.titleShift || 0) * h * 0.03;
  const cx = tb.cx * w;
  drawKicker(ctx, state.kicker || 'ONE LAST JOB.', cx, tb.kickerY * h + shift, h);
  drawWordmark(ctx, state.title || 'SUNSET HEIST', cx, tb.titleBase * h + shift, tb.width * w, h);
  drawStars(ctx, cx, tb.starsY * h + shift, h);
  drawFooter(ctx, 'VICE CITY · TONIGHT · SUNSET PRESS', cx, tb.footerY * h + shift, h);

  return out;
}

export const SAMPLE_PHOTOS = {
  hero: 'hero-real.jpg',
  crew: 'friends-day.jpg',
  getaway: 'getaway.jpg',
  score: 'beach-night.jpg',
};
