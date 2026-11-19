// Auto-composition: where is the subject in a photo, and does a crop keep it?
//
// Honest scope: there is NO bundled face detector and NO network call here,
// so this is not face recognition. What runs offline is:
//   1. a skin-tone cluster heuristic (warm skin-coloured blobs, grouped on a
//      coarse grid) — one blob reads as a single face, two as two people,
//      three or more as a group;
//   2. a saliency fallback (local contrast + saturation) when no skin is
//      found — a car, a tower, a bright sign;
//   3. a manual click fallback: the user taps the subject on the preview and
//      that point becomes the focus.
//
// KNOWN LIMITS (measured on the four sample photos, 2026-11-19): the
// detector counts two people in Heist Duo but its midpoint sits left of the
// pair (the man's face, sunglasses + shadow, reads weakly, and a warm
// window joins the count); it finds Getaway and Hotel Night within 0.25 of
// their curated focus; it MISSES Beach Night, picking the pink clouds over
// the tiny couple on the boardwalk. Samples therefore keep their curated
// focus and the detector is only a first guess for uploads, with the click
// fallback covering the misses. Do not present this as face detection.
// The pure maths (analyse + cover-fit) lives here with no DOM in it, so it
// is unit-testable in Node; only detectFocus() touches a canvas.

/** Skin-tone test on one pixel (r, g, b in 0..255). Warm skin lives where
 *  red leads green leads blue, with a bounded red-blue gap — and at a
 *  mid luminance: near-white window light and neon are not skin, however
 *  warm they look. */
export function isSkinPixel(r, g, b) {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 50 || lum > 215) return false;
  if (r < 60 || r <= g + 10 || g <= b + 6) return false;
  const rb = r - b;
  if (rb < 28 || rb > 150) return false;
  if (r - g > 95) return false;
  return true;
}

/**
 * Find the subject of a downsampled image. `data` is RGBA bytes, `w`/`h`
 * its size (callers pass a ~320 px wide copy). Returns
 * { x, y, kind } with x/y as fractions of the image and kind one of
 * 'single-face' | 'two-people' | 'group' | 'subject' | 'landscape'.
 */
export function analyzePixels(w, h, data) {
  const cols = 20;
  const rows = Math.max(4, Math.round((h / w) * cols));
  const cw = w / cols;
  const ch = h / rows;
  // Per-cell: skin fraction, mean luminance, mean saturation.
  const skin = new Float32Array(cols * rows);
  const lum = new Float32Array(cols * rows);
  const sat = new Float32Array(cols * rows);
  const count = new Float32Array(cols * rows);
  for (let y = 0; y < h; y++) {
    const row = Math.min(rows - 1, Math.floor(y / ch));
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const c = row * cols + Math.min(cols - 1, Math.floor(x / cw));
      count[c] += 1;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      lum[c] += 0.299 * r + 0.587 * g + 0.114 * b;
      sat[c] += mx === 0 ? 0 : (mx - mn) / mx;
      if (isSkinPixel(r, g, b)) skin[c] += 1;
    }
  }
  for (let c = 0; c < cols * rows; c++) {
    if (count[c] > 0) {
      skin[c] /= count[c];
      lum[c] /= count[c];
      sat[c] /= count[c];
    }
  }

  // Group skin-dense cells into blobs (4-connected flood fill on the grid).
  // A blob only counts as a person if it is compact: a real face is a small
  // dense patch, while a warm sunset sky or a sunlit wall is a wide diffuse
  // wash — same colour, wrong shape. Wide, sparse or very low blobs are
  // rejected so a car photo at golden hour does not read as two people.
  const skinCell = (c) => skin[c] > 0.22;
  const seen = new Uint8Array(cols * rows);
  const blobs = [];
  for (let start = 0; start < cols * rows; start++) {
    if (!skinCell(start) || seen[start]) continue;
    let sx = 0;
    let sy = 0;
    let n = 0;
    let minX = cols;
    let maxX = -1;
    let minY = rows;
    let maxY = -1;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const c = stack.pop();
      const cx = c % cols;
      const cy = Math.floor(c / cols);
      sx += cx + 0.5;
      sy += cy + 0.5;
      n += 1;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const nc = ny * cols + nx;
        if (!seen[nc] && skinCell(nc)) {
          seen[nc] = 1;
          stack.push(nc);
        }
      }
    }
    // A blob only counts as a person if it covers real area (not noise),
    // is compact (fills its own bounding box), is face-sized (not a whole
    // sky or wall), and is not sitting at the very bottom of the frame.
    if (n < 2) continue;
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const fill = n / (bw * bh);
    const cyFrac = sy / n / rows;
    if (fill < 0.3 || bw > cols * 0.38 || bh > rows * 0.45 || cyFrac > 0.75) continue;
    blobs.push({ x: sx / n / cols, y: sy / n / rows, cells: n });
  }
  blobs.sort((a, b) => b.cells - a.cells);
  const people = blobs.filter((b) => b.cells >= Math.max(2, blobs[0] ? blobs[0].cells * 0.25 : 2));
  if (people.length === 1) {
    return { x: people[0].x, y: Math.max(0.08, people[0].y - 0.04), kind: 'single-face' };
  }
  if (people.length === 2) {
    return {
      x: (people[0].x + people[1].x) / 2,
      y: Math.max(0.08, (people[0].y + people[1].y) / 2 - 0.04),
      kind: 'two-people',
    };
  }
  if (people.length >= 3) {
    let x = 0;
    let y = 0;
    people.forEach((p) => { x += p.x; y += p.y; });
    return { x: x / people.length, y: Math.max(0.08, y / people.length - 0.04), kind: 'group' };
  }

  // No skin: saliency = local contrast (cell vs its neighbours) + saturation,
  // with a mild lower-frame prior (the subject of a photo usually sits below
  // the sky, not in it). The focus is the largest coherent hot cluster — one
  // subject — not the weighted centroid of everything bright, which would
  // land between the moon and the boardwalk and point at neither.
  let sal = new Float32Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const c = cy * cols + cx;
      let diff = 0;
      let n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        diff += Math.abs(lum[c] - lum[ny * cols + nx]);
        n += 1;
      }
      // Gentle lower-frame prior (0.8–1.0) and a mild centre prior: the
      // subject of a photo usually sits below the sky and near the middle,
      // not at a corner. Both are weak on purpose — a strong prior drags
      // the focus to the floor or the exact centre.
      const distC = Math.hypot(cx / Math.max(1, cols - 1) - 0.5, cy / Math.max(1, rows - 1) - 0.5) / 0.707;
      const prior = (0.8 + 0.2 * (cy / Math.max(1, rows - 1))) * (1 - 0.3 * distC);
      // Contrast is the signal; saturation only boosts a cell that already
      // has edges. Otherwise a flat but saturated field (a blue-grey wall,
      // a pink sky) would read as one giant "subject".
      const contrast = n ? diff / n / 255 : 0;
      sal[c] = contrast * (1 + sat[c] * 0.5) * prior;
    }
  }
  const sorted = [...sal].sort((a, b) => b - a);
  const cut = sorted[Math.floor(sorted.length * 0.2)] || 0;
  const hot = (c) => sal[c] >= cut && sal[c] > 0.03;
  // Largest connected hot cluster (4-connected on the cell grid).
  const seenHot = new Uint8Array(cols * rows);
  let best = null;
  for (let start = 0; start < cols * rows; start++) {
    if (!hot(start) || seenHot[start]) continue;
    let wx = 0;
    let wy = 0;
    let ws = 0;
    let n = 0;
    const cells = [];
    const stack = [start];
    seenHot[start] = 1;
    while (stack.length) {
      const c = stack.pop();
      const cx = (c % cols + 0.5) / cols;
      const cy = (Math.floor(c / cols) + 0.5) / rows;
      cells.push([cx, cy]);
      wx += cx * sal[c];
      wy += cy * sal[c];
      ws += sal[c];
      n += 1;
      const gx = c % cols;
      const gy = Math.floor(c / cols);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = gx + dx;
        const ny = gy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const nc = ny * cols + nx;
        if (!seenHot[nc] && hot(nc)) {
          seenHot[nc] = 1;
          stack.push(nc);
        }
      }
    }
    if (ws > 0 && (!best || ws > best.ws)) best = { x: wx / ws, y: wy / ws, ws, n, cells };
  }
  if (!best || best.n < 3) {
    // Too little salient mass to call a subject: a landscape.
    let wx = 0;
    let wy = 0;
    let ws = 0;
    for (let c = 0; c < cols * rows; c++) {
      if (hot(c)) {
        wx += ((c % cols) + 0.5) / cols * sal[c];
        wy += (Math.floor(c / cols) + 0.5) / rows * sal[c];
        ws += sal[c];
      }
    }
    if (ws <= 0) return { x: 0.5, y: 0.42, kind: 'landscape' };
    return { x: wx / ws, y: wy / ws, kind: 'landscape' };
  }
  // Spread of the winning cluster decides subject vs landscape.
  let spread = 0;
  best.cells.forEach(([hx, hy]) => { spread += Math.hypot(hx - best.x, hy - best.y); });
  spread /= Math.max(1, best.cells.length);
  return { x: best.x, y: best.y, kind: spread > 0.3 ? 'landscape' : 'subject' };
}

/**
 * Detect the focus of a loaded image, offline. Downsamples to ~320 px wide
 * (fast, and detail below that does not move a crop), then analyses pixels.
 * Returns { x, y, kind }. Never throws: on any failure it is the centre.
 */
export function detectFocus(img) {
  try {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return { x: 0.5, y: 0.42, kind: 'landscape' };
    // Faces are small: at 160 px wide a face is ~12 px and its cells are
    // diluted by hair and shadow, so warm windows outvote real skin. At
    // 320 px a face is ~25 px and its cells read clean — still fast.
    const scale = Math.min(1, 320 / iw);
    const w = Math.max(8, Math.round(iw * scale));
    const h = Math.max(8, Math.round(ih * scale));
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    return analyzePixels(w, h, data);
  } catch {
    return { x: 0.5, y: 0.42, kind: 'landscape' };
  }
}

/**
 * Pure cover-fit maths, shared by the renderer and the tests: given an image
 * and the rect it must cover, where does the image land, and where does the
 * focus point end up inside the rect (fractions, 0..1)? `visible` is false
 * when the focus falls outside the rect — the crop cut the subject off.
 */
export function computeDrawRect(iw, ih, rw, rh, zoom, ox, oy, focus, anchor) {
  const fx = focus ? focus.x : 0.5;
  const fy = focus ? focus.y : 0.42;
  const ax = anchor ? anchor.x : 0.5;
  const ay = anchor ? anchor.y : 0.5;
  const base = Math.max(rw / iw, rh / ih);
  const dw = iw * base * zoom;
  const dh = ih * base * zoom;
  const loX = rw - dw;
  const hiX = 0;
  const loY = rh - dh;
  const hiY = 0;
  const clampX = (v) => Math.min(hiX, Math.max(loX, v));
  const clampY = (v) => Math.min(hiY, Math.max(loY, v));
  let dx = clampX(ax * rw - fx * dw);
  let dy = clampY(ay * rh - fy * dh);
  dx = clampX(dx + (ox * (dw - rw)) / 2);
  dy = clampY(dy + (oy * (dh - rh)) / 2);
  const inX = (dx + fx * dw) / rw;
  const inY = (dy + fy * dh) / rh;
  return {
    dx, dy, dw, dh,
    focusInRect: { x: inX, y: inY },
    visible: inX >= 0.02 && inX <= 0.98 && inY >= 0.02 && inY <= 0.98,
  };
}

/** Where a subject of this kind should sit inside a panel: faces ride high
 *  (headroom above them), landscapes and objects sit centred. */
export function anchorForKind(kind) {
  if (kind === 'single-face' || kind === 'two-people' || kind === 'group' || kind === 'manual') {
    return { x: 0.5, y: 0.38 };
  }
  return { x: 0.5, y: 0.5 };
}
