// render.js — the SUNSET PRESS cover renderer.
//
// Draws one poster (wide 1920x1080, square 1080x1080, portrait 1080x1350)
// on an offscreen canvas: painted hero full-bleed, a slanted three-panel
// stack on the left with neon pink borders, and a big gold-to-pink title
// block. The layout is computed bottom-up from the footer so the footer
// always keeps a real margin and the title block never creeps up onto a
// face — the wide face collision from the previous round is fixed here by
// construction, not by nudging numbers and hoping.
//
// Everything here is written for this round; nothing is copied from an
// earlier build.

import { paintPhoto, PRESETS } from './paint.js';

export const SIZES = {
  wide: { w: 1920, h: 1080 },
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
};

// Per-size layout. All positions are fractions of the canvas, except the
// font sizes which are in export pixels.
//   panels: the left column stack (x, width, top, per-panel heights, gap,
//           slant of the right edge in px).
//   heroFocus: where the hero photo's crop window centres (0..1 of the
//           source photo). A lower fy pulls the window down, which lifts
//           the faces in the frame.
//   title: centre-x of the title block, font sizes, and the bottom-up
//           stack (footer margin, gaps).
const LAYOUT = {
  wide: {
    panels: { x: 0, w: 0.292, top: 0.018, heights: [0.178, 0.178, 0.178], gap: 0.014, slant: 30 },
    heroFocus: { fx: 0.58, fy: 0.42 },
    title: { cx: 0.56, font: 80, kickerFont: 30, star: 22, footerFont: 22, footerMargin: 24, gapKicker: 18, gapStars: 12, gapFooter: 10, extrude: 9 },
  },
  square: {
    panels: { x: 0, w: 0.27, top: 0.02, heights: [0.17, 0.17, 0.17], gap: 0.014, slant: 26 },
    heroFocus: { fx: 0.58, fy: 0.44 },
    title: { cx: 0.54, font: 92, kickerFont: 30, star: 22, footerFont: 22, footerMargin: 24, gapKicker: 18, gapStars: 12, gapFooter: 10, extrude: 9 },
  },
  portrait: {
    panels: { x: 0, w: 0.235, top: 0.018, heights: [0.135, 0.135, 0.135], gap: 0.012, slant: 24 },
    heroFocus: { fx: 0.58, fy: 0.44 },
    title: { cx: 0.53, font: 88, kickerFont: 30, star: 22, footerFont: 22, footerMargin: 24, gapKicker: 18, gapStars: 12, gapFooter: 10, extrude: 9 },
  },
};

// Per-panel paint + crop. The focus keeps faces inside the frame: CREW
// looks at the upper part of the group photo so no head is cut, and shifts
// slightly left so the slanted right edge never eats the right face.
const PANELS = [
  { key: 'crew', label: 'THE CREW', img: 'crewImg', preset: 'warmCrew', focus: { fx: 0.44, fy: 0.26 } },
  { key: 'getaway', label: 'THE GETAWAY', img: 'getawayImg', preset: 'neonNight', focus: { fx: 0.5, fy: 0.45 } },
  { key: 'score', label: 'THE SCORE', img: 'scoreImg', preset: 'tealDusk', focus: { fx: 0.5, fy: 0.42 } },
];

const cache = new Map();
function cacheKey(parts) {
  return parts.join('|');
}

// A slanted parallelogram path: vertical left edge, right edge leaning out
// toward the bottom by `slant` px.
function slantedPath(ctx, x, y, w, h, slant) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - slant, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function drawPanel(ctx, img, preset, label, x, y, w, h, slant, focus) {
  if (!img) return;
  const key = cacheKey(['panel', img.src, preset, w, h]);
  let painted = cache.get(key);
  if (!painted) {
    painted = paintPhoto(img, Math.max(2, Math.round(w)), Math.max(2, Math.round(h)), PRESETS[preset], focus.fx, focus.fy);
    cache.set(key, painted);
  }
  ctx.save();
  slantedPath(ctx, x, y, w, h, slant);
  ctx.clip();
  ctx.drawImage(painted, x, y, w, h);
  // A gentle dark foot so the label stays readable.
  const foot = ctx.createLinearGradient(0, y, 0, y + h);
  foot.addColorStop(0, 'rgba(10,4,24,0)');
  foot.addColorStop(1, 'rgba(10,4,24,0.28)');
  ctx.fillStyle = foot;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  // Neon pink border.
  ctx.save();
  slantedPath(ctx, x, y, w, h, slant);
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();
  // Pill label, top-left inside the panel.
  ctx.save();
  ctx.font = `700 ${Math.max(13, Math.round(h * 0.115))}px "Bebas Neue", sans-serif`;
  const tw = ctx.measureText(label).width;
  const padX = 10;
  const padY = 6;
  const lh = Math.max(13, Math.round(h * 0.115)) + padY * 2;
  const lx = x + 10;
  const ly = y + 10;
  ctx.beginPath();
  const r = lh / 2;
  ctx.moveTo(lx + r, ly);
  ctx.lineTo(lx + tw + padX * 2 - r, ly);
  ctx.arcTo(lx + tw + padX * 2, ly, lx + tw + padX * 2, ly + r, r);
  ctx.arcTo(lx + tw + padX * 2, ly + lh, lx + tw + padX * 2 - r, ly + lh, r);
  ctx.lineTo(lx + r, ly + lh);
  ctx.arcTo(lx, ly + lh, lx, ly + lh - r, r);
  ctx.arcTo(lx, ly, lx + r, ly, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,3,20,0.88)';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(label, lx + padX, ly + lh / 2 + 1);
  ctx.restore();
}

// The title block, laid out bottom-up from the footer so the footer margin
// is guaranteed and the kicker can never drift up onto a chin.
// Returns the y of the kicker baseline (for callers that want to know).
function drawTitleBlock(ctx, W, H, cfg, title, kicker, footer) {
  const t = cfg.title;
  const cx = t.cx * W;
  // Footer first: baseline footerMargin px above the bottom edge.
  const footerBaseline = H - t.footerMargin - 4;
  // Stars sit above the footer, clear of it.
  const starBaseline = footerBaseline - t.footerFont - t.gapFooter - 4;
  // The title's bottom edge (including its extrusion) sits above the stars.
  const titleBottom = starBaseline - t.star - t.gapStars;
  const titleFont = t.font;
  const titleTop = titleBottom - titleFont;
  // The kicker sits above the title's top edge, clear of it.
  const kickerBaseline = titleTop - t.gapKicker;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Kicker: small condensed caps, letterspaced, white with a hard shadow.
  ctx.font = `${t.kickerFont}px "Bebas Neue", sans-serif`;
  ctx.fillStyle = 'rgba(10,4,24,0.55)';
  const kw = ctx.measureText(kicker).width;
  ctx.fillRect(cx - kw / 2 - 14, kickerBaseline - t.kickerFont - 6, kw + 28, t.kickerFont + 12);
  ctx.fillStyle = '#ffffff';
  try { ctx.letterSpacing = '6px'; } catch (e) { /* older canvas: ignore */ }
  ctx.fillText(kicker, cx, kickerBaseline);
  try { ctx.letterSpacing = '0px'; } catch (e) { /* ignore */ }

  // Title: Anton, gold-to-pink vertical gradient, hard offset extrusion in
  // three dark layers, dark outline, neon glow, soft white top highlight.
  ctx.font = `${titleFont}px Anton, sans-serif`;
  const grad = ctx.createLinearGradient(0, titleTop, 0, titleBottom);
  grad.addColorStop(0, '#ffd76a');
  grad.addColorStop(0.45, '#ffb347');
  grad.addColorStop(0.72, '#ff5e8a');
  grad.addColorStop(1, '#ff2e88');
  const ex = t.extrude;
  ctx.fillStyle = '#2a0a3a';
  for (let i = 3; i >= 1; i--) {
    ctx.fillText(title, cx + (ex / 3) * i, titleBottom + (ex / 3) * i);
  }
  // Soft white top highlight: the same text, nudged up, faint.
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, cx, titleBottom - 3);
  ctx.globalAlpha = 1;
  // Glow + main gradient fill.
  ctx.shadowColor = 'rgba(255,46,136,0.75)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = grad;
  ctx.fillText(title, cx, titleBottom);
  ctx.shadowBlur = 0;
  // Dark outline so the letters hold against a bright hero.
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(20,4,32,0.85)';
  ctx.strokeText(title, cx, titleBottom);

  // Stars: five gold stars, centred, clear of the extrusion by construction
  // (their baseline was computed from the title bottom + gap).
  ctx.font = `${t.star}px sans-serif`;
  ctx.fillStyle = '#ffd76a';
  ctx.shadowColor = 'rgba(255,180,60,0.8)';
  ctx.shadowBlur = 8;
  ctx.fillText('★★★★★', cx, starBaseline);
  ctx.shadowBlur = 0;

  // Footer: small condensed caps, letterspaced.
  ctx.font = `${t.footerFont}px "Bebas Neue", sans-serif`;
  try { ctx.letterSpacing = '4px'; } catch (e) { /* ignore */ }
  ctx.fillStyle = '#ffffff';
  ctx.fillText(footer, cx, footerBaseline);
  try { ctx.letterSpacing = '0px'; } catch (e) { /* ignore */ }
  ctx.restore();
  return kickerBaseline;
}

// Unified finishing grade over the whole composite: a warm bloom from the
// sun side, a pink-teal split tone and a vignette. Very light, so it ties
// the panels and the hero together without muddying faces.
function finishGrade(ctx, W, H) {
  const v = ctx.createRadialGradient(W * 0.62, H * 0.3, H * 0.25, W * 0.5, H * 0.55, H * 0.95);
  v.addColorStop(0, 'rgba(255,170,90,0.05)');
  v.addColorStop(0.6, 'rgba(20,6,36,0)');
  v.addColorStop(1, 'rgba(16,4,30,0.28)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// Render one cover at exact export size. `state` carries the loaded images,
// the active style preset name, and the caption strings.
export function renderCover(sizeName, state) {
  const size = SIZES[sizeName];
  const W = size.w;
  const H = size.h;
  const cfg = LAYOUT[sizeName];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Hero: painted full-bleed. Cached per size + style + image (+ focus).
  // A dragged subject-focus ellipse overrides the per-size default focus.
  const heroPreset = PRESETS[state.style] || PRESETS.sunset;
  const focus = state.focus || cfg.heroFocus;
  const hkey = cacheKey(['hero', state.heroImg ? state.heroImg.src : '', state.style, W, H, focus.fx, focus.fy]);
  let hero = cache.get(hkey);
  if (!hero) {
    hero = paintPhoto(state.heroImg, W, H, heroPreset, focus.fx, focus.fy);
    cache.set(hkey, hero);
  }
  ctx.drawImage(hero, 0, 0, W, H);

  // Panel stack on the left.
  const p = cfg.panels;
  const px = p.x * W;
  const pw = p.w * W;
  let py = p.top * H;
  for (let i = 0; i < PANELS.length; i++) {
    const def = PANELS[i];
    const ph = p.heights[i] * H;
    drawPanel(ctx, state[def.img], def.preset, def.label, px, py, pw, ph, p.slant, def.focus);
    py += ph + p.gap * H;
  }

  // Title block (bottom-up, so the face stays free in wide).
  drawTitleBlock(ctx, W, H, cfg, state.title, state.kicker, state.footer);

  finishGrade(ctx, W, H);
  return canvas;
}
