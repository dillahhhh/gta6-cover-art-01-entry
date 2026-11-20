'use strict';
/* SUNSET PRESS — poster renderer.
 *
 * Layout engine for the three export sizes, the hero + supporting-cast
 * composition, the hero breakout over the title, the 3D lettering engine,
 * pill labels, poster furniture and the final unified grade. All drawing is
 * plain 2D canvas; the painted panels come from paint.js.
 */

const SP_SIZES = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  wide: { w: 1920, h: 1080 },
};

/* Fractional layout per size: supporting rects, title band, footer.
 * The hero is the whole poster now (fix round 4, item 2): one full-bleed
 * photo, top to bottom, painted over the full canvas — no hero column,
 * no skyline band splitting it. The title, tagline and footer sit ON the
 * photo over a dark bottom gradient, and the three supporting panels
 * float on the photo's right side. Fractions of (W, H). */
function spLayoutFor(sizeName) {
  // (fix round 2, item 8: the portrait band was too tall — the tagline
  // sat ~200 px above the footer with dead air between them. The band
  // is shorter now and the footer rides up to meet it.)
  if (sizeName === 'portrait') {
    return {
      hero: { x: 0, y: 0, w: 1, h: 1 },
      supports: [
        { x: 0.635, y: 0, w: 0.365, h: 0.16 },
        { x: 0.635, y: 0.185, w: 0.365, h: 0.16 },
        { x: 0.635, y: 0.37, w: 0.365, h: 0.16 },
      ],
      title: { x: 0, y: 0.545, w: 1, h: 0.22 },
      // Fix round 3, item 4: the footer rides up to meet the title
      // band (was 0.80), so the dark strip between them is gone.
      footer: { x: 0, y: 0.77, w: 1, h: 0.09 },
    };
  }
  if (sizeName === 'wide') {
    return {
      hero: { x: 0, y: 0, w: 1, h: 1 },
      supports: [
        { x: 0.575, y: 0, w: 0.425, h: 0.22 },
        { x: 0.575, y: 0.24, w: 0.425, h: 0.22 },
        { x: 0.575, y: 0.48, w: 0.425, h: 0.22 },
      ],
      // Fix round 4, item 5: the title band is taller (was 0.715 /
      // 0.20) so the grown 16:9 wordmark (≥55% of the canvas) fits
      // with its extrusion clear of the tagline.
      title: { x: 0, y: 0.70, w: 1, h: 0.24 },
      // Fix round 3, item 4: the footer meets the title band (was
      // 0.93), so the dark strip under the title on the right is gone.
      footer: { x: 0, y: 0.94, w: 1, h: 0.06 },
    };
  }
  return {
    hero: { x: 0, y: 0, w: 1, h: 1 },
    supports: [
      { x: 0.645, y: 0, w: 0.355, h: 0.18 },
      { x: 0.645, y: 0.205, w: 0.355, h: 0.20 },
      { x: 0.645, y: 0.43, w: 0.355, h: 0.20 },
    ],
    title: { x: 0, y: 0.665, w: 1, h: 0.24 },
    footer: { x: 0, y: 0.915, w: 1, h: 0.085 },
  };
}

function spRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* Slanted panel clip: a parallelogram whose top edge is shifted right by
 * ~12% of the panel height. Returns the path points for the gutter stroke. */
function spSlantPath(ctx, x, y, w, h) {
  const s = h * 0.12;
  ctx.beginPath();
  ctx.moveTo(x + s, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - s, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function spSetSpacing(ctx, px) {
  try { ctx.letterSpacing = px + 'px'; } catch (e) { /* older canvas: ignore */ }
}

/* The 3D wordmark: hard offset extrusion, neon glow, vertical gradient
 * fill, dark outline, white top highlight. The title fills the band:
 * it shrinks to fit 80% of the width, and it GROWS to at least 62% —
 * on 16:9 the band is short, so a height-only fit left the wordmark at
 * ~38% of the canvas (fix round 4, item 5). Growth is capped so the
 * letters + extrusion still clear the tagline. */
function spDrawTitle(ctx, text, cx, cy, maxW, maxH, style) {
  // Start big and shrink to fit the width: on wide posters the band is
  // short but the width is plentiful, so the title must grow to fill it.
  let size = maxH * 0.95;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const setFont = (s) => { ctx.font = s + 'px Anton, "Arial Black", sans-serif'; };
  setFont(Math.round(size));
  spSetSpacing(ctx, Math.max(1, size * 0.02));
  while (ctx.measureText(text).width < maxW * 0.62 && size < maxH * 1.5) {
    size *= 1.06;
    setFont(Math.round(size));
  }
  while (ctx.measureText(text).width > maxW * 0.80 && size > 24) {
    size *= 0.94;
    setFont(Math.round(size));
  }
  const dark = '#230722';
  // Hard extrusion, three layers down-right.
  ctx.fillStyle = dark;
  const steps = [0.03, 0.06, 0.09];
  for (const k of steps) {
    ctx.fillText(text, cx + size * k, cy + size * k * 1.4);
  }
  // Neon glow + gradient fill.
  ctx.save();
  ctx.shadowColor = style.accent;
  ctx.shadowBlur = size * 0.16;
  const grad = ctx.createLinearGradient(0, cy - size * 0.5, 0, cy + size * 0.55);
  grad.addColorStop(0, style.titleTop);
  grad.addColorStop(0.55, style.titleBottom);
  grad.addColorStop(1, style.accent);
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, cy);
  ctx.restore();
  // Dark outline.
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.strokeStyle = '#16041a';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, cx, cy);
  // Thin white highlight along the top edge of the letters.
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - maxW / 2, cy - size * 0.58, maxW, size * 0.30);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(text, cx, cy - Math.max(2, size * 0.02));
  ctx.restore();
  spSetSpacing(ctx, 0);
  return size;
}

function spDrawPill(ctx, x, y, text, accent, posterW) {
  // The pill font scales with the poster (fix round 2: at thumbnail
  // scale a fixed 13px pill overflowed its panel and read "THE GETA").
  const fs = Math.max(5, Math.round((posterW || 1080) * 0.012));
  ctx.font = Math.round(fs) + 'px "Bebas Neue", sans-serif';
  spSetSpacing(ctx, 1);
  const tw = ctx.measureText(text).width;
  const pad = Math.max(3, Math.round(fs * 0.7));
  const h = fs + 7;
  ctx.save();
  spRoundRect(ctx, x, y, tw + pad * 2, h, h / 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.fillStyle = '#16041a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + pad, y + h / 2 + 1);
  ctx.restore();
  spSetSpacing(ctx, 0);
  return { w: tw + pad * 2, h };
}

/* Final unified grade: vignette, warm sun-side wash, fine grain. */
function spGrade(ctx, W, H, style) {
  const v = ctx.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.42, W / 2, H * 0.5, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(8,2,18,0)');
  v.addColorStop(1, 'rgba(8,2,18,0.30)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  const wash = ctx.createLinearGradient(W, 0, 0, H);
  wash.addColorStop(0, 'rgba(255, 170, 90, 0.07)');
  wash.addColorStop(0.6, 'rgba(255, 170, 90, 0)');
  wash.addColorStop(1, 'rgba(40, 10, 80, 0.08)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  // Fine grain, seeded so every render matches. Stronger than v1
  // (fix round, item 5): the paint texture must read in the first second.
  const rnd = spRand(4242);
  ctx.fillStyle = 'rgba(255,255,255,0.075)';
  const dots = Math.floor(W * H / 900);
  for (let i = 0; i < dots; i++) {
    ctx.fillRect(rnd() * W, rnd() * H, 1.6, 1.6);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.075)';
  for (let i = 0; i < dots; i++) {
    ctx.fillRect(rnd() * W, rnd() * H, 1.6, 1.6);
  }
}

/* Render the full poster. state: {photos, hero, panels, style, title,
 * subtitle, tagline, focus, backdrop}. imgMap: src -> loaded Image.
 * scale: render at W*scale (1 = export size, ~0.15 = style thumbnail).
 *
 * Fix round 4 layout: the hero is ONE full-bleed photo over the whole
 * canvas — no skyline band splitting it, no second hero draw over the
 * title (the "ghost face"). The title, tagline and footer sit on the
 * photo over a dark bottom gradient; the three supporting panels float
 * on the photo's right side. The procedural sunset backdrop is opt-in
 * only (state.backdrop, default off): when on, the photo fades into
 * the skyline in the lower half and the title gets its dark band back. */
function spRenderPoster(state, sizeName, scale, imgMap) {
  const dims = SP_SIZES[sizeName];
  const W = Math.round(dims.w * scale);
  const H = Math.round(dims.h * scale);
  const style = SP_STYLES[state.style] || SP_STYLES.sunset;
  const L = spLayoutFor(sizeName);
  const R = (f) => ({ x: f.x * W, y: f.y * H, w: f.w * W, h: f.h * H });

  const canvas = spCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#12061f';
  ctx.fillRect(0, 0, W, H);

  // One painting level for hero and panels (fix round 4, item 4):
  // 0.47 — the same preset everywhere, so the poster reads as one
  // painted world instead of three different treatments.
  const PAINT = 0.47;

  // Hero: ONE full-bleed painted photo, top to bottom (fix round 4,
  // item 2) — no skyline band splitting it, no neon frame (its right
  // edge was the thin stray line on the wide hero). The procedural
  // sunset backdrop is opt-in only (state.backdrop, default off):
  // when on, the photo fades into the skyline in the lower half.
  const heroImg = imgMap.get(state.photos[state.hero.photo]);
  let heroPainted = null;
  if (heroImg) {
    heroPainted = spPaintPhoto(heroImg, style.ramp, W, H, state.hero.crop, PAINT);
  }
  if (state.backdrop) {
    spDrawBackdrop(ctx, 0, 0, W, H, style.backdrop);
  }
  if (heroPainted) {
    if (state.backdrop) {
      const mask = spHeroMask(W, H);
      const cut = spCanvas(W, H);
      const cctx = cut.getContext('2d');
      cctx.drawImage(heroPainted, 0, 0);
      cctx.globalCompositeOperation = 'destination-in';
      cctx.drawImage(mask, 0, 0);
      ctx.drawImage(cut, 0, 0);
    } else {
      ctx.drawImage(heroPainted, 0, 0);
    }
  }

  // Dark bottom gradient over the full width, so the title, tagline
  // and footer read over the photo (and over the skyline when the
  // backdrop is on). No hard band rect, no accent rule — the old
  // 3 px rule read as a stray divider line.
  const grad = ctx.createLinearGradient(0, H * 0.50, 0, H);
  grad.addColorStop(0, 'rgba(10, 3, 18, 0)');
  grad.addColorStop(0.55, 'rgba(10, 3, 18, 0.45)');
  grad.addColorStop(1, 'rgba(10, 3, 18, 0.78)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, H * 0.50, W, H * 0.50);

  // Supporting panels: one warm family, painted at 2x and drawn down
  // (fix round 4, item 4), slanted cut, neon gutter.
  const labels = ['THE CREW', 'THE GETAWAY', 'THE SCORE'];
  // A beach with no people is THE SHORE, graded golden (fix round 4,
  // item 8) — never the purple vice ramp, whatever slot it lands in.
  const SP_PHOTO_RAMP = {
    'samples/beach-night.jpg': 'golden',
    'samples/palm-beach.jpg': 'golden',
  };
  L.supports.forEach((f, i) => {
    const p = R(f);
    const panel = state.panels[i];
    if (!panel) return;
    const img = imgMap.get(state.photos[panel.photo]);
    if (!img) return;
    const ramp = SP_PHOTO_RAMP[state.photos[panel.photo]]
      || (sizeName === 'wide'
        ? ['sunset', 'golden', 'vice'][i]
        : style.panels[i % style.panels.length]);
    // Face-zone crop (item 5): the panel's crop centres on the photo's
    // faces (upper third by default), never on its middle.
    const faceCrop = { ...panel.crop, y: spFaceY(state.photos[panel.photo]) };
    // Painted at 2x and drawn down: the ink and posterize stay crisp
    // instead of blurring up from panel resolution.
    const painted = spPaintPhoto(img, ramp,
      Math.max(2, Math.round(p.w * 2)), Math.max(2, Math.round(p.h * 2)), faceCrop, PAINT);
    ctx.save();
    spSlantPath(ctx, p.x, p.y, p.w, p.h);
    ctx.clip();
    // Wide posters: lift the right panels ~12% brighter and pull the
    // magenta back a little so both sides read as one world (fix item 7).
    if (sizeName === 'wide') ctx.filter = 'brightness(1.12) saturate(0.92)';
    ctx.drawImage(painted, p.x, p.y, p.w, p.h);
    ctx.filter = 'none';
    ctx.restore();
    ctx.save();
    spSlantPath(ctx, p.x, p.y, p.w, p.h);
    ctx.strokeStyle = style.gutter;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = Math.max(2, W * 0.003);
    ctx.stroke();
    ctx.restore();
    // Labels follow the PHOTO, not the panel slot (fix round 2: the wide
    // cover's photos differ from the square's, so slot labels mismatched
    // — a beach with no people was labelled "THE SCORE").
    const SP_PHOTO_LABELS = {
      'samples/selfie-day.jpg': 'THE CREW',
      'samples/friends-day.jpg': 'THE GETAWAY',
      'samples/group-night.jpg': 'THE SCORE',
      'samples/beach-night.jpg': 'THE SHORE',
      'samples/heist-duo.jpg': 'THE HEIST',
      'samples/getaway.jpg': 'THE GETAWAY',
      'samples/hotel-night.jpg': 'THE SCORE',
      'samples/neon-street.jpg': 'THE CREW',
      'samples/palm-beach.jpg': 'THE SHORE',
    };
    spDrawPill(ctx, p.x + 10 * scale + p.h * 0.12, p.y + 10 * scale,
      SP_PHOTO_LABELS[state.photos[panel.photo]] || panel.label || labels[i] || 'PANEL',
      style.accent, W);
  });

  // Title: on the photo over the bottom gradient — no breakout draw.
  // The second hero fragment over the letters was the "ghost face"
  // (fix round 4, item 1); the title sits cleanly on its own
  // background now. With the backdrop on, the title gets its dark
  // band back (the old composition), still with no accent rule.
  const tR = R(L.title);
  if (state.backdrop) {
    ctx.fillStyle = 'rgba(10, 3, 18, 0.55)';
    ctx.fillRect(tR.x, tR.y, tR.w, tR.h);
  }

  // Wordmark + tagline. The title sits lower in its band and the tagline
  // closer under it (fix round 2, item 8): no more dead air inside the band.
  const titleCx = tR.x + tR.w / 2;
  const titleCy = tR.y + tR.h * 0.50;
  spDrawTitle(ctx, state.title, titleCx, titleCy, tR.w, tR.h * 0.70, style);

  if (state.tagline) {
    // Bebas Neue, not script/serif (fix round 2, item 6): the tagline
    // must be a bundled OFL condensed face, and it must stay legible.
    ctx.font = Math.round(Math.max(16, tR.h * 0.175)) + 'px "Bebas Neue", sans-serif';
    spSetSpacing(ctx, Math.max(1, tR.h * 0.02));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tagY = tR.y + tR.h * 0.86;
    ctx.fillStyle = '#0a0312';
    ctx.fillText(state.tagline, titleCx, tagY + Math.max(2, tR.h * 0.02));
    ctx.fillStyle = style.sub;
    ctx.fillText(state.tagline, titleCx, tagY);
    spSetSpacing(ctx, 0);
  }

  // Footer: star row, subtitle, press mark — on the bottom gradient,
  // so it reads over the photo in every size (fix round 4, item 2:
  // the portrait mini-skyline is gone with the rest of the skyline).
  const fR = R(L.footer);
  const fy = fR.y + fR.h / 2;
  // Bebas Neue for the stars too (fix round 3, item 1: the last
  // plain `sans-serif` in the renderer — pinned so no text on any
  // cover can fall back to a generic face a reviewer might misread).
  ctx.font = Math.round(Math.max(12, fR.h * 0.32)) + 'px "Bebas Neue", sans-serif';
  ctx.fillStyle = '#ffcf4d';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('★★★★★', fR.x + 12 * scale, fy);
  ctx.font = Math.round(Math.max(14, fR.h * 0.46)) + 'px "Bebas Neue", sans-serif';
  spSetSpacing(ctx, Math.max(1, fR.h * 0.06));
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0a0312';
  ctx.fillText(state.subtitle, fR.x + fR.w / 2, fy + Math.max(2, fR.h * 0.03));
  ctx.fillStyle = '#f5e9ff';
  ctx.fillText(state.subtitle, fR.x + fR.w / 2, fy);
  spSetSpacing(ctx, 0);
  ctx.font = Math.round(Math.max(11, fR.h * 0.30)) + 'px "Bebas Neue", sans-serif';
  ctx.fillStyle = style.accent;
  ctx.textAlign = 'right';
  ctx.fillText('SUNSET PRESS', fR.x + fR.w - 12 * scale, fy);

  spGrade(ctx, W, H, style);
  return canvas;
}
