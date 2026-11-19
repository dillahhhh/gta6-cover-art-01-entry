// Wires the page: photos, layouts, panel editing, words, light and export.
// Every control writes the state and asks for one redraw; the preview and
// the exports share the render pipeline in render.js.
import { createState, cropFor, photoFor, SAMPLE_PHOTOS, SIZES } from './state.js';
import { LAYOUTS, layoutById } from './layouts.js';
import { renderCover, exportCanvas, lastTextBoxes } from './render.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const state = createState();
const preview = $('preview');
const pctx = preview.getContext('2d');
let uploadCount = 0;
let redrawQueued = false;

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load image'));
    img.src = url;
  });
}

/** Ask for a redraw on the next animation frame, coalescing slider drags. */
export function requestRedraw() {
  if (redrawQueued) return;
  redrawQueued = true;
  requestAnimationFrame(() => {
    redrawQueued = false;
    renderCover(pctx, preview.width, preview.height, state, state.selectedPanel);
  });
}

/** The preview canvas's internal size for the chosen export size. */
function fitPreviewSize() {
  const size = SIZES[state.sizeId];
  const scale = Math.min(1, 1080 / Math.max(size.w, size.h));
  preview.width = Math.round(size.w * scale);
  preview.height = Math.round(size.h * scale);
}

/** Assign photos to panels in order: 1 photo fills all, several spread out. */
function spreadPhotos() {
  const layout = layoutById(state.layoutId);
  layout.panels.forEach((_, i) => {
    const crop = cropFor(state, i);
    const photo = state.photos[i % state.photos.length];
    crop.photoId = photo ? photo.id : null;
  });
}

/** Rebuild the photo strip and the per-panel photo picker. */
function refreshPhotoControls() {
  const thumbs = $('thumbs');
  thumbs.innerHTML = '';
  state.photos.forEach((photo) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = photo.name;
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.name;
    b.appendChild(img);
    b.addEventListener('click', () => {
      const crop = cropFor(state, state.selectedPanel);
      crop.photoId = photo.id;
      refreshPhotoControls();
      requestRedraw();
    });
    thumbs.appendChild(b);
  });
  const pick = $('panelPhoto');
  pick.innerHTML = '';
  state.photos.forEach((photo) => {
    const opt = document.createElement('option');
    opt.value = photo.id;
    opt.textContent = photo.name;
    pick.appendChild(opt);
  });
  const current = photoFor(state, state.selectedPanel);
  if (current) pick.value = current.id;
}

/** Sync the panel editor (sliders, picker) with the selected panel. */
function refreshPanelEditor() {
  const crop = cropFor(state, state.selectedPanel);
  $('zoomRange').value = crop.zoom;
  $('zoomVal').textContent = `${Number(crop.zoom).toFixed(2)}×`;
  $('panXRange').value = crop.ox;
  $('panYRange').value = crop.oy;
  const current = photoFor(state, state.selectedPanel);
  if (current) $('panelPhoto').value = current.id;
}

/** Build the eight layout buttons with a mini diagram of each. */
function buildLayoutButtons() {
  const grid = $('layoutGrid');
  LAYOUTS.forEach((layout) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'layout-btn';
    b.dataset.layout = layout.id;
    b.title = layout.blurb;
    const mini = document.createElement('span');
    mini.className = 'mini';
    const hues = ['#ff2e88', '#22d3ee', '#ff7a3d', '#8b5cf6', '#ffd166', '#ff5e8a', '#3ddc97'];
    layout.panels.forEach((panel, i) => {
      const piece = document.createElement('i');
      const color = hues[i % hues.length];
      piece.style.background = color;
      if (panel.poly) {
        piece.style.left = '0%';
        piece.style.top = '0%';
        piece.style.width = '100%';
        piece.style.height = '100%';
        piece.style.background = `linear-gradient(115deg, ${hues[0]} 50%, ${hues[1]} 50%)`;
      } else {
        piece.style.left = `${panel.x * 100}%`;
        piece.style.top = `${panel.y * 100}%`;
        piece.style.width = `${panel.w * 100}%`;
        piece.style.height = `${panel.h * 100}%`;
        if (panel.rot) piece.style.transform = `rotate(${panel.rot}deg)`;
      }
      mini.appendChild(piece);
    });
    b.appendChild(mini);
    b.appendChild(document.createTextNode(layout.name));
    b.addEventListener('click', () => {
      state.layoutId = layout.id;
      state.selectedPanel = 0;
      const text = layout.text;
      state.headline.x = text.headline.x;
      state.headline.y = text.headline.y;
      state.subtitle.x = text.subtitle.x;
      state.subtitle.y = text.subtitle.y;
      document.querySelectorAll('.layout-btn').forEach((el) => el.classList.toggle('active', el.dataset.layout === layout.id));
      refreshPanelEditor();
      requestRedraw();
    });
    grid.appendChild(b);
  });
  document.querySelector('.layout-btn[data-layout="sunset"]').classList.add('active');
}

/** Add one loaded photo to the library and spread photos over the panels. */
export async function addPhoto(file, img, focus) {
  const photo = {
    id: `photo-${Date.now()}-${uploadCount++}`,
    name: file.name || file,
    img,
    url: img.src,
    // Where the subject sits in this photo (sample focus, else the middle):
    // the renderer centres the crop on it so faces and heroes stay in frame.
    focus: focus || { x: 0.5, y: 0.42 },
  };
  state.photos.push(photo);
  spreadPhotos();
  refreshPhotoControls();
  refreshPanelEditor();
  requestRedraw();
  return photo;
}

/** Load a sample photo by file name. */
async function addSample(file) {
  const found = SAMPLE_PHOTOS.find((s) => s.file === file);
  const img = await loadImage(`samples/${file}`);
  await addPhoto({ name: found ? found.name : file }, img, found ? found.focus : null);
}

/** Which panel (if any) holds a point in canvas pixels. */
function panelAt(cx, cy) {
  const layout = layoutById(state.layoutId);
  const w = preview.width;
  const h = preview.height;
  for (let i = layout.panels.length - 1; i >= 0; i--) {
    const p = layout.panels[i];
    if (p.poly) {
      let inside = false;
      const pts = p.poly.map(([fx, fy]) => [fx * w, fy * h]);
      for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
        const [ax, ay] = pts[a];
        const [bx, by] = pts[b];
        if ((ay > cy) !== (by > cy) && cx < ((bx - ax) * (cy - ay)) / (by - ay) + ax) inside = !inside;
      }
      if (inside) return i;
    } else if (cx >= p.x * w && cx <= (p.x + p.w) * w && cy >= p.y * h && cy <= (p.y + p.h) * h) {
      return i;
    }
  }
  return -1;
}

function boxHit(box, cx, cy) {
  return box && cx >= box.x - 8 && cx <= box.x + box.w + 8 && cy >= box.y - 8 && cy <= box.y + box.h + 8;
}

/** Pointer drag: move words when grabbing them, else pan the panel photo. */
function wirePointer() {
  let drag = null;
  const toCanvas = (e) => {
    const r = preview.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * preview.width,
      y: ((e.clientY - r.top) / r.height) * preview.height,
    };
  };
  preview.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    preview.setPointerCapture(e.pointerId);
    if (boxHit(lastTextBoxes.subtitle, p.x, p.y)) {
      drag = { kind: 'subtitle', sx: p.x, sy: p.y, ox: state.subtitle.x, oy: state.subtitle.y };
      return;
    }
    if (boxHit(lastTextBoxes.headline, p.x, p.y)) {
      drag = { kind: 'headline', sx: p.x, sy: p.y, ox: state.headline.x, oy: state.headline.y };
      return;
    }
    const hit = panelAt(p.x, p.y);
    if (hit >= 0) {
      state.selectedPanel = hit;
      const crop = cropFor(state, hit);
      drag = { kind: 'panel', sx: p.x, sy: p.y, ox: crop.ox, oy: crop.oy, panel: hit };
      refreshPanelEditor();
      requestRedraw();
    }
  });
  preview.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toCanvas(e);
    const dx = p.x - drag.sx;
    const dy = p.y - drag.sy;
    if (drag.kind === 'panel') {
      const crop = cropFor(state, drag.panel);
      const layout = layoutById(state.layoutId);
      const panel = layout.panels[drag.panel];
      const pw = (panel.w || 1) * preview.width;
      const ph = (panel.h || 1) * preview.height;
      crop.ox = Math.max(-1, Math.min(1, drag.ox + (dx / pw) * 2));
      crop.oy = Math.max(-1, Math.min(1, drag.oy + (dy / ph) * 2));
      $('panXRange').value = crop.ox;
      $('panYRange').value = crop.oy;
    } else {
      const words = drag.kind === 'headline' ? state.headline : state.subtitle;
      words.x = Math.max(0.08, Math.min(0.92, drag.ox + dx / preview.width));
      words.y = Math.max(0.04, Math.min(0.97, drag.oy + dy / preview.height));
    }
    requestRedraw();
  });
  const end = () => { drag = null; };
  preview.addEventListener('pointerup', end);
  preview.addEventListener('pointercancel', end);
}

/** Save the rendered canvas as a PNG download and note it for tests. */
function downloadPng(canvas, sizeId) {
  const size = SIZES[sizeId];
  const name = `vice-city-cover-${size.w}x${size.h}.png`;
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    window.__lastExport = { size: sizeId, w: size.w, h: size.h, bytes: blob.size, name };
    $('status').textContent = `Saved ${name} (${size.w} x ${size.h}, ${(blob.size / 1024).toFixed(0)} KB).`;
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

function exportSize(sizeId) {
  const canvas = exportCanvas(state, sizeId);
  downloadPng(canvas, sizeId);
}

// Automation hook for screenshots and tests: export any size on demand.
window.__exportNow = exportSize;

function wireControls() {
  $('photoInput').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const img = await loadImage(url);
      await addPhoto(file, img);
    }
    $('status').textContent = files.length > 1
      ? `${files.length} photos loaded and spread over the panels.`
      : 'Photo loaded.';
    e.target.value = '';
  });
  document.querySelectorAll('[data-sample]').forEach((b) => {
    b.addEventListener('click', () => addSample(b.dataset.sample));
  });
  $('panelPhoto').addEventListener('change', (e) => {
    cropFor(state, state.selectedPanel).photoId = e.target.value;
    refreshPhotoControls();
    requestRedraw();
  });
  $('zoomRange').addEventListener('input', (e) => {
    const crop = cropFor(state, state.selectedPanel);
    crop.zoom = Number(e.target.value);
    $('zoomVal').textContent = `${crop.zoom.toFixed(2)}×`;
    requestRedraw();
  });
  $('panXRange').addEventListener('input', (e) => {
    cropFor(state, state.selectedPanel).ox = Number(e.target.value);
    requestRedraw();
  });
  $('panYRange').addEventListener('input', (e) => {
    cropFor(state, state.selectedPanel).oy = Number(e.target.value);
    requestRedraw();
  });
  $('fillAll').addEventListener('click', () => {
    const photo = photoFor(state, state.selectedPanel);
    if (!photo) return;
    const layout = layoutById(state.layoutId);
    layout.panels.forEach((_, i) => { cropFor(state, i).photoId = photo.id; });
    refreshPhotoControls();
    requestRedraw();
    $('status').textContent = `${photo.name} now fills every panel.`;
  });
  $('headlineInput').addEventListener('input', (e) => { state.headline.text = e.target.value; requestRedraw(); });
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle.text = e.target.value; requestRedraw(); });
  $('headlineFont').addEventListener('change', (e) => { state.headline.font = e.target.value; requestRedraw(); });
  $('subtitleFont').addEventListener('change', (e) => { state.subtitle.font = e.target.value; requestRedraw(); });
  $('headlineSize').addEventListener('input', (e) => {
    state.headline.size = Number(e.target.value);
    $('headlineSizeVal').textContent = e.target.value;
    requestRedraw();
  });
  $('subtitleSize').addEventListener('input', (e) => {
    state.subtitle.size = Number(e.target.value);
    $('subtitleSizeVal').textContent = e.target.value;
    requestRedraw();
  });
  $('headlineColor').addEventListener('input', (e) => { state.headline.color = e.target.value; requestRedraw(); });
  $('subtitleColor').addEventListener('input', (e) => { state.subtitle.color = e.target.value; requestRedraw(); });
  $('headlineGlow').addEventListener('change', (e) => { state.headline.glow = e.target.checked; requestRedraw(); });
  $('headlineOutline').addEventListener('change', (e) => {
    state.headline.outline = e.target.checked;
    state.subtitle.outline = e.target.checked;
    requestRedraw();
  });
  $('gradeSelect').addEventListener('change', (e) => { state.fx.grade = e.target.value; requestRedraw(); });
  const slider = (id, key, label) => {
    $(id).addEventListener('input', (e) => {
      state.fx[key] = Number(e.target.value) / 100;
      $(label).textContent = `${e.target.value}%`;
      requestRedraw();
    });
  };
  slider('sunsetRange', 'sunset', 'sunsetVal');
  slider('neonRange', 'neon', 'neonVal');
  slider('grainRange', 'grain', 'grainVal');
  slider('vignetteRange', 'vignette', 'vignetteVal');
  $('sizeSelect').addEventListener('change', (e) => {
    state.sizeId = e.target.value;
    fitPreviewSize();
    requestRedraw();
  });
  $('exportMain').addEventListener('click', () => exportSize(state.sizeId));
  $('exportSquare').addEventListener('click', () => exportSize('square'));
  $('exportPortrait').addEventListener('click', () => exportSize('portrait'));
  $('exportWide').addEventListener('click', () => exportSize('wide'));
  wirePointer();
}

/** Start: fonts, the layout buttons, a first sample photo, then draw. */
async function start() {
  buildLayoutButtons();
  wireControls();
  fitPreviewSize();
  try {
    await Promise.all([
      document.fonts.load('400 100px Anton'),
      document.fonts.load('400 100px "Bebas Neue"'),
      document.fonts.load('400 100px Yellowtail'),
      document.fonts.ready,
    ]);
  } catch {
    // System fonts still draw the cover; the bundled fonts are a bonus.
  }
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), { state, addSample, fitPreviewSize, requestRedraw, preview });
    return;
  }
  await addSample('heist-duo.jpg');
  $('status').textContent = 'Sample photos loaded — the heist crew. Add your own photos or export this cover.';
}

start();
