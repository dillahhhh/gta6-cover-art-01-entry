// Light and film: the sunset wash, neon glow, grain and vignette. The grain
// pattern is built once from a fixed seed, so the preview and every export
// carry the same grain and two runs match byte for byte.
import { GRADES } from './state.js';

/** The canvas filter string for a grade id. */
export function gradeFilter(gradeId) {
  return GRADES[gradeId] || GRADES.sunset;
}

let noiseTile = null;

/** A 160x160 tile of monochrome noise, same on every run. */
export function grainTile() {
  if (noiseTile) return noiseTile;
  const tile = document.createElement('canvas');
  tile.width = 160;
  tile.height = 160;
  const ctx = tile.getContext('2d');
  const img = ctx.createImageData(160, 160);
  let seed = 20261119;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(next() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseTile = tile;
  return tile;
}

/** Warm sunset wash: orange at the foot fading to pink at the top. */
export function drawSunsetWash(ctx, w, h, strength) {
  if (strength <= 0) return;
  const wash = ctx.createLinearGradient(0, h * 0.25, 0, h);
  wash.addColorStop(0, 'rgba(255, 122, 61, 0)');
  wash.addColorStop(0.55, `rgba(255, 94, 120, ${0.22 * strength})`);
  wash.addColorStop(1, `rgba(255, 46, 136, ${0.5 * strength})`);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
}

/** Soft neon glow: pink from the top left, cyan from the bottom right. */
export function drawNeonGlow(ctx, w, h, strength) {
  if (strength <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  let g = ctx.createRadialGradient(w * 0.12, h * 0.1, 0, w * 0.12, h * 0.1, w * 0.55);
  g.addColorStop(0, `rgba(255, 46, 136, ${0.4 * strength})`);
  g.addColorStop(1, 'rgba(255, 46, 136, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  g = ctx.createRadialGradient(w * 0.9, h * 0.92, 0, w * 0.9, h * 0.92, w * 0.55);
  g.addColorStop(0, `rgba(34, 211, 238, ${0.36 * strength})`);
  g.addColorStop(1, 'rgba(34, 211, 238, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Film grain: the noise tile, tiled over the cover. */
export function drawGrain(ctx, w, h, strength) {
  if (strength <= 0) return;
  const tile = grainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.save();
  ctx.globalAlpha = 0.16 * strength;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Vignette: darkened corners, clear centre. */
export function drawVignette(ctx, w, h, strength) {
  if (strength <= 0) return;
  const r = Math.hypot(w, h) / 2;
  const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.42, w / 2, h / 2, r);
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, `rgba(0, 0, 0, ${0.55 * strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
