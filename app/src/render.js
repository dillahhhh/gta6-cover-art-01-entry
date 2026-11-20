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
  if (sizeName === 'portrait') {
    return {
      hero: { x: 0, y: 0, w: 0.62, h: 0.54 },
      supports: [
        { x: 0.635, y: 0, w: 0.365, h: 0.16 },
        { x: 0.635, y: 0.185, w: 0.365, h: 0.16 },
        { x: 0.635, y: 0.37, w: 0.365, h: 0.16 },
      ],
      title: { x: 0, y: 0.555, w: 1, h: 0.30 },
      footer: { x: 0, y: 0.87, w: 1, h: 0.09 },
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
    hero: { x: 0, y: 0, w: 0.60, h: 0.64 },
    supports: [
      { x: 0.615, y: 0, w: 0.385, h: 0.20 },
      { x: 0.615, y: 0.22, w: 0.385, h: 0.20 },
      { x: 0.615, y: 0.44, w: 0.385, h: 0.20 },
    ],
    title: { x: 0, y: 0.655, w: 1, h: 0.245 },
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

function spDrawPill(ctx, x, y, text, accent) {
  const fs = Math.max(11, Math.round(y * 0 + 13));
  ctx.font = Math.round(fs) + 'px "Bebas Neue", sans-serif';
  spSetSpacing(ctx, 1);
  const tw = ctx.measureText(text).width;
  const pad = 9;
  const h = fs + 9;
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
  // Fine grain, seeded so every render matches.
  const rnd = spRand(4242);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  const dots = Math.floor(W * H / 900);
  for (let i = 0; i < dots; i++) {
    ctx.fillRect(rnd() * W, rnd() * H, 1.4, 1.4);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < dots; i++) {
    ctx.fillRect(rnd() * W, rnd() * H, 1.4, 1.4);
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
    heroPainted = spPaintPhoto(heroImg, style.ramp, Math.max(2, Math.round(heroR.w)), Math.max(2, Math.round(heroR.h)), state.hero.crop, 1);
  }

  // Hero: procedural sunset backdrop, then the painted photo cut out
  // through the draggable subject-focus ellipse.
  if (state.backdrop) {
    spDrawBackdrop(ctx, heroR.x, heroR.y, heroR.w, heroR.h, style.backdrop);
  }
  if (heroPainted) {
    if (state.backdrop) {
      // Wide feathered ellipse: the photo dominates the hero and the
      // painted backdrop only frames it at the edges.
      const mask = spFocusMask(Math.round(heroR.w), Math.round(heroR.h),
        state.focus, heroR.w * 0.38, heroR.h * 0.52);
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
    const ramp = style.panels[i % style.panels.length];
    const painted = spPaintPhoto(img, ramp, Math.max(2, Math.round(p.w)), Math.max(2, Math.round(p.h)), panel.crop, 1);
    ctx.save();
    spSlantPath(ctx, p.x, p.y, p.w, p.h);
    ctx.clip();
    ctx.drawImage(painted, p.x, p.y);
    ctx.restore();
    ctx.save();
    spSlantPath(ctx, p.x, p.y, p.w, p.h);
    ctx.strokeStyle = style.gutter;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = Math.max(2, W * 0.003);
    ctx.stroke();
    ctx.restore();
    spDrawPill(ctx, p.x + 10 * scale + p.h * 0.12, p.y + 10 * scale, panel.label || labels[i] || 'PANEL', style.accent);
  });

  // Title band: dark translucent band, then the breakout, then the wordmark.
  const tR = R(L.title);
  ctx.fillStyle = 'rgba(10, 3, 18, 0.55)';
  ctx.fillRect(tR.x, tR.y, tR.w, tR.h);
  ctx.fillStyle = style.accent;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(tR.x, tR.y, tR.w, Math.max(2, 3 * scale));
  ctx.globalAlpha = 1;

  // Hero breakout: the subject's shoulders re-drawn over the top of the
  // title band, feathered, so the hero breaks the frame. The breakout
  // samples the hero image's middle (shoulders / roofline) and spills it
  // below the hero's bottom edge.
  if (heroPainted) {
    const boH = heroR.h * 0.34;
    const bo = spCanvas(heroR.w, boH);
    const bctx = bo.getContext('2d');
    bctx.drawImage(heroPainted, 0, -heroR.h * 0.42, heroR.w, heroR.h);
    const mask = spFocusMask(Math.round(heroR.w), Math.round(boH),
      { x: state.focus.x, y: 0.45 }, heroR.w * 0.34, boH * 0.55);
    bctx.globalCompositeOperation = 'destination-in';
    bctx.drawImage(mask, 0, 0);
    ctx.drawImage(bo, heroR.x, heroR.y + heroR.h - boH * 0.55);
  }

  // Wordmark + tagline.
  const titleCx = tR.x + tR.w / 2;
  const titleCy = tR.y + tR.h * 0.42;
  spDrawTitle(ctx, state.title, titleCx, titleCy, tR.w, tR.h * 0.70, style);
  if (state.tagline) {
    ctx.font = Math.round(Math.max(14, tR.h * 0.13)) + 'px Yellowtail, cursive';
    ctx.fillStyle = style.sub;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.tagline, titleCx, tR.y + tR.h * 0.84);
  }

  // Footer: star row, subtitle, press mark.
  const fR = R(L.footer);
  const fy = fR.y + fR.h / 2;
  ctx.font = Math.round(Math.max(12, fR.h * 0.32)) + 'px sans-serif';
  ctx.fillStyle = '#ffcf4d';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('★★★★★', fR.x + 12 * scale, fy);
  ctx.font = Math.round(Math.max(13, fR.h * 0.40)) + 'px "Bebas Neue", sans-serif';
  spSetSpacing(ctx, Math.max(1, fR.h * 0.06));
  ctx.fillStyle = '#f5e9ff';
  ctx.textAlign = 'center';
  ctx.fillText(state.subtitle, fR.x + fR.w / 2, fy);
  spSetSpacing(ctx, 0);
  ctx.font = Math.round(Math.max(11, fR.h * 0.30)) + 'px "Bebas Neue", sans-serif';
  ctx.fillStyle = style.accent;
  ctx.textAlign = 'right';
  ctx.fillText('SUNSET PRESS', fR.x + fR.w - 12 * scale, fy);

  spGrade(ctx, W, H, style);
  return canvas;
}
