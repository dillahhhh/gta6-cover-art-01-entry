// ui.js — SUNSET PRESS editor: state, controls, live preview, export, shot mode.
// The app runs fully offline: every photo, font and script lives under app/.
import {
  SIZES, PHOTOS, PANEL_DEFS, DEFAULT_STATE,
  loadImage, waitForFonts, renderCover, drawCover, resolvePanels, exportCover, exportAllSizes,
} from './render.js';
import { paintPhoto, PRESETS } from './paint.js';

const STORE_KEY = 'sunset-press-state-v1';
const $ = (id) => document.getElementById(id);

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const saved = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...saved, focus: saved.focus ?? null };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

let state = loadState();
let history = [];
let historyAt = -1;
let previewTimer = null;
let previewBusy = false;

function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

function pushHistory() {
  history = history.slice(0, historyAt + 1);
  history.push(JSON.stringify(state));
  if (history.length > 40) history.shift();
  historyAt = history.length - 1;
  updateUndoRedo();
}

function applyHistory(dir) {
  const next = historyAt + dir;
  if (next < 0 || next >= history.length) return;
  historyAt = next;
  state = JSON.parse(history[historyAt]);
  saveState();
  syncControls();
  schedulePreview();
  updateUndoRedo();
}

function updateUndoRedo() {
  const undo = $('undoBtn'), redo = $('redoBtn');
  if (undo) undo.disabled = historyAt <= 0;
  if (redo) redo.disabled = historyAt >= history.length - 1;
}

function setStatus(text) {
  const el = $('status');
  if (el) el.textContent = text;
}

// ---- preview ---------------------------------------------------------------
async function renderPreview() {
  const canvas = $('preview');
  if (!canvas) return;
  previewBusy = true;
  setStatus('Rendering…');
  try {
    const full = await renderCover(state, state.size);
    // Draw the full-size render scaled into the preview canvas.
    const { w, h } = SIZES[state.size];
    const maxW = 860;
    const scale = Math.min(1, maxW / w);
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(full, 0, 0, canvas.width, canvas.height);
    setStatus(`${SIZES[state.size].label} · ${state.photo} · ${PRESETS[state.preset].label} · panels ${resolvePanels(state) || 'off'}`);
  } catch (err) {
    setStatus('Render failed: ' + err.message);
  } finally {
    previewBusy = false;
  }
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 220);
}

// ---- style thumbnails -------------------------------------------------------
async function renderStyleThumbs() {
  const row = $('styleRow');
  if (!row) return;
  const img = await loadImage('samples/' + state.photo).catch(() => null);
  if (!img) return;
  for (const name of Object.keys(PRESETS)) {
    let btn = row.querySelector(`[data-preset="${name}"]`);
    if (!btn) continue;
    const cv = btn.querySelector('canvas');
    if (!cv) continue;
    const painted = paintPhoto(img, 168, 104, name, PRESETS[name].strength);
    cv.width = 168; cv.height = 104;
    cv.getContext('2d').drawImage(painted, 0, 0);
    btn.classList.toggle('active', state.preset === name);
  }
}

// ---- controls ----------------------------------------------------------------
function syncControls() {
  const set = (id, value) => { const el = $(id); if (el) el.value = value; };
  set('titleInput', state.title);
  set('kickerInput', state.kicker);
  set('subtitleInput', state.subtitle);
  set('footerInput', state.footer);
  set('titleLift', String(state.titleLift || 0));
  const liftVal = $('titleLiftVal');
  if (liftVal) liftVal.textContent = `${state.titleLift > 0 ? '+' : ''}${state.titleLift || 0}%`;
  const backdrop = $('backdropToggle');
  if (backdrop) backdrop.checked = !!state.backdrop;
  document.querySelectorAll('#panelsSeg button').forEach((b) => {
    b.classList.toggle('active', b.dataset.panels === state.panels);
  });
  document.querySelectorAll('#sizeTabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === state.size);
  });
  document.querySelectorAll('#photoStrip button').forEach((b) => {
    b.classList.toggle('active', b.dataset.photo === state.photo);
  });
}

function bindControls() {
  const onText = (id, key) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => {
      state[key] = el.value;
      saveState();
      schedulePreview();
    });
    el.addEventListener('change', pushHistory);
  };
  onText('titleInput', 'title');
  onText('kickerInput', 'kicker');
  onText('subtitleInput', 'subtitle');
  onText('footerInput', 'footer');

  const lift = $('titleLift');
  if (lift) {
    lift.addEventListener('input', () => {
      state.titleLift = Number(lift.value);
      const liftVal = $('titleLiftVal');
      if (liftVal) liftVal.textContent = `${state.titleLift > 0 ? '+' : ''}${state.titleLift}%`;
      saveState();
      schedulePreview();
    });
    lift.addEventListener('change', pushHistory);
  }

  const backdrop = $('backdropToggle');
  if (backdrop) {
    backdrop.addEventListener('change', () => {
      state.backdrop = backdrop.checked;
      saveState();
      pushHistory();
      schedulePreview();
    });
  }

  document.querySelectorAll('#panelsSeg button').forEach((b) => {
    b.addEventListener('click', () => {
      state.panels = b.dataset.panels;
      saveState();
      pushHistory();
      syncControls();
      schedulePreview();
    });
  });

  document.querySelectorAll('#sizeTabs button').forEach((b) => {
    b.addEventListener('click', () => {
      state.size = b.dataset.size;
      saveState();
      pushHistory();
      syncControls();
      schedulePreview();
    });
  });

  document.querySelectorAll('#photoStrip button').forEach((b) => {
    b.addEventListener('click', async () => {
      state.photo = b.dataset.photo;
      state.focus = null;
      state.zoom = 1;
      saveState();
      pushHistory();
      syncControls();
      await renderStyleThumbs();
      schedulePreview();
    });
  });

  document.querySelectorAll('#styleRow button').forEach((b) => {
    b.addEventListener('click', () => {
      state.preset = b.dataset.preset;
      saveState();
      pushHistory();
      renderStyleThumbs();
      schedulePreview();
    });
  });

  const upload = $('uploadInput');
  const uploadBtn = $('uploadBtn');
  if (upload && uploadBtn) {
    uploadBtn.addEventListener('click', () => upload.click());
    upload.addEventListener('change', async () => {
      const file = upload.files && upload.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      try {
        await loadImage(url);
      } catch {
        setStatus('That file did not load as a photo.');
        return;
      }
      // Uploaded photos join the strip as a one-off hero choice.
      const strip = $('photoStrip');
      if (strip) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.photo = url;
        btn.textContent = file.name.length > 18 ? file.name.slice(0, 17) + '…' : file.name;
        btn.addEventListener('click', () => {
          state.photo = url;
          state.focus = { x: 0.5, y: 0.4 };
          state.zoom = 1;
          saveState();
          pushHistory();
          syncControls();
          schedulePreview();
        });
        strip.appendChild(btn);
      }
      state.photo = url;
      state.focus = { x: 0.5, y: 0.4 };
      state.zoom = 1;
      saveState();
      pushHistory();
      syncControls();
      await renderStyleThumbs();
      schedulePreview();
    });
  }

  // Drag the preview to pan the hero; wheel to zoom. Both keep faces in frame
  // because the crop always recentres on the focus point.
  const wrap = $('previewWrap');
  const canvas = $('preview');
  if (wrap && canvas) {
    let dragging = null;
    canvas.addEventListener('pointerdown', (e) => {
      dragging = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const rect = canvas.getBoundingClientRect();
      const meta = PHOTOS[state.photo];
      const base = (state.focus || (meta && meta.focus) || { x: 0.5, y: 0.4 });
      const dx = (e.clientX - dragging.x) / rect.width;
      const dy = (e.clientY - dragging.y) / rect.height;
      state.focus = {
        x: Math.max(0.05, Math.min(0.95, base.x - dx * 0.6)),
        y: Math.max(0.05, Math.min(0.95, base.y - dy * 0.6)),
      };
      dragging = { x: e.clientX, y: e.clientY };
      saveState();
      schedulePreview();
    });
    canvas.addEventListener('pointerup', () => {
      if (dragging) { dragging = null; pushHistory(); }
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      state.zoom = Math.max(1, Math.min(2.2, (state.zoom || 1) * (e.deltaY < 0 ? 1.08 : 0.93)));
      saveState();
      schedulePreview();
    }, { passive: false });
  }

  const makeBtn = $('makeCoverBtn');
  if (makeBtn) {
    makeBtn.addEventListener('click', () => {
      pushHistory();
      schedulePreview();
      setStatus('Cover ready — pick a size and Export PNG.');
      const preview = $('previewWrap');
      if (preview) preview.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  const exportAll = $('exportAllBtn');
  if (exportAll) {
    exportAll.addEventListener('click', async () => {
      setStatus('Exporting all three sizes…');
      try {
        await exportAllSizes(state);
        setStatus('Exported 1080 × 1080, 1080 × 1350 and 1920 × 1080 PNGs.');
      } catch (err) {
        setStatus('Export failed: ' + err.message);
      }
    });
  }

  const exportOne = $('exportOneBtn');
  if (exportOne) {
    exportOne.addEventListener('click', async () => {
      const sel = $('exportSize');
      const size = sel ? sel.value : state.size;
      setStatus(`Exporting ${SIZES[size].label}…`);
      try {
        await exportCover(state, size);
        setStatus(`Exported ${SIZES[size].label}.`);
      } catch (err) {
        setStatus('Export failed: ' + err.message);
      }
    });
  }

  const undo = $('undoBtn');
  if (undo) undo.addEventListener('click', () => applyHistory(-1));
  const redo = $('redoBtn');
  if (redo) redo.addEventListener('click', () => applyHistory(1));

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      applyHistory(e.shiftKey ? 1 : -1);
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      exportCover(state, state.size);
    }
  });
}

// ---- shot mode (for screenshots) ----------------------------------------------
function shotParams() {
  const q = new URLSearchParams(location.search);
  return {
    shot: q.get('shot') || '',
    photo: q.get('photo') || '',
    caption: q.get('caption') || '',
    size: q.get('size') || '',
    panels: q.get('panels') || '',
    titleLift: q.get('titley'),
    backdrop: q.get('backdrop'),
  };
}

async function runShotMode(p) {
  document.body.classList.add('shot');
  if (p.photo && (PHOTOS[p.photo] || p.photo.startsWith('samples/'))) {
    state.photo = p.photo;
  }
  if (p.caption) state.title = p.caption;
  if (p.size && SIZES[p.size]) state.size = p.size;
  if (p.panels && ['auto', 'left', 'right', 'off'].includes(p.panels)) state.panels = p.panels;
  if (p.titleLift != null) state.titleLift = Number(p.titleLift) || 0;
  if (p.backdrop != null) state.backdrop = p.backdrop === '1';
  state.focus = null;
  state.zoom = 1;
  syncControls();
  await renderStyleThumbs();

  if (p.shot === 'cover') {
    // Full-frame cover: the canvas is the whole viewport.
    document.body.classList.add('shot-cover');
    const stage = $('shotStage');
    const canvas = await renderCover(state, state.size);
    canvas.id = 'shotCanvas';
    if (stage) {
      stage.innerHTML = '';
      stage.appendChild(canvas);
    }
    window.__shotReady = true;
    return;
  }
  // Editor shot: the normal editor, fully rendered.
  await renderPreview();
  window.__shotReady = true;
}

// ---- boot ---------------------------------------------------------------------
async function init() {
  const p = shotParams();
  pushHistory();
  bindControls();
  syncControls();
  await waitForFonts();
  if (p.shot) {
    await runShotMode(p);
    return;
  }
  await renderStyleThumbs();
  await renderPreview();
  window.__shotReady = true;
}

init();
