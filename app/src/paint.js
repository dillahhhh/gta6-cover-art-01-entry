// SUNSET PRESS — painted-look pipeline (hand-written canvas, no ML).
// smooth -> posterize (10 levels) -> sunset gradient map (gradientMix 0.65)
// -> Sobel ink outline -> very light grain -> blend back the real photo 0.2.
// All functions are pure canvas work; no network, no libraries.
(function () {
  "use strict";

  var GRADIENT = [
    [0.00, 38, 14, 74],    // deep violet shadows
    [0.28, 168, 44, 92],   // magenta
    [0.55, 232, 92, 74],   // coral
    [0.80, 247, 168, 88],  // peach
    [1.00, 255, 216, 138], // gold highlights
  ];

  function mixStop(t) {
    var i = 0;
    while (i < GRADIENT.length - 2 && t > GRADIENT[i + 1][0]) i++;
    var a = GRADIENT[i], b = GRADIENT[i + 1];
    var f = (t - a[0]) / Math.max(0.0001, b[0] - a[0]);
    if (f < 0) f = 0; if (f > 1) f = 1;
    return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
  }

  // Paint an Image/Canvas source into a fresh canvas of w x h.
  // opts: { blur, levels, gradientMix, photoBlend, grain, ink }
  function paintPhoto(src, w, h, opts) {
    opts = opts || {};
    var blur = opts.blur == null ? 3 : opts.blur;
    var levels = opts.levels || 10;
    var gradientMix = opts.gradientMix == null ? 0.65 : opts.gradientMix;
    var photoBlend = opts.photoBlend == null ? 0.2 : opts.photoBlend;
    var grain = opts.grain == null ? 0.06 : opts.grain;
    var ink = opts.ink == null ? 0.55 : opts.ink;

    var cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    var ctx = cv.getContext("2d", { willReadFrequently: true });

    // 1. draw + smooth (blur flattens the photo into paint regions)
    var tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    var tctx = tmp.getContext("2d", { willReadFrequently: true });
    tctx.filter = "blur(" + blur + "px)";
    tctx.drawImage(src, 0, 0, w, h);
    tctx.filter = "none";

    var img = tctx.getImageData(0, 0, w, h);
    var d = img.data;
    var n = w * h;
    var lum = new Float32Array(n);

    // 2. posterize + gradient map
    var step = 255 / (levels - 1);
    for (var p = 0; p < n; p++) {
      var i4 = p * 4;
      var r = d[i4], g = d[i4 + 1], b = d[i4 + 2];
      var l = 0.299 * r + 0.587 * g + 0.114 * b;
      lum[p] = l;
      var t = l / 255;
      var gm = mixStop(t);
      var pr = Math.round(r / step) * step;
      var pg = Math.round(g / step) * step;
      var pb = Math.round(b / step) * step;
      d[i4]     = gm[0] * gradientMix + pr * (1 - gradientMix);
      d[i4 + 1] = gm[1] * gradientMix + pg * (1 - gradientMix);
      d[i4 + 2] = gm[2] * gradientMix + pb * (1 - gradientMix);
    }

    // 3. Sobel ink on strong edges (thin dark illustrated line)
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var c = y * w + x;
        var gx =
          -lum[c - w - 1] - 2 * lum[c - 1] - lum[c + w - 1] +
           lum[c - w + 1] + 2 * lum[c + 1] + lum[c + w + 1];
        var gy =
          -lum[c - w - 1] - 2 * lum[c - w] - lum[c - w + 1] +
           lum[c + w - 1] + 2 * lum[c + w] + lum[c + w + 1];
        var mag = Math.sqrt(gx * gx + gy * gy) / 255;
        if (mag > 0.55) {
          var k = Math.min(1, (mag - 0.55) * 2.2) * ink;
          var i2 = c * 4;
          d[i2] *= (1 - k); d[i2 + 1] *= (1 - k); d[i2 + 2] *= (1 - k);
        }
      }
    }

    // 4. very light grain
    if (grain > 0) {
      var amp = 255 * grain;
      for (var q = 0; q < n; q++) {
        var j = q * 4;
        var nz = (Math.random() * 2 - 1) * amp;
        d[j] += nz; d[j + 1] += nz; d[j + 2] += nz;
      }
    }

    ctx.putImageData(img, 0, 0);

    // 5. blend a little of the real photo back so faces stay readable
    if (photoBlend > 0) {
      ctx.globalAlpha = photoBlend;
      ctx.drawImage(src, 0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    return cv;
  }

  // Cover-fit draw of img into (x, y, w, h) with a focus point.
  // focusX/focusY (0..1) pick which part of the photo stays centred;
  // zoom > 1 crops tighter. Returns nothing.
  function drawCover(ctx, img, x, y, w, h, focusX, focusY, zoom) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    var s = Math.max(w / iw, h / ih) * (zoom || 1);
    var dw = iw * s, dh = ih * s;
    var fx = focusX == null ? 0.5 : focusX;
    var fy = focusY == null ? 0.5 : focusY;
    var dx = x + (w - dw) * fx;
    var dy = y + (h - dh) * fy;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  // Painted cover draw: paint the photo once at box size, then draw it.
  function drawPaintedCover(ctx, img, x, y, w, h, focusX, focusY, zoom, opts) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    var s = Math.max(w / iw, h / ih) * (zoom || 1);
    var sw = Math.ceil(w / s), sh = Math.ceil(h / s);
    var fx = focusX == null ? 0.5 : focusX;
    var fy = focusY == null ? 0.5 : focusY;
    var sx = Math.max(0, Math.min(iw - sw, (iw * fx) - sw / 2));
    var sy = Math.max(0, Math.min(ih - sh, (ih * fy) - sh / 2));
    var src = document.createElement("canvas");
    src.width = sw; src.height = sh;
    src.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    var painted = paintPhoto(src, w, h, opts);
    ctx.drawImage(painted, x, y);
  }

  window.SPPaint = { paintPhoto: paintPhoto, drawCover: drawCover, drawPaintedCover: drawPaintedCover };
})();
