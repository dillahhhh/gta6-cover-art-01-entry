// SUNSET PRESS — poster layout engine (hand-written, no libraries).
// One hero photo, painted full-bleed, + three slanted supporting panels
// + a huge gold-to-pink wordmark. Three export sizes, each re-laid out
// (never just re-cropped) so faces stay clear of type in every size.
(function () {
  "use strict";

  var SIZES = {
    wide:     { w: 1920, h: 1080 },
    square:   { w: 1080, h: 1080 },
    portrait: { w: 1080, h: 1350 },
  };

  // Six painted grades. Only the grade changes; layout never does.
  var STYLES = {
    sunset:  { mix: 0.65, blend: 0.20, tint: [255, 120, 60],  tintA: 0.05 },
    neon:    { mix: 0.72, blend: 0.16, tint: [190, 60, 255],  tintA: 0.07 },
    teal:    { mix: 0.60, blend: 0.22, tint: [40, 200, 190],  tintA: 0.06 },
    warm:    { mix: 0.62, blend: 0.22, tint: [255, 170, 80],  tintA: 0.06 },
    golden:  { mix: 0.58, blend: 0.24, tint: [255, 200, 90],  tintA: 0.05 },
    vice:    { mix: 0.70, blend: 0.18, tint: [255, 80, 160],  tintA: 0.07 },
  };

  var PANELS = [
    { photo: "friends-day.jpg", label: "THE CREW",    focusX: 0.5, focusY: 0.28 },
    { photo: "getaway.jpg",     label: "THE GETAWAY", focusX: 0.5, focusY: 0.50 },
    { photo: "palm-beach.jpg",  label: "THE SCORE",   focusX: 0.5, focusY: 0.45 },
  ];

  var HERO = "hero-real.jpg";
  var TITLE = "SUNSET HEIST";
  var KICKER = "ONE LAST JOB.";
  var FOOTER = "VICE CITY \u00B7 TONIGHT";
  var BRAND = "SUNSET PRESS";

  var imgCache = {};
  function loadImage(src) {
    if (imgCache[src]) return imgCache[src];
    var p = new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = rej;
      im.src = "samples/" + src;
    });
    imgCache[src] = p;
    return p;
  }

  function fontsReady() {
    var loads = [];
    try {
      loads.push(document.fonts.load('150px Anton'));
      loads.push(document.fonts.load('30px "Bebas Neue"'));
      loads.push(document.fonts.ready);
    } catch (e) { /* fonts API unavailable: proceed, fallback faces */ }
    return Promise.all(loads).catch(function () {});
  }

  function paintOpts(style) {
    return { blur: 3, levels: 10, gradientMix: style.mix, photoBlend: style.blend, grain: 0.06, ink: 0.55 };
  }

  function tint(ctx, w, h, style) {
    if (!style.tintA) return;
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = style.tintA;
    ctx.fillStyle = "rgb(" + style.tint[0] + "," + style.tint[1] + "," + style.tint[2] + ")";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Huge original wordmark: gold-to-pink gradient, hard offset extrusion,
  // dark outline, neon glow. text drawn at (x, baselineY), left aligned.
  function drawWordmark(ctx, text, x, baselineY, size) {
    ctx.save();
    ctx.font = size + 'px Anton, "Arial Black", sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    var top = baselineY - size;
    var grad = ctx.createLinearGradient(0, top, 0, baselineY + size * 0.12);
    grad.addColorStop(0, "#ffe27a");
    grad.addColorStop(0.45, "#ffb347");
    grad.addColorStop(0.75, "#ff5e8a");
    grad.addColorStop(1, "#e83e7f");
    // hard extrusion, two dark layers down-right
    ctx.fillStyle = "#180a26";
    ctx.fillText(text, x + size * 0.045, baselineY + size * 0.055);
    ctx.fillText(text, x + size * 0.09, baselineY + size * 0.11);
    // neon glow + gradient face
    ctx.shadowColor = "rgba(255,94,138,0.55)";
    ctx.shadowBlur = size * 0.16;
    ctx.fillStyle = grad;
    ctx.fillText(text, x, baselineY);
    ctx.shadowBlur = 0;
    // dark outline + thin top highlight
    ctx.lineWidth = Math.max(2, size * 0.035);
    ctx.strokeStyle = "rgba(24,8,32,0.9)";
    ctx.strokeText(text, x, baselineY);
    ctx.restore();
  }

  function textW(ctx, text, font) {
    ctx.save();
    ctx.font = font;
    var w = ctx.measureText(text).width;
    ctx.restore();
    return w;
  }

  function kickerText(ctx, text, x, baselineY, size, color) {
    ctx.save();
    ctx.font = size + 'px "Bebas Neue", "Arial Narrow", sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = color || "#ffe9c9";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillText(text, x, baselineY);
    ctx.restore();
  }

  function footerLine(ctx, w, baselineY, size) {
    ctx.save();
    ctx.font = size + 'px "Bebas Neue", "Arial Narrow", sans-serif';
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff3dd";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    ctx.textAlign = "left";
    ctx.fillText("\u2605\u2605\u2605\u2605\u2605  " + FOOTER, 60, baselineY);
    ctx.textAlign = "right";
    ctx.fillText(BRAND, w - 60, baselineY);
    ctx.restore();
  }

  // One slanted supporting panel + pill label UNDER it (never on a head).
  function drawPanel(ctx, img, x, y, w, h, label, focusX, focusY, style) {
    var slant = Math.round(w * 0.055);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + slant, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - slant, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.clip();
    // painted photo, cropped on its focus point
    var box = document.createElement("canvas");
    box.width = w; box.height = h;
    SPPaint.drawPaintedCover(box.getContext("2d"), img, 0, 0, w, h, focusX, focusY, 1.0, paintOpts(style));
    ctx.drawImage(box, x, y);
    // warm grade wash so the three panels feel like one poster
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + slant, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - slant, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,190,120,0.85)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // pill label below the panel
    var fs = Math.max(17, Math.round(h * 0.13));
    ctx.save();
    ctx.font = fs + 'px "Bebas Neue", "Arial Narrow", sans-serif';
    var tw = ctx.measureText(label).width;
    var pw = tw + fs * 1.1, ph = fs + 10;
    var px = x + (w - pw) / 2, py = y + h + 7;
    ctx.fillStyle = "rgba(12,6,20,0.88)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = "#ffd98a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, px + pw / 2, py + ph / 2 + 1);
    ctx.restore();
  }

  function bottomGradient(ctx, x, y, w, h, strength) {
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "rgba(10,5,20,0)");
    g.addColorStop(1, "rgba(10,5,20," + strength + ")");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }

  function layoutWide(ctx, W, H, hero, style) {
    // Hero: real lakeside photo, full-bleed. Faces sit right-of-centre
    // (young man x .42-.63, older man x .63-.80), so the hero is framed
    // left-aligned and the title lives bottom-left over the lake water.
    var box = document.createElement("canvas");
    box.width = W; box.height = H;
    var bctx = box.getContext("2d");
    SPPaint.drawPaintedCover(bctx, hero, 0, 0, W, H, 0.5, 0.30, 1.04, paintOpts(style));
    ctx.drawImage(box, 0, 0);
    tint(ctx, W, H, style);
    bottomGradient(ctx, 0, H * 0.58, W * 0.52, H * 0.42, 0.55);

    // Title + kicker, bottom-left over the water (centre x ~0.23 of width).
    // Right edge of the title stays ~170px clear of the young man's face.
    kickerText(ctx, KICKER, 230, 778, 34);
    drawWordmark(ctx, "SUNSET", 230, 908, 140);
    drawWordmark(ctx, "HEIST", 230, 1038, 140);

    // Three slanted panels, bottom-right stack. They start below the older
    // man's chin and right of the young man's face, so no head is covered.
    var px = 1400, pw = 460;
    drawPanel(ctx, PANELS[0].img, px, 600, pw, 112, PANELS[0].label, PANELS[0].focusX, PANELS[0].focusY, style);
    drawPanel(ctx, PANELS[1].img, px, 752, pw, 112, PANELS[1].label, PANELS[1].focusX, PANELS[1].focusY, style);
    drawPanel(ctx, PANELS[2].img, px, 904, pw, 112, PANELS[2].label, PANELS[2].focusX, PANELS[2].focusY, style);

    footerLine(ctx, W, 1070, 24);
  }

  function layoutSquare(ctx, W, H, hero, style) {
    // Hero across the top (full photo width; both faces sit x .42-.80).
    // Chin of the front man ends ~y575; kicker sits just below it.
    var box = document.createElement("canvas");
    box.width = W; box.height = 719;
    var bctx = box.getContext("2d");
    SPPaint.drawPaintedCover(bctx, hero, 0, 0, W, 719, 0.5, 0.5, 1.0, paintOpts(style));
    ctx.drawImage(box, 0, 0);
    tint(ctx, W, H, style);
    bottomGradient(ctx, 0, 520, W, 200, 0.5);

    var kickerY = 612; // ~10px clear of the chin (chin ~y575)
    var kx = (W - textW(ctx, KICKER, '26px "Bebas Neue"')) / 2;
    kickerText(ctx, KICKER, kx, kickerY, 26);
    var tSize = 118;
    var tw = textW(ctx, TITLE, tSize + 'px Anton');
    drawWordmark(ctx, TITLE, (W - tw) / 2, 748, tSize);

    // Panels row under the title; labels ride below each panel.
    var pw = 330, ph = 222, py = 768, gap = 15;
    var x0 = (W - (pw * 3 + gap * 2)) / 2;
    for (var i = 0; i < 3; i++) {
      var p = PANELS[i];
      drawPanel(ctx, p.img, x0 + i * (pw + gap), py, pw, ph, p.label, p.focusX, p.focusY, style);
    }
    footerLine(ctx, W, 1068, 22);
  }

  function layoutPortrait(ctx, W, H, hero, style) {
    // Same hero top as square; kicker ~20px below the chin, then title,
    // then a tall panels row, then the footer.
    var box = document.createElement("canvas");
    box.width = W; box.height = 719;
    var bctx = box.getContext("2d");
    SPPaint.drawPaintedCover(bctx, hero, 0, 0, W, 719, 0.5, 0.5, 1.0, paintOpts(style));
    ctx.drawImage(box, 0, 0);
    tint(ctx, W, H, style);
    bottomGradient(ctx, 0, 520, W, 200, 0.5);

    var kickerY = 618; // ~20px clear of the chin (chin ~y575)
    var kx = (W - textW(ctx, KICKER, '26px "Bebas Neue"')) / 2;
    kickerText(ctx, KICKER, kx, kickerY, 26);
    var tSize = 118;
    var tw = textW(ctx, TITLE, tSize + 'px Anton');
    drawWordmark(ctx, TITLE, (W - tw) / 2, 752, tSize);

    var pw = 330, ph = 430, py = 782, gap = 15;
    var x0 = (W - (pw * 3 + gap * 2)) / 2;
    for (var i = 0; i < 3; i++) {
      var p = PANELS[i];
      drawPanel(ctx, p.img, x0 + i * (pw + gap), py, pw, ph, p.label, p.focusX, p.focusY, style);
    }
    footerLine(ctx, W, 1325, 22);
  }

  function renderPoster(canvas, sizeKey, opts) {
    opts = opts || {};
    var size = SIZES[sizeKey];
    if (!size) return Promise.reject(new Error("unknown size " + sizeKey));
    var style = STYLES[opts.style || "sunset"] || STYLES.sunset;
    canvas.width = size.w;
    canvas.height = size.h;
    var ctx = canvas.getContext("2d");
    return Promise.all([
      loadImage(HERO),
      loadImage(PANELS[0].photo),
      loadImage(PANELS[1].photo),
      loadImage(PANELS[2].photo),
      fontsReady(),
    ]).then(function (imgs) {
      var hero = imgs[0];
      PANELS[0].img = imgs[1];
      PANELS[1].img = imgs[2];
      PANELS[2].img = imgs[3];
      ctx.fillStyle = "#12081d";
      ctx.fillRect(0, 0, size.w, size.h);
      if (sizeKey === "wide") layoutWide(ctx, size.w, size.h, hero, style);
      else if (sizeKey === "square") layoutSquare(ctx, size.w, size.h, hero, style);
      else layoutPortrait(ctx, size.w, size.h, hero, style);
      canvas.setAttribute("data-ready", "1");
      return canvas;
    });
  }

  window.SPPPoster = {
    SIZES: SIZES, STYLES: STYLES, PANELS: PANELS,
    renderPoster: renderPoster, loadImage: loadImage,
  };
})();
