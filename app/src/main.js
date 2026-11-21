// SUNSET PRESS — editor wiring: state, photo loading, live preview, export.
//
// One photo in, a full key-art poster out. The preview canvas is the true
// render at export resolution, so what the maker sees is what gets exported.

import { loadImage } from './paint.js';
import { drawCover, SIZES, SAMPLE_PHOTOS } from './poster.js';
import { runShot } from './shots.js';

const STYLES = [
  { name: 'Sunset', grade: 'sunset' },
  { name: 'Neon Night', grade: 'neon' },
  { name: 'Teal Dusk', grade: 'teal' },
  { name: 'Warm Crew', grade: 'warm' },
  { name: 'Golden Hour', grade: 'golden' },
  { name: 'Vice Nights', grade: 'vice' },
];

const SAMPLES = [
  'hero-real.jpg',
  'friends-day.jpg',
  'group-night.jpg',
  'heist-duo.jpg',
  'selfie-day.jpg',
  'getaway.jpg',
  'beach-night.jpg',
  'hotel-night.jpg',
  'neon-street.jpg',
  'palm-beach.jpg',
];

const state = {
  grade: 'sunset',
  title: 'SUNSET HEIST',
  kicker: 'ONE LAST JOB.',
  size: 'square',
  heroPanX: 0,
  heroPanY: 0,
  heroZoom: 1,
  titleShift: 0,
  photos: { hero: null, crew: null, getaway: null, score: null },
  userHero: null,
};

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const statusEl = $('status');
let renderTimer = 0;
let renderCount = 0;

function setStatus(msg) {
  statusEl.textContent = msg;
}

async function loadSamples() {
  const jobs = Object.entries(SAMPLE_PHOTOS).map(async ([key, file]) => {
    state.photos[key] = await loadImage(`./samples/${file}`);
  });
  await Promise.all(jobs);
}

function currentImages() {
  return {
    hero: state.userHero || state.photos.hero,
    crew: state.photos.crew,
    getaway: state.photos.getaway,
    score: state.photos.score,
  };
}

function renderNow() {
  const t0 = performance.now();
  const canvas = drawCover(state.size, currentImages(), state);
  preview.width = canvas.width;
  preview.height = canvas.height;
  const ctx = preview.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  renderCount++;
  const { w, h } = SIZES[state.size];
  setStatus(`Rendered ${state.size} ${w}×${h} in ${Math.round(performance.now() - t0)} ms · render #${renderCount}`);
  return canvas;
}

function renderSoon() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderNow, 150);
}

function download(canvas, name) {
  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed: no image data.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(`Exported ${name}`);
  }, 'image/png');
}

function exportCurrent() {
  const canvas = renderNow();
  download(canvas, `sunset-press-${state.size}.png`);
}

function exportAll() {
  const keep = state.size;
  for (const size of Object.keys(SIZES)) {
    state.size = size;
    const canvas = renderNow();
    download(canvas, `sunset-press-${size}.png`);
  }
  state.size = keep;
  renderNow();
  setStatus('Exported all 3 sizes.');
}

function buildStyleButtons() {
  const row = $('styleRow');
  STYLES.forEach((style, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'style-btn' + (i === 0 ? ' active' : '');
    b.textContent = style.name;
    b.addEventListener('click', () => {
      state.grade = style.grade;
      row.querySelectorAll('.style-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      renderSoon();
    });
    row.appendChild(b);
  });
  $('shuffleStyle').addEventListener('click', () => {
    const pick = STYLES[Math.floor(Math.random() * STYLES.length)];
    state.grade = pick.grade;
    row.querySelectorAll('.style-btn').forEach((x) =>
      x.classList.toggle('active', x.textContent === pick.name),
    );
    setStatus(`Style: ${pick.name}`);
    renderSoon();
  });
}

function buildSampleRow() {
  const row = $('sampleRow');
  ['hero-real.jpg', 'friends-day.jpg', 'group-night.jpg', 'heist-duo.jpg', 'selfie-day.jpg'].forEach(
    (file) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'thumb' + (file === 'hero-real.jpg' ? ' active' : '');
      const img = document.createElement('img');
      img.src = `./samples/${file}`;
      img.alt = file;
      b.appendChild(img);
      b.addEventListener('click', async () => {
        state.userHero = await loadImage(`./samples/${file}`);
        state.heroPanX = 0;
        state.heroPanY = 0;
        state.heroZoom = 1;
        row.querySelectorAll('.thumb').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        setStatus(`Hero photo: ${file}`);
        renderSoon();
      });
      row.appendChild(b);
    },
  );
}

function buildPanelSelects() {
  const map = { crewSelect: 'crew', getawaySelect: 'getaway', scoreSelect: 'score' };
  for (const [id, key] of Object.entries(map)) {
    const sel = $(id);
    SAMPLES.forEach((file) => {
      const opt = document.createElement('option');
      opt.value = file;
      opt.textContent = file.replace('.jpg', '');
      if (file === SAMPLE_PHOTOS[key]) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', async () => {
      state.photos[key] = await loadImage(`./samples/${sel.value}`);
      setStatus(`Panel ${key}: ${sel.value}`);
      renderSoon();
    });
  }
}

function buildSizeTabs() {
  const row = $('sizeTabs');
  for (const [key, { w, h }] of Object.entries(SIZES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'size-btn' + (key === state.size ? ' active' : '');
    b.textContent = `${key === 'square' ? 'Square' : key === 'portrait' ? 'Portrait' : 'Wide'} ${w}×${h}`;
    b.addEventListener('click', () => {
      state.size = key;
      row.querySelectorAll('.size-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      renderSoon();
    });
    row.appendChild(b);
  }
}

function wireInputs() {
  $('titleInput').addEventListener('input', (e) => {
    state.title = e.target.value.toUpperCase() || 'SUNSET HEIST';
    renderSoon();
  });
  $('kickerInput').addEventListener('input', (e) => {
    state.kicker = e.target.value.toUpperCase() || 'ONE LAST JOB.';
    renderSoon();
  });
  $('titleShift').addEventListener('input', (e) => {
    state.titleShift = Number(e.target.value);
    renderSoon();
  });
  $('photoFile').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      state.userHero = await loadImage(url);
      state.heroPanX = 0;
      state.heroPanY = 0;
      state.heroZoom = 1;
      document.querySelectorAll('.thumb').forEach((x) => x.classList.remove('active'));
      setStatus(`Hero photo: ${file.name} (on your machine only, never uploaded)`);
      renderSoon();
    } catch {
      setStatus('Could not read that photo.');
    }
  });
  $('exportBtn').addEventListener('click', exportCurrent);
  $('exportAllBtn').addEventListener('click', exportAll);
}

// Drag the preview to pan the hero, scroll to zoom it. The focus point moves
// inside the photo; the framing code clamps it so no edge ever shows.
function wirePanZoom() {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  preview.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    preview.setPointerCapture(e.pointerId);
  });
  preview.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = preview.getBoundingClientRect();
    const dx = (e.clientX - lastX) / rect.width;
    const dy = (e.clientY - lastY) / rect.height;
    lastX = e.clientX;
    lastY = e.clientY;
    state.heroPanX -= dx * 0.6;
    state.heroPanY -= dy * 0.6;
    renderSoon();
  });
  const stop = () => {
    dragging = false;
  };
  preview.addEventListener('pointerup', stop);
  preview.addEventListener('pointercancel', stop);
  preview.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      state.heroZoom = Math.max(1, Math.min(1.6, state.heroZoom * (1 - e.deltaY * 0.001)));
      renderSoon();
    },
    { passive: false },
  );
}

window.addEventListener('error', (e) => {
  setStatus(`Error: ${e.message}`);
});

// API the screenshot scenes use.
const api = {
  state,
  async loadCoverPhoto(file) {
    state.userHero = await loadImage(`./samples/${file}`);
    state.heroPanX = 0;
    state.heroPanY = 0;
    state.heroZoom = 1;
  },
  setTitle(t) {
    state.title = t.toUpperCase();
    $('titleInput').value = state.title;
  },
  setKicker(k) {
    state.kicker = k.toUpperCase();
    $('kickerInput').value = state.kicker;
  },
  setSize(size) {
    state.size = size;
    document.querySelectorAll('.size-btn').forEach((x) =>
      x.classList.toggle('active', x.textContent.toLowerCase().startsWith(size)),
    );
  },
  renderPreview() {
    return renderNow();
  },
};

async function init() {
  // Wait for the bundled display faces so the wordmark never falls back.
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('40px "Bebas Neue"'),
      document.fonts.ready,
    ]);
  } catch {
    // Fonts load from files under app/; if one fails the fallback still renders.
  }
  await loadSamples();
  buildStyleButtons();
  buildSampleRow();
  buildPanelSelects();
  buildSizeTabs();
  wireInputs();
  wirePanZoom();
  const params = new URLSearchParams(location.search);
  if (params.has('shot')) {
    await runShot(api, params);
  } else {
    renderNow();
  }
}

init().catch((err) => setStatus(`Error: ${err.message}`));
