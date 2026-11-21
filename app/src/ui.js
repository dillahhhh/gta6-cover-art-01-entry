// ui.js — SUNSET PRESS editor wiring.
//
// Loads photos, owns the state (undo/redo + autosave), wires every
// control, and renders the live preview. The preview is the true render
// at a smaller scale; export always renders at full output resolution.
//
// The app exposes window.SunsetPress for automation (screenshots):
//   { state, images, renderPreview, exportDataURL, exportAll, setHero,
//     ready } — ready resolves once the samples are loaded and the first
//   preview has rendered.

import { renderPoster, posterDataURL, defaultState, SIZES, SAMPLES, heroCropFor, posterToPhoto } from './render.js';
import { PRESETS as PAINT_PRESETS } from './paint.js';

const STYLES = [
  { id: 'sunset', label: 'Sunset', preset: 'sunset' },
  { id: 'golden', label: 'Golden Hour', preset: 'golden' },
  { id: 'neon', label: 'Neon Night', preset: 'neon' },
  { id: 'teal', label: 'Teal Dusk', preset: 'teal' },
  { id: 'mono', label: 'Mono Pink', preset: 'mono' },
  { id: 'noir', label: 'Vice Noir', preset: 'noir' },
];

const $ = (id) => document.getElementById(id);
const state = defaultState();
const images = {}; // src -> HTMLImageElement
let undoStack = [];
let redoStack = [];
let renderTimer = null;
let selectedPanel = -1; // -1 = hero, 0..2 = panel

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (images[src]) return resolve(images[src]);
    const img = new Image();
    img.onload = () => { images[src] = img; resolve(img); };
    img.onerror = () => reject(new Error(`cannot load ${src}`));
    img.src = src;
  });
}

async function loadSamples() {
  await Promise.all(SAMPLES.map((s) => loadImage(s.src).catch(() => null)));
}

function snapshot() {
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 40) undoStack.shift();
  redoStack = [];
}

function restore(json) {
  const next = JSON.parse(json);
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, next);
}

function save() {
  try { localStorage.setItem('sunset-press', JSON.stringify(state)); } catch (e) { /* private mode */ }
}

function loadSaved() {
  try {
    const raw = localStorage.getItem('sunset-press');
    if (!raw) return;
    const next = JSON.parse(raw);
    if (next && typeof next.title === 'string') Object.assign(state, next);
  } catch (e) { /* ignore corrupt save */ }
}

function status(msg) {
  const el = $('status');
  if (el) el.textContent = msg;
}

/** Render the preview at a scale that fits the preview box. */
function renderPreview() {
  const box = $('previewWrap');
  const canvas = $('preview');
  if (!box || !canvas) return;
  const { w: W0, h: H0 } = SIZES[state.size];
  const availW = Math.min(box.clientWidth || 600, 600);
  const scale = Math.min(1, availW / W0);
  const painted = renderPoster(state, state.size, images, scale);
  canvas.width = painted.width;
  canvas.height = painted.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(painted, 0, 0);
  drawFocusOverlay();
  updatePanelList();
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => { renderPreview(); save(); }, 120);
}

/** Draw the draggable Subject Focus ellipse over the preview. */
function drawFocusOverlay() {
  const canvas = $('preview');
  const handle = $('focusHandle');
  if (!canvas || !handle) return;
  const { w: W0, h: H0 } = SIZES[state.size];
  const scale = canvas.width / W0;
  // Focus is in photo fractions; map it to poster coords via the hero crop.
  const heroImg = images[state.hero];
  if (!heroImg) return;
  const iw = heroImg.naturalWidth || heroImg.width;
  const ih = heroImg.naturalHeight || heroImg.height;
  const { crop } = heroCropFor(state, state.size, iw, ih);
  const base = Math.max(W0 / iw, H0 / ih) * crop.zoom;
  const dw = iw * base, dh = ih * base;
  const px = (W0 / 2 + (state.focus.x - crop.x) * dw) * scale;
  const py = (H0 / 2 + (state.focus.y - crop.y) * dh) * scale;
  const rx = state.focus.rx * dw * scale;
  const ry = state.focus.ry * dh * scale;
  handle.style.display = 'block';
  handle.style.left = `${px - rx}px`;
  handle.style.top = `${py - ry}px`;
  handle.style.width = `${rx * 2}px`;
  handle.style.height = `${ry * 2}px`;
}

function updatePanelList() {
  const el = $('panelList');
  if (!el) return;
  el.innerHTML = '';
  const mk = (label, idx) => {
    const b = document.createElement('button');
    b.className = 'chip' + (selectedPanel === idx ? ' active' : '');
    b.textContent = label;
    b.onclick = () => { selectedPanel = idx; updatePanelList(); };
    el.appendChild(b);
  };
  mk('HERO', -1);
  state.panels.forEach((p, i) => mk(p.label, i));
}

/** Export one size as a JPEG download. */
function downloadDataURL(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function exportOne() {
  const url = posterDataURL(state, state.size, images, 0.92);
  const { w, h } = SIZES[state.size];
  downloadDataURL(url, `sunset-press-${state.size}-${w}x${h}.jpg`);
  status(`Exported ${state.size} ${w}×${h}.`);
}

function exportAll() {
  for (const key of Object.keys(SIZES)) {
    const url = posterDataURL(state, key, images, 0.92);
    const { w, h } = SIZES[key];
    downloadDataURL(url, `sunset-press-${key}-${w}x${h}.jpg`);
  }
  status('Exported all 3 sizes.');
}

/** Apply a URL deep-link (used by the screenshot driver). */
function applyParams() {
  const q = new URLSearchParams(location.search);
  if (q.get('hero')) state.hero = q.get('hero');
  if (q.get('size') && SIZES[q.get('size')]) state.size = q.get('size');
  if (q.get('panels')) state.panelsSide = q.get('panels');
  if (q.get('title')) state.title = q.get('title');
}

function buildStyles() {
  const el = $('styles');
  if (!el) return;
  el.innerHTML = '';
  for (const s of STYLES) {
    const b = document.createElement('button');
    b.className = 'style-card' + (state.style === s.id ? ' active' : '');
    b.textContent = s.label;
    b.title = PAINT_PRESETS[s.preset] ? PAINT_PRESETS[s.preset].label : s.label;
    b.onclick = () => {
      snapshot();
      state.style = s.id;
      buildStyles();
      scheduleRender();
    };
    el.appendChild(b);
  }
}

function buildSamples() {
  const el = $('samples');
  if (!el) return;
  el.innerHTML = '';
  for (const s of SAMPLES) {
    const b = document.createElement('button');
    b.className = 'sample-card' + (state.hero === s.src ? ' active' : '');
    const img = document.createElement('img');
    img.src = s.src;
    img.alt = s.label;
    b.appendChild(img);
    const lab = document.createElement('span');
    lab.textContent = s.label;
    b.appendChild(lab);
    b.onclick = () => {
      snapshot();
      state.hero = s.src;
      buildSamples();
      scheduleRender();
    };
    el.appendChild(b);
  }
}

function buildSizeTabs() {
  const el = $('sizeTabs');
  if (!el) return;
  el.innerHTML = '';
  for (const key of Object.keys(SIZES)) {
    const b = document.createElement('button');
    b.className = 'chip' + (state.size === key ? ' active' : '');
    b.textContent = SIZES[key].label;
    b.onclick = () => { state.size = key; buildSizeTabs(); renderPreview(); };
    el.appendChild(b);
  }
}

function buildPanelsToggle() {
  const el = $('panelsToggle');
  if (!el) return;
  el.innerHTML = '';
  for (const [val, label] of [['auto', 'Auto'], ['left', 'Left'], ['right', 'Right'], ['off', 'Off']]) {
    const b = document.createElement('button');
    b.className = 'chip' + (state.panelsSide === val ? ' active' : '');
    b.textContent = label;
    b.onclick = () => { snapshot(); state.panelsSide = val; buildPanelsToggle(); scheduleRender(); };
    el.appendChild(b);
  }
}

function wireInputs() {
  const bind = (id, key) => {
    const el = $(id);
    if (!el) return;
    el.value = state[key];
    el.addEventListener('input', () => { state[key] = el.value; scheduleRender(); });
    el.addEventListener('change', () => { snapshot(); });
  };
  bind('titleInput', 'title');
  bind('kickerInput', 'kicker');
  bind('footerInput', 'footer');

  const th = $('titleHeight');
  if (th) {
    th.value = String(Math.round((state.titleY[state.size] - 0.72) / 0.0016));
    th.addEventListener('input', () => {
      const v = Number(th.value);
      state.titleY[state.size] = 0.72 + v * 0.0016;
      scheduleRender();
    });
  }
}

function wireButtons() {
  $('exportOne')?.addEventListener('click', exportOne);
  $('exportAll')?.addEventListener('click', exportAll);
  $('shuffle')?.addEventListener('click', () => {
    snapshot();
    const ids = STYLES.map((s) => s.id);
    state.style = ids[Math.floor(Math.random() * ids.length)];
    buildStyles();
    scheduleRender();
  });
  $('undo')?.addEventListener('click', () => {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(state));
    restore(undoStack.pop());
    syncInputs(); renderPreview(); save();
  });
  $('redo')?.addEventListener('click', () => {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(state));
    restore(redoStack.pop());
    syncInputs(); renderPreview(); save();
  });
  const drop = $('dropzone');
  const file = $('fileInput');
  if (drop && file) {
    drop.addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      loadImage(url).then(() => {
        snapshot();
        state.hero = url;
        scheduleRender();
        status('Your photo loaded as the hero.');
      }).catch(() => status('Could not read that file.'));
    });
    ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => {
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      loadImage(url).then(() => {
        snapshot();
        state.hero = url;
        scheduleRender();
        status('Your photo loaded as the hero.');
      }).catch(() => status('Could not read that file.'));
    });
  }
}

function syncInputs() {
  const t = $('titleInput'); if (t) t.value = state.title;
  const k = $('kickerInput'); if (k) k.value = state.kicker;
  const f = $('footerInput'); if (f) f.value = state.footer;
  buildStyles(); buildSamples(); buildSizeTabs(); buildPanelsToggle();
}

/** Preview interactions: drag the focus handle, click a panel to select it. */
function wirePreview() {
  const canvas = $('preview');
  const handle = $('focusHandle');
  if (!canvas) return;
  let dragging = null; // 'focus' | 'panel' | null
  let lastX = 0, lastY = 0;

  const toPoster = (e) => {
    const r = canvas.getBoundingClientRect();
    const { w: W0, h: H0 } = SIZES[state.size];
    const sx = W0 / r.width, sy = H0 / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };

  if (handle) {
    handle.addEventListener('pointerdown', (e) => {
      dragging = 'focus';
      handle.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });
    handle.addEventListener('pointermove', (e) => {
      if (dragging !== 'focus') return;
      const p = toPoster(e);
      const heroImg = images[state.hero];
      if (!heroImg) return;
      const photo = posterToPhoto(state, state.size, heroImg, p.x, p.y);
      state.focus.x = Math.min(0.95, Math.max(0.05, photo.x));
      state.focus.y = Math.min(0.95, Math.max(0.05, photo.y));
      scheduleRender();
    });
    handle.addEventListener('pointerup', () => { if (dragging === 'focus') { snapshot(); dragging = null; } });
  }

  canvas.addEventListener('pointerdown', (e) => {
    const p = toPoster(e);
    const { w: W0, h: H0 } = SIZES[state.size];
    const { stack } = heroCropFor(state, state.size, 1, 1);
    // Hit-test the panel stack (stack rects are in full-res poster coords).
    if (stack) {
      for (let i = 0; i < stack.panels.length; i++) {
        const r = stack.panels[i];
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
          selectedPanel = i;
          dragging = 'panel';
          lastX = p.x; lastY = p.y;
          updatePanelList();
          canvas.setPointerCapture(e.pointerId);
          return;
        }
      }
    }
    selectedPanel = -1;
    updatePanelList();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging !== 'panel' || selectedPanel < 0) return;
    const p = toPoster(e);
    const { w: W0, h: H0 } = SIZES[state.size];
    const panel = state.panels[selectedPanel];
    const img = images[panel.src];
    if (!img) return;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    // Pan the panel crop: drag right moves the photo right (crop centre left).
    panel.crop.x = Math.min(0.95, Math.max(0.05, panel.crop.x - (p.x - lastX) / W0));
    panel.crop.y = Math.min(0.95, Math.max(0.05, panel.crop.y - (p.y - lastY) / H0));
    lastX = p.x; lastY = p.y;
    scheduleRender();
  });
  canvas.addEventListener('pointerup', () => { if (dragging === 'panel') { snapshot(); dragging = null; } });
  canvas.addEventListener('wheel', (e) => {
    if (selectedPanel < 0) return;
    e.preventDefault();
    const panel = state.panels[selectedPanel];
    panel.crop.zoom = Math.min(2.5, Math.max(1, panel.crop.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    scheduleRender();
  }, { passive: false });
}

async function init() {
  loadSaved();
  applyParams();
  // Fonts must be ready before the first canvas render.
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('400 100px "Anton"'),
        document.fonts.load('400 40px "Bebas Neue"'),
      ]),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
  } catch (e) { /* fall back to system fonts */ }
  await loadSamples();
  syncInputs();
  wireInputs();
  wireButtons();
  wirePreview();
  renderPreview();
  status('Ready — pick a sample photo or drop your own.');
}

window.SunsetPress = {
  state,
  images,
  renderPreview,
  exportDataURL: (sizeKey, quality = 0.92) => posterDataURL(state, sizeKey, images, quality),
  exportAll,
  setHero: async (src) => { await loadImage(src); state.hero = src; renderPreview(); },
  ready: null,
};

window.SunsetPress.ready = init().catch((e) => {
  status(`Failed to start: ${e.message}`);
  throw e;
});
