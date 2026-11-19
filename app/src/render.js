// The one render pipeline: the live preview and every export call this same
// function, so the PNG is exactly what the preview shows. It draws the
// panels, the grade, the light, the words, the grain and the vignette.
import { layoutById } from './layouts.js';
import { photoFor } from './state.js';
import { gradeFilter, drawSunsetWash, drawNeonGlow, drawGrain, drawVignette } from './effects.js';

/** The headline/subtitle boxes of the last render, for pointer hit-testing. */
export const lastTextBoxes = { headline: null, subtitle: null };

/** Cover-fit draw of an image into a rect, with zoom and pan. */
function drawPhotoInto(ctx, img, rx, ry, rw, rh, zoom, ox, oy) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(rw / iw, rh / ih);
  const dw = iw * base * zoom;
  const dh = ih * base * zoom;
  const mx = Math.max(0, (dw - rw) / 2);
  const my = Math.max(0, (dh - rh) / 2);
  const dx = rx + rw / 2 - dw / 2 + ox * mx;
  const dy = ry + rh / 2 - dh / 2 + oy * my;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** Draw one panel: clip, photo, and its frame when it has one. */
function drawPanel(ctx, w, h, panel, photo, crop, gap) {
  const px = panel.x * w;
  const py = panel.y * h;
  const pw = panel.w * w;
  const ph = panel.h * h;
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
    if (photo) drawPhotoInto(ctx, photo.img, 0, 0, w, h, crop.zoom, crop.ox, crop.oy);
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
    if (photo) drawPhotoInto(ctx, photo.img, -rw / 2, -rh / 2, rw, rh, crop.zoom, crop.ox, crop.oy);
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();
  if (photo) drawPhotoInto(ctx, photo.img, rx, ry, rw, rh, crop.zoom, crop.ox, crop.oy);
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

/** Draw one line of words: outline, glow, then the fill. */
function drawWords(ctx, w, h, words) {
  const text = words.text.trim();
  if (!text) return null;
  const scale = h / 1080;
  const startSize = words.size * scale;
  const size = fitFont(ctx, text.toUpperCase(), words.font, startSize, w * 0.94);
  const x = words.x * w;
  const y = words.y * h;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (words.outline) {
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.strokeStyle = 'rgba(8, 3, 18, 0.92)';
    ctx.strokeText(text.toUpperCase(), x, y);
  }
  if (words.glow) {
    ctx.shadowColor = words.color === '#ffffff' ? '#ff2e88' : words.color;
    ctx.shadowBlur = size * 0.32;
  }
  ctx.fillStyle = words.color;
  ctx.fillText(text.toUpperCase(), x, y);
  const tw = ctx.measureText(text.toUpperCase()).width;
  ctx.restore();
  return { x: x - tw / 2, y: y - size * 0.62, w: tw, h: size * 1.24 };
}

/**
 * Render the cover onto `ctx` at `w` by `h` from `state`.
 * `highlight` is a panel index to outline (the preview's selection), or -1.
 */
export function renderCover(ctx, w, h, state, highlight = -1) {
  const layout = layoutById(state.layoutId);
  const gap = layout.gap || 0;

  // Pass 1: panels, band and sunset wash on a work canvas, so the grade
  // filter can run over the whole picture in one draw.
  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const wc = work.getContext('2d');
  wc.fillStyle = layout.bg;
  wc.fillRect(0, 0, w, h);
  layout.panels.forEach((panel, i) => {
    const crop = state.crops[i] || { photoId: null, zoom: 1, ox: 0, oy: 0 };
    drawPanel(wc, w, h, panel, photoFor(state, i), crop, gap);
  });
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
  lastTextBoxes.headline = drawWords(ctx, w, h, state.headline);
  lastTextBoxes.subtitle = drawWords(ctx, w, h, state.subtitle);
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
