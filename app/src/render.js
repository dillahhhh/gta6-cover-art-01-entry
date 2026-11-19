// The one render pipeline: the live preview and every export call this same
// function, so the PNG is exactly what the preview shows. It draws the
// panels (each photo first run through the Painterly / Ink Art Engine, so
// the cover reads as one illustration), the story beats, the grade, the
// light, the 3D poster words, the grain and the vignette.
import { layoutById } from './layouts.js';
import { photoFor, STORY_BEATS } from './state.js';
import { gradeFilter, drawSunsetWash, drawNeonGlow, drawGrain, drawVignette } from './effects.js';
import { treatedImageFor } from './painterly.js';
import { computeDrawRect, anchorForKind } from './focus.js';

/** The headline/subtitle boxes of the last render, for pointer hit-testing. */
export const lastTextBoxes = { headline: null, subtitle: null };

/** Where each panel's photo was drawn in the last render (preview pixels),
 *  for click-to-set-focus: { dx, dy, dw, dh, photo } per panel index. */
export const lastPanelDraws = [];

/**
 * Cover-fit draw of an image into a rect, with zoom and pan — but centred on
 * the photo's subject, not the photo's middle. `focus` is the subject's
 * fraction inside the image (faces, the car, the tower); `anchor` is where
 * that subject should sit inside the rect. With both at 0.5 the old centred
 * behaviour is unchanged; a face at focus y 0.22 stays visible when a wide
 * short panel would otherwise crop the top and bottom off. The image is
 * clamped so it always covers the rect, then the pan offsets apply.
 */
function drawPhotoInto(ctx, img, rx, ry, rw, rh, zoom, ox, oy, focus, anchor) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const r = computeDrawRect(iw, ih, rw, rh, zoom, ox, oy, focus, anchor);
  ctx.drawImage(img, rx + r.dx, ry + r.dy, r.dw, r.dh);
  return r;
}

/** The centroid of a polygon's points, in fractions of the cover. */
function polyCentroid(poly) {
  let x = 0;
  let y = 0;
  poly.forEach(([fx, fy]) => { x += fx; y += fy; });
  return { x: x / poly.length, y: y / poly.length };
}

/** The treated image for a panel's photo under the current art settings. */
function artImage(photo, art) {
  if (!photo) return null;
  return treatedImageFor(photo, art);
}

/** Draw one panel: clip, treated photo, and its frame when it has one. */
function drawPanel(ctx, w, h, panel, photo, crop, gap, art, panelIndex) {
  const px = panel.x * w;
  const py = panel.y * h;
  const pw = panel.w * w;
  const ph = panel.h * h;
  const img = artImage(photo, art);
  // Faces ride high in their panel (headroom); landscapes sit centred.
  const anchor = anchorForKind(photo ? photo.focusKind : 'subject');
  if (panel.poly) {
    ctx.save();
    ctx.beginPath();
    panel.poly.forEach(([fx, fy], i) => {
      const X = fx * w;
      const Y = fy * h;
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    });
    ctx.closePath();
    ctx.clip();
    if (img) {
      // Fit to the triangle's own box, anchored on its centroid: the photo's
      // subject lands in the fat part of the triangle instead of being sliced
      // by the diagonal edge.
      const xs = panel.poly.map(([fx]) => fx * w);
      const ys = panel.poly.map(([, fy]) => fy * h);
      const bx = Math.min(...xs);
      const by = Math.min(...ys);
      const bw = Math.max(...xs) - bx;
      const bh = Math.max(...ys) - by;
      const c = polyCentroid(panel.poly);
      const triAnchor = { x: (c.x * w - bx) / bw, y: (c.y * h - by) / bh };
      const r = drawPhotoInto(ctx, img, bx, by, bw, bh, crop.zoom, crop.ox, crop.oy, photo.focus, triAnchor);
      lastPanelDraws[panelIndex] = { dx: bx + r.dx, dy: by + r.dy, dw: r.dw, dh: r.dh, photo };
    }
    ctx.restore();
    return;
  }
  const inset = (gap * Math.min(w, h)) / 2;
  const rx = px + inset;
  const ry = py + inset;
  const rw = pw - inset * 2;
  const rh = ph - inset * 2;
  ctx.save();
  if (panel.rot) {
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = w * 0.02;
    ctx.shadowOffsetX = w * 0.006;
    ctx.shadowOffsetY = w * 0.008;
    ctx.translate(cx, cy);
    ctx.rotate((panel.rot * Math.PI) / 180);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-rw / 2 - 6, -rh / 2 - 6, rw + 12, rh + 12);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    ctx.rect(-rw / 2, -rh / 2, rw, rh);
    ctx.clip();
    if (img) {
      const r = drawPhotoInto(ctx, img, -rw / 2, -rh / 2, rw, rh, crop.zoom, crop.ox, crop.oy, photo.focus, anchor);
      lastPanelDraws[panelIndex] = { dx: cx + r.dx, dy: cy + r.dy, dw: r.dw, dh: r.dh, photo };
    }
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();
  if (img) {
    const r = drawPhotoInto(ctx, img, rx, ry, rw, rh, crop.zoom, crop.ox, crop.oy, photo.focus, anchor);
    lastPanelDraws[panelIndex] = { dx: rx + r.dx, dy: ry + r.dy, dw: r.dw, dh: r.dh, photo };
  }
  ctx.restore();
}

/** The outline of a panel's rect, for the selected-panel highlight. */
function panelPath(ctx, w, h, panel, gap) {
  const px = panel.x * w;
  const py = panel.y * h;
  const pw = panel.w * w;
  const ph = panel.h * h;
  ctx.beginPath();
  if (panel.poly) {
    panel.poly.forEach(([fx, fy], i) => {
      const X = fx * w;
      const Y = fy * h;
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    });
    ctx.closePath();
    return;
  }
  if (panel.rot) {
    const inset = (gap * Math.min(w, h)) / 2;
    const cx = px + pw / 2;
    const cy = py + ph / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((panel.rot * Math.PI) / 180);
    ctx.rect(-(pw - inset * 2) / 2, -(ph - inset * 2) / 2, pw - inset * 2, ph - inset * 2);
    ctx.restore();
    return;
  }
  const inset = (gap * Math.min(w, h)) / 2;
  ctx.rect(px + inset, py + inset, pw - inset * 2, ph - inset * 2);
}

/** Fit a line of text to a max width, shrinking from its start size. */
function fitFont(ctx, text, font, startSize, maxWidth) {
  let size = startSize;
  const family = font === 'Arial Black' ? '"Arial Black", sans-serif' : `'${font}', sans-serif`;
  const weight = font === 'Yellowtail' ? '' : '400 ';
  ctx.font = `${weight}${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > 14) {
    size -= 2;
    ctx.font = `${weight}${size}px ${family}`;
  }
  return size;
}

/** Lighten a #rrggbb colour toward white by `amt` (0..1). */
function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * amt);
  const g = Math.min(255, ((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * amt);
  const b = Math.min(255, (n & 255) + (255 - (n & 255)) * amt);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/**
 * Draw one line of words as real 3D poster lettering — not a glow.
 * Styles (state.art.lettering, headline; the subtitle always uses 'slab'):
 *   extrude    — the line is drawn again and again, stepping down-right in
 *                deep violet, so the letters have a solid extruded side;
 *                then a dark outer outline, a coloured inner outline, a
 *                warm gradient fill and a bevel highlight across the top.
 *                The whole line is sheared a few degrees for a slanted
 *                poster composition.
 *   neon-stack — layered neon: a cyan glow pass, a pink glow pass, then a
 *                bright fill, so the letters feel lit from inside.
 *   slab       — a heavy offset block shadow under the line, a thick dark
 *                outline, a thin gold inner outline and a gradient fill.
 * The subtitle uses the slab treatment at a smaller depth so it stays
 * readable under the headline.
 */
function drawWords(ctx, w, h, words, style, isHeadline) {
  const text = words.text.trim();
  if (!text) return null;
  const upper = text.toUpperCase();
  const scale = h / 1080;
  const startSize = words.size * scale;
  // The line is centred on its anchor, so its width is limited by the
  // tighter side: a headline anchored at x 0.23 over a side panel only gets
  // 2 * 0.23 of the width, not the whole canvas. Keep a 6% safe margin on
  // each side too, so a line that only just fits still reads as clipped.
  const x = words.x * w;
  const room = Math.min(x, w - x) * 2 * 0.97;
  const size = fitFont(ctx, upper, words.font, startSize, Math.min(w * 0.88, room));
  // Clamp the line inside a vertical safe zone too: the box must clear the
  // top and bottom edges by 3% of the cover height.
  const half = size * 0.62;
  const y = Math.min(Math.max(words.y * h, half + h * 0.03), h * 0.97 - half);
  const tw = ctx.measureText(upper).width;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const depth = isHeadline ? Math.max(3, Math.round(size * 0.085)) : Math.max(2, Math.round(size * 0.05));
  const step = size * 0.011;

  if (style === 'extrude') {
    // Slanted composition: shear the line a few degrees around its centre.
    ctx.translate(x, y);
    ctx.transform(1, 0, -0.07, 1, 0, 0);
    ctx.translate(-x, -y);
    // Extruded side: step the text down-right in deep violet.
    ctx.fillStyle = '#1c0530';
    for (let i = depth; i >= 1; i--) ctx.fillText(upper, x + i * step, y + i * step);
    // Directional shadow under the whole stack.
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = size * 0.06;
    ctx.shadowOffsetX = size * 0.03;
    ctx.shadowOffsetY = size * 0.05;
    // Dark outer outline, then a coloured inner outline.
    ctx.lineWidth = Math.max(2, size * 0.13);
    ctx.strokeStyle = 'rgba(10, 2, 20, 0.95)';
    ctx.strokeText(upper, x, y);
    ctx.lineWidth = Math.max(1, size * 0.035);
    ctx.strokeStyle = words.color === '#ffffff' ? '#ff2e88' : lighten(words.color, 0.2);
    ctx.strokeText(upper, x, y);
    // Warm gradient fill, light at the top.
    const grad = ctx.createLinearGradient(0, y - size * 0.55, 0, y + size * 0.55);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, words.color === '#ffffff' ? '#ffe9a8' : words.color);
    grad.addColorStop(1, words.color === '#ffffff' ? '#ff9a3d' : words.color);
    ctx.fillStyle = grad;
    ctx.fillText(upper, x, y);
    // Bevel highlight: white clipped to the top third of the letters.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - tw / 2, y - size * 0.62, tw, size * 0.3);
    ctx.clip();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(upper, x, y);
    ctx.restore();
  } else if (style === 'neon-stack') {
    // Layered neon: cyan pass, pink pass, bright fill.
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = size * 0.45;
    ctx.fillStyle = '#22d3ee';
    ctx.fillText(upper, x, y);
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = size * 0.3;
    ctx.fillStyle = '#ff2e88';
    ctx.fillText(upper, x, y);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.strokeStyle = 'rgba(8, 3, 18, 0.9)';
    ctx.strokeText(upper, x, y);
    const grad = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, words.color);
    ctx.fillStyle = grad;
    ctx.fillText(upper, x, y);
  } else {
    // Slab: heavy offset block shadow, thick outline, gold inner line.
    ctx.fillStyle = 'rgba(12, 3, 24, 0.92)';
    ctx.fillText(upper, x + size * 0.045, y + size * 0.075);
    ctx.lineWidth = Math.max(2, size * 0.11);
    ctx.strokeStyle = 'rgba(8, 3, 18, 0.95)';
    ctx.strokeText(upper, x, y);
    ctx.lineWidth = Math.max(1, size * 0.025);
    ctx.strokeStyle = '#ffd166';
    ctx.strokeText(upper, x, y);
    const grad = ctx.createLinearGradient(0, y - size * 0.55, 0, y + size * 0.55);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.6, words.color === '#ffffff' ? '#ffe9a8' : words.color);
    grad.addColorStop(1, words.color === '#ffffff' ? '#ff9a3d' : words.color);
    ctx.fillStyle = grad;
    ctx.fillText(upper, x, y);
  }
  // The old neon-glow checkbox adds one extra soft glow on top, if asked.
  if (words.glow && style !== 'neon-stack') {
    ctx.save();
    ctx.shadowColor = words.color === '#ffffff' ? '#ff2e88' : words.color;
    ctx.shadowBlur = size * 0.22;
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = words.color;
    ctx.fillText(upper, x, y);
    ctx.restore();
  }
  ctx.restore();
  return { x: x - tw / 2, y: y - size * 0.62, w: tw, h: size * 1.24 };
}

/** A story-beat pill on one panel: the chapter that photo plays in the
 *  heist, so the lower panels tell a story instead of showing locations. */
function drawBeat(ctx, w, h, panel, photo, gap) {
  const beat = photo ? STORY_BEATS[photo.sampleId] : null;
  if (!beat) return;
  const px = panel.x * w;
  const py = panel.y * h;
  const pw = panel.w * w;
  const ph = panel.h * h;
  if (ph < h * 0.16 || pw < w * 0.2) return;
  let bx;
  let by;
  if (panel.poly) {
    // Diagonal panels: the headline lives at the bottom, so the beat sits
    // at the panel's centroid height instead of near the bottom, where the
    // headline would swallow it (it used to render as a clipped "THE C…").
    const c = polyCentroid(panel.poly);
    bx = c.x * w - pw * 0.18;
    by = (c.y - 0.05) * h;
  } else {
    bx = px + Math.max(10, w * 0.012);
    by = py + ph - h * 0.055;
  }
  const size = Math.max(11, h * 0.021);
  ctx.save();
  ctx.font = `400 ${size}px 'Bebas Neue', sans-serif`;
  const tw = ctx.measureText(beat).width;
  const padX = size * 0.7;
  const padY = size * 0.45;
  const bw = tw + padX * 2;
  const bh = size + padY * 2;
  ctx.fillStyle = 'rgba(10, 4, 20, 0.85)';
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)';
  ctx.lineWidth = Math.max(1, h * 0.0012);
  ctx.beginPath();
  ctx.roundRect(bx, by - bh / 2, bw, bh, bh / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(beat, bx + padX, by + size * 0.04);
  ctx.restore();
}

/**
 * Render the cover onto `ctx` at `w` by `h` from `state`.
 * `highlight` is a panel index to outline (the preview's selection), or -1.
 */
export function renderCover(ctx, w, h, state, highlight = -1) {
  const layout = layoutById(state.layoutId);
  const gap = layout.gap || 0;
  const art = state.art || { treatment: 'off', strength: 0, lettering: 'slab' };
  lastPanelDraws.length = 0;

  // Pass 1: panels, beats, band and sunset wash on a work canvas, so the
  // grade filter can run over the whole picture in one draw.
  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const wc = work.getContext('2d');
  wc.fillStyle = layout.bg;
  wc.fillRect(0, 0, w, h);
  layout.panels.forEach((panel, i) => {
    const crop = state.crops[i] || { photoId: null, zoom: 1, ox: 0, oy: 0 };
    drawPanel(wc, w, h, panel, photoFor(state, i), crop, gap, art, i);
  });
  if (art.storyBeats !== false) {
    layout.panels.forEach((panel, i) => {
      drawBeat(wc, w, h, panel, photoFor(state, i), gap);
    });
  }
  if (layout.band) {
    const b = layout.band;
    wc.fillStyle = b.color;
    wc.fillRect(b.x * w, b.y * h, b.w * w, b.h * h);
    if (b.rule) {
      wc.fillStyle = b.rule;
      wc.fillRect(b.x * w, b.y * h, b.w * w, Math.max(2, h * 0.004));
    }
  }
  drawSunsetWash(wc, w, h, state.fx.sunset);

  // Pass 2: the grade over the whole picture, then light, words, grain.
  ctx.save();
  ctx.filter = gradeFilter(state.fx.grade);
  ctx.drawImage(work, 0, 0);
  ctx.restore();
  drawNeonGlow(ctx, w, h, state.fx.neon);
  lastTextBoxes.headline = drawWords(ctx, w, h, state.headline, art.lettering || 'slab', true);
  lastTextBoxes.subtitle = drawWords(ctx, w, h, state.subtitle, 'slab', false);
  drawGrain(ctx, w, h, state.fx.grain);
  drawVignette(ctx, w, h, state.fx.vignette);

  if (highlight >= 0 && layout.panels[highlight]) {
    ctx.save();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = Math.max(3, w * 0.004);
    ctx.setLineDash([Math.max(8, w * 0.012), Math.max(6, w * 0.008)]);
    panelPath(ctx, w, h, layout.panels[highlight], gap);
    ctx.stroke();
    ctx.restore();
    // Focus marker: where the selected panel's photo thinks its subject is,
    // so the user can see (and tap to move) the auto-composition point.
    const draw = lastPanelDraws[highlight];
    // Rotated (tilted-print) panels store their draw rect in rotated space,
    // so no marker there — the marker would land in the wrong place.
    if (draw && draw.photo && draw.photo.focus && !layout.panels[highlight].rot) {
      const fx = draw.dx + draw.photo.focus.x * draw.dw;
      const fy = draw.dy + draw.photo.focus.y * draw.dh;
      const r = Math.max(6, w * 0.012);
      ctx.save();
      ctx.strokeStyle = '#ffd166';
      ctx.fillStyle = 'rgba(255, 209, 102, 0.9)';
      ctx.lineWidth = Math.max(2, w * 0.002);
      ctx.beginPath();
      ctx.arc(fx, fy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(fx, fy, Math.max(2, r * 0.25), 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(fx - r * 1.7, fy);
      ctx.lineTo(fx - r * 1.1, fy);
      ctx.moveTo(fx + r * 1.1, fy);
      ctx.lineTo(fx + r * 1.7, fy);
      ctx.moveTo(fx, fy - r * 1.7);
      ctx.lineTo(fx, fy - r * 1.1);
      ctx.moveTo(fx, fy + r * 1.1);
      ctx.lineTo(fx, fy + r * 1.7);
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** Render the cover onto a fresh canvas at an exact export size. */
export function exportCanvas(state, sizeId) {
  const size = { square: { w: 1080, h: 1080 }, portrait: { w: 1080, h: 1350 }, wide: { w: 1920, h: 1080 } }[sizeId];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  renderCover(canvas.getContext('2d'), size.w, size.h, state, -1);
  return canvas;
}
