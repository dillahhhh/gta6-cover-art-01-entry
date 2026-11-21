// ui.js — the SUNSET PRESS editor.
// One screen: a live preview on the left, controls on the right.
// The Subject Focus ellipse is a DOM overlay on the preview, shown ONLY
// while the user drags the focus handle. It is never drawn on any canvas,
// so it can never leak into an exported PNG (Claude round-5 fix 5).

import { renderCover, exportPNG, SIZES, loadImage } from './render.js';

const SAMPLES = [
  { name: 'Hero — lakeside duo', src: 'samples/hero-real.jpg' },
  { name: 'Friends day', src: 'samples/friends-day.jpg' },
  { name: 'Group night', src: 'samples/group-night.jpg' },
  { name: 'Selfie day', src: 'samples/selfie-day.jpg' },
  { name: 'Getaway', src: 'samples/getaway.jpg' },
  { name: 'Palm beach', src: 'samples/palm-beach.jpg' },
];

const STYLES = [
  { name: 'Sunset', grade: 'sunset' },
  { name: 'Neon Night', grade: 'neonNight' },
  { name: 'Teal Dusk', grade: 'tealDusk' },
  { name: 'Warm Crew', grade: 'crew' },
  { name: 'Golden Hour', grade: 'sunset' },
  { name: 'Vice Nights', grade: 'neonNight' },
];

const state = {
  size: 'square',
  style: 0,
  panelSide: 'auto', // auto | left | right | off
  titleHeight: 0, // -10..+10 percent shift of the title block
  title: 'SUNSET HEIST',
  kicker: 'ONE LAST JOB.',
  focus: { x: 0.62, y: 0.38 },
  heroSrc: 'samples/hero-real.jpg',
  busy: false,
};

let previewCanvas = null;
let previewWrap = null;
let focusRing = null;
let draggingFocus = false;

function el(id) {
  return document.getElementById(id);
}

function showFocusRing(show) {
  if (!focusRing) return;
  focusRing.style.display = show ? 'block' : 'none';
}

// Re-render the preview canvas at the current size (scaled to fit).
async function refreshPreview() {
  if (!previewCanvas || state.busy) return;
  state.busy = true;
  try {
    const canvas = await renderCover(state.size);
    const ctx = previewCanvas.getContext('2d');
    previewCanvas.width = canvas.width;
    previewCanvas.height = canvas.height;
    ctx.drawImage(canvas, 0, 0);
    positionFocusRing();
  } finally {
    state.busy = false;
  }
}

// The focus ring is a DOM overlay positioned over the preview canvas.
// It is only visible while the user drags it.
function positionFocusRing() {
  if (!focusRing || !previewWrap || !previewCanvas) return;
  const r = previewCanvas.getBoundingClientRect();
  const w = previewWrap.getBoundingClientRect();
  const fx = (state.focus.x * r.width) / w.width * 100;
  const fy = (state.focus.y * r.height) / w.height * 100;
  focusRing.style.left = `calc(${fx}% - 55px)`;
  focusRing.style.top = `calc(${fy}% - 40px)`;
}

function bindFocusDrag() {
  if (!focusRing || !previewWrap) return;
  const move = (ev) => {
    if (!draggingFocus) return;
    const r = previewCanvas.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
    state.focus = { x, y };
    positionFocusRing();
  };
  focusRing.addEventListener('pointerdown', (ev) => {
    draggingFocus = true;
    focusRing.setPointerCapture(ev.pointerId);
    showFocusRing(true);
    ev.preventDefault();
  });
  focusRing.addEventListener('pointermove', move);
  focusRing.addEventListener('pointerup', () => {
    draggingFocus = false;
    showFocusRing(false);
    refreshPreview();
  });
  // The ring is also shown while the focus slider is dragged.
  const slider = el('focus-x');
  if (slider) {
    slider.addEventListener('pointerdown', () => showFocusRing(true));
    slider.addEventListener('pointerup', () => showFocusRing(false));
  }
}

async function downloadPNG(size) {
  const url = await exportPNG(size);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sunset-press-${size}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function buildSamples() {
  const row = el('sample-row');
  if (!row) return;
  row.innerHTML = '';
  SAMPLES.forEach((s) => {
    const b = document.createElement('button');
    b.className = 'sample-thumb';
    b.type = 'button';
    b.title = s.name;
    const img = document.createElement('img');
    img.src = s.src;
    img.alt = s.name;
    b.appendChild(img);
    b.addEventListener('click', async () => {
      state.heroSrc = s.src;
      document.querySelectorAll('.sample-thumb').forEach((t) => t.classList.remove('active'));
      b.classList.add('active');
      await refreshPreview();
    });
    if (s.src === state.heroSrc) b.classList.add('active');
    row.appendChild(b);
  });
}

function buildStyles() {
  const row = el('style-row');
  if (!row) return;
  row.innerHTML = '';
  STYLES.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'style-thumb' + (i === state.style ? ' active' : '');
    b.type = 'button';
    b.textContent = s.name;
    b.addEventListener('click', async () => {
      state.style = i;
      document.querySelectorAll('.style-thumb').forEach((t) => t.classList.remove('active'));
      b.classList.add('active');
      await refreshPreview();
    });
    row.appendChild(b);
  });
}

function buildSizeTabs() {
  const tabs = el('size-tabs');
  if (!tabs) return;
  tabs.innerHTML = '';
  Object.entries(SIZES).forEach(([key, s]) => {
    const b = document.createElement('button');
    b.className = 'size-tab' + (key === state.size ? ' active' : '');
    b.type = 'button';
    b.textContent = s.label;
    b.addEventListener('click', async () => {
      state.size = key;
      document.querySelectorAll('.size-tab').forEach((t) => t.classList.remove('active'));
      b.classList.add('active');
      await refreshPreview();
    });
    tabs.appendChild(b);
  });
}

function bindControls() {
  const panelSel = el('panel-side');
  if (panelSel) {
    panelSel.addEventListener('change', async () => {
      state.panelSide = panelSel.value;
      await refreshPreview();
    });
  }
  const titleSlider = el('title-height');
  const titleVal = el('title-height-val');
  if (titleSlider) {
    titleSlider.addEventListener('input', () => {
      state.titleHeight = Number(titleSlider.value);
      if (titleVal) titleVal.textContent = `${state.titleHeight > 0 ? '+' : ''}${state.titleHeight}%`;
    });
    titleSlider.addEventListener('change', refreshPreview);
  }
  const titleInput = el('caption-title');
  if (titleInput) {
    titleInput.addEventListener('input', () => { state.title = titleInput.value.toUpperCase(); });
    titleInput.addEventListener('change', refreshPreview);
  }
  const kickerInput = el('caption-kicker');
  if (kickerInput) {
    kickerInput.addEventListener('input', () => { state.kicker = kickerInput.value.toUpperCase(); });
    kickerInput.addEventListener('change', refreshPreview);
  }
  const exportBtn = el('export-btn');
  if (exportBtn) exportBtn.addEventListener('click', () => downloadPNG(state.size));
  const exportAll = el('export-all-btn');
  if (exportAll) {
    exportAll.addEventListener('click', async () => {
      for (const key of Object.keys(SIZES)) await downloadPNG(key);
    });
  }
  const shuffle = el('shuffle-btn');
  if (shuffle) {
    shuffle.addEventListener('click', async () => {
      state.style = (state.style + 1) % STYLES.length;
      document.querySelectorAll('.style-thumb').forEach((t, i) => t.classList.toggle('active', i === state.style));
      await refreshPreview();
    });
  }
  const fileInput = el('photo-input');
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      state.heroSrc = url;
      await loadImage(url).catch(() => {});
      await refreshPreview();
    });
  }
}

export async function initEditor() {
  previewCanvas = el('preview-canvas');
  previewWrap = el('preview-wrap');
  focusRing = el('focus-ring');
  buildSamples();
  buildStyles();
  buildSizeTabs();
  bindControls();
  bindFocusDrag();
  showFocusRing(false);
  // Preload the hero so the first paint is never empty.
  try { await loadImage(state.heroSrc); } catch (e) { /* sample row still works */ }
  await refreshPreview();
  window.__sunsetPress = {
    ready: true,
    renderCover,
    exportPNG,
    sizes: SIZES,
    state,
    refreshPreview,
  };
}

document.addEventListener('DOMContentLoaded', () => {
  initEditor().catch((err) => {
    console.error('SUNSET PRESS failed to start', err);
    const note = el('load-error');
    if (note) note.textContent = 'Could not start the editor: ' + err.message;
  });
});
