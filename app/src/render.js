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

/* Fractional layout per size: hero rect, three supporting rects,
 * title band, footer. Fractions of (W, H). */
function spLayoutFor(sizeName) {
  // (fix round 2, item 8: the portrait band was too tall — the tagline
  // sat ~200 px above the footer with dead air between them. The band
  // is shorter now and the footer rides up to meet it.)
  if (sizeName === 'portrait') {
    return {
      hero: { x: 0, y: 0, w: 0.62, h: 0.54 },
      supports: [
        { x: 0.635, y: 0, w: 0.365, h: 0.16 },
        { x: 0.635, y: 0.185, w: 0.365, h: 0.16 },
        { x: 0.635, y: 0.37, w: 0.365, h: 0.16 },
      ],
      title: { x: 0, y: 0.545, w: 1, h: 0.22 },
      footer: { x: 0, y: 0.80, w: 1, h: 0.09 },
    };
  }
  if (sizeName === 'wide') {
    return {
      hero: { x: 0, y: 0, w: 0.56, h: 0.70 },
      supports: [
        { x: 0.575, y: 0, w: 0.425, h: 0.22 },
        { x: 0.575, y: 0.24, w: 0.425, h: 0.22 },
        { x: 0.575, y: 0.48, w: 0.425, h: 0.22 },
      ],
      title: { x: 0, y: 0.715, w: 1, h: 0.20 },
      footer: { x: 0, y: 0.93, w: 1, h: 0.07 },
    };
  }
  return {
    hero: { x: 0, y: 0, w: 0.63, h: 0.66 },
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
 * fill, dark outline, white top highlight. Title fills ~70% of the width. */
function spDrawTitle(ctx, text, cx, cy, maxW, maxH, style) {
  // Start big and shrink to fit the width: on wide posters the band is
  // short but the width is plentiful, so the title must grow to fill it.
  let size = maxH * 0.95;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const setFont = (s) => { ctx.font = s + 'px Anton, "Arial Black", sans-serif'; };
  setFont(Math.round(size));
  spSetSpacing(ctx, Math.max(1, size * 0.02));
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

/* Faint skyline strip behind the portrait poster's footer, so the bottom
 * of the poster is never empty black (fix round, item 8). Buildings are
 * a touch lighter than the background, with a few neon windows. */
function spMiniSkyline(ctx, x, y, w, h, accent) {
  if (h <= 4) return;
  const rnd = spRand(5150);
  ctx.save();
  // Buildings clearly lighter than the poster's near-black footer
  // (fix round 2, item 8: the old #1c0a2c was invisible on #12061f).
  ctx.fillStyle = '#3a1a5e';
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.04 + rnd() * 0.06);
    const bh = h * (0.35 + rnd() * 0.6);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    for (let wy = y + h - bh + 4; wy < y + h - 3; wy += 7) {
      if (rnd() > 0.5) {
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(bx + bw * 0.25, wy, 2.5, 3);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#3a1a5e';
      }
    }
    bx += bw + 2;
  }
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.8;
  ctx.fillRect(x, y, w, 2);
  ctx.restore();
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
 * scale: render at W*scale (1 = export size, ~0.15 = style thumbnail). */
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

  const heroR = R(L.hero);
  const heroImg = imgMap.get(state.photos[state.hero.photo]);
  let heroPainted = null;
  if (heroImg) {
    heroPainted = spPaintPhoto(heroImg, style.ramp, Math.max(2, Math.round(heroR.w)), Math.max(2, Math.round(heroR.h)), state.hero.crop, 0.35);
  }

  // Hero: procedural sunset backdrop, then the painted photo cut out
  // through the draggable subject-focus ellipse.
  if (state.backdrop) {
    spDrawBackdrop(ctx, heroR.x, heroR.y, heroR.w, heroR.h, style.backdrop);
  }
  if (heroPainted) {
    if (state.backdrop) {
      // Full-bleed vertical fade (fix round 2, item 1): the photo fills
      // the hero to every edge and fades into the sunset at the chests,
      // so the car's dark hood — the upside-down "reflection" — never
      // shows, and there is no oval sticker edge at all.
      const mask = spHeroMask(Math.round(heroR.w), Math.round(heroR.h));
      const cut = spCanvas(heroR.w, heroR.h);
      const cctx = cut.getContext('2d');
      cctx.drawImage(heroPainted, 0, 0);
      cctx.globalCompositeOperation = 'destination-in';
      cctx.drawImage(mask, 0, 0);
      ctx.drawImage(cut, heroR.x, heroR.y);
    } else {
      ctx.drawImage(heroPainted, heroR.x, heroR.y);
    }
    // Thin neon frame around the hero.
    ctx.strokeStyle = style.gutter;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(2, W * 0.003);
    ctx.strokeRect(heroR.x, heroR.y, heroR.w, heroR.h);
    ctx.globalAlpha = 1;
  }

  // Supporting panels: each a different treatment, slanted cut, neon gutter.
  const labels = ['THE CREW', 'THE GETAWAY', 'THE SCORE'];
  L.supports.forEach((f, i) => {
    const p = R(f);
    const panel = state.panels[i];
    if (!panel) return;
    const img = imgMap.get(state.photos[panel.photo]);
    if (!img) return;
    // Wide posters grade all three panels from one warm family
    // (fix round 2, item 9): sunset / golden / vice, not three moods.
    const ramp = sizeName === 'wide'
      ? ['sunset', 'golden', 'vice'][i]
      : style.panels[i % style.panels.length];
    // Face-zone crop (item 5): the panel's crop centres on the photo's
    // faces (upper third by default), never on its middle.
    const faceCrop = { ...panel.crop, y: spFaceY(state.photos[panel.photo]) };
    const painted = spPaintPhoto(img, ramp, Math.max(2, Math.round(p.w)), Math.max(2, Math.round(p.h)), faceCrop, 0.35);
    ctx.save();
    spSlantPath(ctx, p.x, p.y, p.w, p.h);
    ctx.clip();
    // Wide posters: lift the right panels ~12% brighter and pull the
    // magenta back a little so both sides read as one world (fix item 7).
    if (sizeName === 'wide') ctx.filter = 'brightness(1.12) saturate(0.92)';
    ctx.drawImage(painted, p.x, p.y);
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

  // Title band: dark translucent band, then the breakout, then the wordmark.
  const tR = R(L.title);
  ctx.fillStyle = 'rgba(10, 3, 18, 0.55)';
  ctx.fillRect(tR.x, tR.y, tR.w, tR.h);
  ctx.fillStyle = style.accent;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(tR.x, tR.y, tR.w, Math.max(2, 3 * scale));
  ctx.globalAlpha = 1;

  // Wordmark + tagline. The title sits lower in its band and the tagline
  // closer under it (fix round 2, item 8): no more dead air inside the band.
  const titleCx = tR.x + tR.w / 2;
  const titleCy = tR.y + tR.h * 0.50;
  const titleSize = spDrawTitle(ctx, state.title, titleCx, titleCy, tR.w, tR.h * 0.70, style);

  // Hero breakout (fix round 2, item 7): the subjects' SHOULDERS and
  // upper chests re-drawn over the top of the title letters — never the
  // faces, never a full-width strip. The breakout's bottom lands ~26 px
  // below the top of the capitals (its mask fades out first), so the
  // shoulders cross the letters' tops and the letters stay readable.
  // The strip is centred on the couple (hero width) and fades at both
  // ends, so the outer letters stay clean.
  if (heroPainted) {
    const boH = heroR.h * 0.24;
    const bo = spCanvas(heroR.w, boH);
    const bctx = bo.getContext('2d');
    bctx.drawImage(heroPainted, 0, -heroR.h * 0.25, heroR.w, heroR.h);
    const bmask = spFocusMask(Math.round(heroR.w), Math.round(boH),
      { x: state.focus.x, y: 0.42 }, heroR.w * 0.30, boH * 0.50);
    bctx.globalCompositeOperation = 'destination-in';
    bctx.drawImage(bmask, 0, 0);
    const tops = titleCy - titleSize * 0.35;
    ctx.save();
    ctx.beginPath();
    ctx.rect(tR.x, tR.y, tR.w, tR.h);
    ctx.clip();
    ctx.drawImage(bo, heroR.x, tops + 40 - boH);
    ctx.restore();
  }

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

  // Footer: star row, subtitle, press mark. On portrait the footer sits
  // on a faint skyline so the bottom is never empty black (fix item 8).
  const fR = R(L.footer);
  if (sizeName === 'portrait') {
    spMiniSkyline(ctx, fR.x, fR.y, fR.w, fR.h, style.accent);
  }
  const fy = fR.y + fR.h / 2;
  ctx.font = Math.round(Math.max(12, fR.h * 0.32)) + 'px sans-serif';
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
