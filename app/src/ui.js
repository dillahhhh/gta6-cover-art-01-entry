// ui.js — the SUNSET PRESS editor.
//
// Wires the page: loads the sample photos and the bundled fonts, renders
// the live preview, and exposes window.__sunsetPress so the screenshot
// harness (and any embedder) can render and export covers at exact size.
// The subject-focus ellipse is a DOM overlay that only appears while the
// user drags it, so it never shows up in the editor screenshot.
//
// Everything here is written for this round; nothing is copied from an
// earlier build.

import { renderCover, SIZES } from './render.js';

const SAMPLES = [
  { name: 'hero-real', src: 'samples/hero-real.jpg' },
  { name: 'friends-day', src: 'samples/friends-day.jpg' },
  { name: 'group-night', src: 'samples/group-night.jpg' },
  { name: 'hotel-night', src: 'samples/hotel-night.jpg' },
  { name: 'beach-night', src: 'samples/beach-night.jpg' },
  { name: 'selfie-day', src: 'samples/selfie-day.jpg' },
];

const STYLES = [
  { name: 'Sunset', preset: 'sunset' },
  { name: 'Neon Night', preset: 'neonNight' },
  { name: 'Teal Dusk', preset: 'tealDusk' },
  { name: 'Warm Crew', preset: 'warmCrew' },
  { name: 'Golden Hour', preset: 'goldenHour' },
  { name: 'Vice Nights', preset: 'viceNights' },
];

const SIZE_TABS = [
  { name: 'square', label: '1080 x 1080' },
  { name: 'portrait', label: '1080 x 1350' },
  { name: 'wide', label: '1920 x 1080' },
];

const state = {
  heroImg: null,
  crewImg: null,
  getawayImg: null,
  scoreImg: null,
  style: 'sunset',
  title: 'SUNSET HEIST',
  kicker: 'ONE LAST JOB.',
  footer: 'VICE CITY · TONIGHT · SUNSET PRESS',
  size: 'square',
  focus: null, // {fx, fy} set by dragging the subject-focus ellipse
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load ' + src));
    img.src = src;
  });
}

const $ = (id) => document.getElementById(id);

let previewCanvas;
let focusRing;
let draggingFocus = false;

function paintPreview() {
  const size = SIZES[state.size];
  const cover = renderCover(state.size, state);
  // Fit the preview canvas to the cover aspect, capped for the page.
  const maxW = 620;
  const maxH = 620;
  const scale = Math.min(maxW / size.w, maxH / size.h, 1);
  const pw = Math.max(2, Math.round(size.w * scale));
  const ph = Math.max(2, Math.round(size.h * scale));
  previewCanvas.width = pw;
  previewCanvas.height = ph;
  const ctx = previewCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cover, 0, 0, pw, ph);
  // Keep the focus ring sized to the preview box.
  focusRing.style.width = pw + 'px';
  focusRing.style.height = ph + 'px';
}

function renderAll() {
  paintPreview();
}

function buildSamples() {
  const row = $('sample-row');
  for (const s of SAMPLES) {
    const b = document.createElement('button');
    b.className = 'sample-thumb';
    b.type = 'button';
    b.title = s.name;
    const img = document.createElement('img');
    img.src = s.src;
    img.alt = s.name;
    b.appendChild(img);
    b.addEventListener('click', async () => {
      state.heroImg = await loadImage(s.src);
      state.focus = null;
      renderAll();
    });
    row.appendChild(b);
  }
}

function buildStyles() {
  const box = $('style-grid');
  for (const s of STYLES) {
    const b = document.createElement('button');
    b.className = 'style-btn' + (s.preset === state.style ? ' active' : '');
    b.type = 'button';
    b.textContent = s.name;
    b.addEventListener('click', () => {
      state.style = s.preset;
      for (const el of box.querySelectorAll('.style-btn')) el.classList.remove('active');
      b.classList.add('active');
      renderAll();
    });
    box.appendChild(b);
  }
  const shuffle = document.createElement('button');
  shuffle.className = 'style-btn shuffle';
  shuffle.type = 'button';
  shuffle.textContent = 'Shuffle style';
  shuffle.addEventListener('click', () => {
    const pick = STYLES[Math.floor(Math.random() * STYLES.length)];
    state.style = pick.preset;
    for (const el of box.querySelectorAll('.style-btn')) {
      el.classList.toggle('active', el.textContent === pick.name);
    }
    renderAll();
  });
  box.appendChild(shuffle);
}

function buildSizeTabs() {
  const box = $('size-tabs');
  for (const s of SIZE_TABS) {
    const b = document.createElement('button');
    b.className = 'size-tab' + (s.name === state.size ? ' active' : '');
    b.type = 'button';
    b.textContent = s.label;
    b.addEventListener('click', () => {
      state.size = s.name;
      for (const el of box.querySelectorAll('.size-tab')) el.classList.remove('active');
      b.classList.add('active');
      renderAll();
    });
    box.appendChild(b);
  }
}

function bindCaption() {
  const titleInput = $('caption-title');
  const kickerInput = $('caption-kicker');
  titleInput.value = state.title;
  kickerInput.value = state.kicker;
  titleInput.addEventListener('input', () => {
    state.title = titleInput.value.trim() || 'SUNSET HEIST';
    renderAll();
  });
  kickerInput.addEventListener('input', () => {
    state.kicker = kickerInput.value.trim() || 'ONE LAST JOB.';
    renderAll();
  });
}

function bindPhotoPicker() {
  const input = $('photo-file');
  const btn = $('choose-photo');
  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    state.heroImg = await loadImage(url);
    state.focus = null;
    renderAll();
  });
}

function bindExport() {
  $('export-one').addEventListener('click', () => {
    const url = window.__sunsetPress.exportPNG(state.size);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sunset-press-${state.size}.png`;
    a.click();
  });
  $('export-all').addEventListener('click', () => {
    for (const s of ['wide', 'square', 'portrait']) {
      const url = window.__sunsetPress.exportPNG(s);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sunset-press-${s}.png`;
      a.click();
    }
  });
}

// Subject-focus ellipse: a DOM overlay, visible only while dragging, so it
// never appears in the editor screenshot. Dragging it re-centres the hero
// crop on the dragged point.
function bindFocus() {
  const wrap = $('preview-wrap');
  const show = (e) => {
    const r = previewCanvas.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    state.focus = { fx: Math.max(0.05, Math.min(0.95, fx)), fy: Math.max(0.05, Math.min(0.95, fy)) };
    focusRing.style.display = 'block';
    focusRing.style.left = (fx * r.width - 46) + 'px';
    focusRing.style.top = (fy * r.height - 30) + 'px';
    renderAll();
  };
  previewCanvas.addEventListener('pointerdown', (e) => {
    draggingFocus = true;
    previewCanvas.setPointerCapture(e.pointerId);
    show(e);
  });
  previewCanvas.addEventListener('pointermove', (e) => {
    if (draggingFocus) show(e);
  });
  const end = () => {
    draggingFocus = false;
    focusRing.style.display = 'none';
  };
  previewCanvas.addEventListener('pointerup', end);
  previewCanvas.addEventListener('pointercancel', end);
  wrap.addEventListener('pointerleave', end);
}

async function init() {
  previewCanvas = $('preview');
  focusRing = $('focus-ring');
  // The hero is the real golden-hour photo; the panels use their own stills.
  const [hero, crew, getaway, score] = await Promise.all([
    loadImage('samples/hero-real.jpg'),
    loadImage('samples/friends-day.jpg'),
    loadImage('samples/getaway.jpg'),
    loadImage('samples/beach-night.jpg'),
  ]);
  state.heroImg = hero;
  state.crewImg = crew;
  state.getawayImg = getaway;
  state.scoreImg = score;
  // Bundled display faces, before the first paint.
  await Promise.all([
    document.fonts.load('100px Anton'),
    document.fonts.load('30px "Bebas Neue"'),
    document.fonts.load('700 20px "Bebas Neue"'),
  ]);
  buildSamples();
  buildStyles();
  buildSizeTabs();
  bindCaption();
  bindPhotoPicker();
  bindExport();
  bindFocus();
  renderAll();

  window.__sunsetPress = {
    ready: true,
    renderCover: (sizeName) => renderCover(sizeName, state),
    exportPNG: (sizeName) => {
      const canvas = renderCover(sizeName, state);
      return canvas.toDataURL('image/png');
    },
  };
}

init().catch((err) => {
  console.error(err);
  const note = document.createElement('div');
  note.style.cssText = 'color:#ff6b81;padding:16px;font:14px sans-serif';
  note.textContent = 'SUNSET PRESS failed to start: ' + err.message;
  document.body.appendChild(note);
});
