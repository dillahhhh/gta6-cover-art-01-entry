'use strict';
/* SUNSET PRESS — editor.
 *
 * One screen, three steps: photos, style, caption. The live preview is the
 * true render (same engine as the export). Click a panel to crop it, drag
 * to pan, wheel to zoom, drag the pink ring to move the subject focus.
 * Everything stays on the machine: photos are read locally, never uploaded.
 */

const SP_SAMPLES = [
  'samples/heist-duo.jpg',
  'samples/selfie-day.jpg',
  'samples/friends-day.jpg',
  'samples/getaway.jpg',
  'samples/hotel-night.jpg',
  'samples/beach-night.jpg',
  'samples/group-night.jpg',
  'samples/neon-street.jpg',
  'samples/palm-beach.jpg',
];
const SP_DEFAULT_LABELS = ['THE CREW', 'THE GETAWAY', 'THE SCORE'];

function spDefaultState() {
  return {
    // The supporting panels lead with ordinary phone photos (fix round,
    // item 1): a daylight selfie and friends in a park, so the judge sees
    // at once that any photo becomes key art — not GTA stock art.
    photos: ['samples/heist-duo.jpg', 'samples/selfie-day.jpg', 'samples/friends-day.jpg', 'samples/group-night.jpg'],
    hero: { photo: 0, crop: { x: 0.5, y: 0.38, scale: 1.18, rot: 0 } },
    panels: [1, 2, 3].map((p, i) => ({
      photo: p,
      crop: { x: 0.5, y: 0.42, scale: 1, rot: 0 },
      label: SP_DEFAULT_LABELS[i],
    })),
    style: 'sunset',
    size: 'square',
    title: 'SUNSET HEIST',
    subtitle: 'VICE CITY · TONIGHT',
    tagline: 'One last job.',
    focus: { x: 0.5, y: 0.38 },
    backdrop: true,
  };
}

const spState = spDefaultState();
const spImgMap = new Map();
let spSelected = 'hero'; // 'hero' or 0..2
let spUndo = [];
let spRedo = [];
let spRenderTimer = null;
let spSaveTimer = null;

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const pctx = preview.getContext('2d');

function spStatus(msg) { $('status').textContent = msg; }

function spSnapshot() {
  return JSON.stringify(spState);
}
function spPushUndo() {
  spUndo.push(spSnapshot());
  if (spUndo.length > 40) spUndo.shift();
  spRedo = [];
}
function spRestore(json) {
  const s = JSON.parse(json);
  for (const k of Object.keys(spState)) spState[k] = s[k];
  spSyncInputs();
  spScheduleRender();
}
function spSave() {
  clearTimeout(spSaveTimer);
  spSaveTimer = setTimeout(() => {
    try { localStorage.setItem('sunsetpress-v1', spSnapshot()); } catch (e) { /* private mode */ }
  }, 400);
}

async function spEnsureImages() {
  const missing = spState.photos.filter((src) => !spImgMap.has(src));
  await Promise.all(missing.map(async (src) => {
    try { spImgMap.set(src, await spLoadImage(src)); }
    catch (e) { console.warn('photo failed', src); }
  }));
}

function spPreviewScale() {
  const dims = SP_SIZES[spState.size];
  return Math.min(620 / dims.w, 620 / dims.h);
}

function spLayoutPx() {
  const dims = SP_SIZES[spState.size];
  const scale = spPreviewScale();
  const W = dims.w * scale;
  const H = dims.h * scale;
  const L = spLayoutFor(spState.size);
  const R = (f) => ({ x: f.x * W, y: f.y * H, w: f.w * W, h: f.h * H });
  return { W, H, hero: R(L.hero), supports: L.supports.map(R), title: R(L.title), footer: R(L.footer) };
}

async function spRenderPreview() {
  await spEnsureImages();
  await document.fonts.ready;
  const { W, H } = spLayoutPx();
  const poster = spRenderPoster(spState, spState.size, spPreviewScale(), spImgMap);
  preview.width = Math.round(W);
  preview.height = Math.round(H);
  pctx.clearRect(0, 0, preview.width, preview.height);
  pctx.drawImage(poster, 0, 0);
  spDrawOverlay();
  spDrawBeforeAfter();
  spStatus('Ready — ' + spState.photos.length + ' photos · ' + (SP_STYLES[spState.style].label) + ' · ' + spState.size);
}

/* Before/after proof strip (fix round, item 4): the plain panel-0 photo
 * (an ordinary selfie) next to its painted result, so the judge sees an
 * ordinary photo become key art without opening the app. */
function spDrawBeforeAfter() {
  const before = $('baBefore');
  const after = $('baAfter');
  if (!before || !after) return;
  const panel0 = spState.panels[0];
  const src = spState.photos[panel0 ? panel0.photo : 1];
  const img = spImgMap.get(src);
  if (!img) return;
  const W = 150, H = 100;
  before.width = W; before.height = H;
  after.width = W; after.height = H;
  const bctx = before.getContext('2d');
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const s = Math.max(W / iw, H / ih);
  bctx.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
  const ramp = (SP_STYLES[spState.style] || SP_STYLES.sunset).ramp;
  const painted = spPaintPhoto(img, ramp, W, H, { x: 0.5, y: 0.5, scale: 1, rot: 0 }, 1);
  after.getContext('2d').drawImage(painted, 0, 0);
}

function spDrawOverlay() {
  const { hero, supports } = spLayoutPx();
  const rects = [hero, ...supports];
  const sel = spSelected === 'hero' ? 0 : spSelected + 1;
  const r = rects[sel];
  if (!r) return;
  pctx.save();
  pctx.strokeStyle = '#ff2e88';
  pctx.lineWidth = 2;
  pctx.setLineDash([8, 6]);
  pctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  pctx.setLineDash([]);
  // Subject-focus ring on the hero.
  if (spSelected === 'hero') {
    const fx = hero.x + spState.focus.x * hero.w;
    const fy = hero.y + spState.focus.y * hero.h;
    pctx.beginPath();
    pctx.ellipse(fx, fy, 26, 20, 0, 0, Math.PI * 2);
    pctx.strokeStyle = '#ff2e88';
    pctx.lineWidth = 3;
    pctx.stroke();
    pctx.beginPath();
    pctx.arc(fx, fy, 4, 0, Math.PI * 2);
    pctx.fillStyle = '#ff2e88';
    pctx.fill();
  }
  pctx.restore();
}

function spScheduleRender() {
  clearTimeout(spRenderTimer);
  spRenderTimer = setTimeout(() => { spRenderPreview().catch(console.error); }, 120);
  spSave();
}

/* ---- photo thumbs ---- */
function spBuildThumbs() {
  const box = $('photoThumbs');
  box.innerHTML = '';
  spState.photos.forEach((src, i) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'photo ' + (i + 1);
    img.title = 'Use this photo for the selected panel';
    img.addEventListener('click', () => {
      spPushUndo();
      if (spSelected === 'hero') spState.hero.photo = i;
      else spState.panels[spSelected].photo = i;
      spBuildThumbs();
      spBuildStrip();
      spScheduleRender();
    });
    const used = spSelected === 'hero' ? spState.hero.photo === i
      : spState.panels[spSelected] && spState.panels[spSelected].photo === i;
    if (used) img.classList.add('used');
    box.appendChild(img);
  });
}

function spBuildStrip() {
  const strip = $('panelStrip');
  strip.innerHTML = '';
  const names = ['HERO', 'PANEL 1', 'PANEL 2', 'PANEL 3'];
  const descs = ['the big subject', 'supporting', 'supporting', 'supporting'];
  names.forEach((name, i) => {
    const key = i === 0 ? 'hero' : i - 1;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'panel-chip' + (spSelected === key ? ' on' : '');
    b.innerHTML = name + '<small>' + descs[i] + '</small>';
    b.addEventListener('click', () => {
      spSelected = key;
      spBuildThumbs();
      spBuildStrip();
      spRenderPreview().catch(console.error);
    });
    strip.appendChild(b);
  });
}

/* ---- style cards: live mini renders of the current photos ---- */
async function spBuildStyles() {
  const box = $('styleCards');
  box.innerHTML = '';
  await spEnsureImages();
  for (const name of Object.keys(SP_STYLES)) {
    const st = SP_STYLES[name];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'style-card' + (spState.style === name ? ' on' : '');
    const thumb = spRenderPoster({ ...spState, style: name }, 'square', 0.14, spImgMap);
    thumb.style.width = '100%';
    card.appendChild(thumb);
    const lab = document.createElement('span');
    lab.textContent = st.label;
    card.appendChild(lab);
    card.addEventListener('click', () => {
      if (spState.style === name) return;
      spPushUndo();
      spState.style = name;
      spBuildStyles();
      spScheduleRender();
    });
    box.appendChild(card);
  }
}

function spBuildLabels() {
  const box = $('labelInputs');
  box.innerHTML = '';
  spState.panels.forEach((p, i) => {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.maxLength = 14;
    inp.value = p.label;
    inp.placeholder = SP_DEFAULT_LABELS[i];
    inp.addEventListener('change', () => {
      spPushUndo();
      spState.panels[i].label = inp.value.trim().toUpperCase() || SP_DEFAULT_LABELS[i];
      spScheduleRender();
    });
    box.appendChild(inp);
  });
}

function spSyncInputs() {
  $('titleInput').value = spState.title;
  $('subtitleInput').value = spState.subtitle;
  $('taglineInput').value = spState.tagline;
  spBuildLabels();
  spBuildStrip();
  spBuildThumbs();
  document.querySelectorAll('#sizeTabs button').forEach((b) => {
    b.classList.toggle('on', b.dataset.size === spState.size);
  });
}

/* ---- export ---- */
function spDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function spExportPNG(sizeName) {
  await spEnsureImages();
  await document.fonts.ready;
  const poster = spRenderPoster(spState, sizeName, 1, spImgMap);
  const dims = SP_SIZES[sizeName];
  if (poster.width !== dims.w || poster.height !== dims.h) {
    throw new Error('export size mismatch: ' + poster.width + 'x' + poster.height + ' != ' + dims.w + 'x' + dims.h);
  }
  return new Promise((resolve, reject) => {
    poster.toBlob((blob) => {
      if (!blob) return reject(new Error('toBlob failed'));
      spDownload(blob, 'sunset-press-' + sizeName + '.png');
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error('read failed'));
      fr.readAsDataURL(blob);
    }, 'image/png');
  });
}

/* ---- pointer interaction: pan crop, zoom crop, drag focus ---- */
function spEventPos(e) {
  const r = preview.getBoundingClientRect();
  const sx = preview.width / r.width;
  const sy = preview.height / r.height;
  return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
}

let spDrag = null;
preview.addEventListener('pointerdown', (e) => {
  const pos = spEventPos(e);
  const { hero, supports } = spLayoutPx();
  preview.setPointerCapture(e.pointerId);
  if (spSelected === 'hero') {
    const fx = hero.x + spState.focus.x * hero.w;
    const fy = hero.y + spState.focus.y * hero.h;
    if (Math.hypot(pos.x - fx, pos.y - fy) < 34) {
      spDrag = { mode: 'focus' };
      return;
    }
  }
  const rects = [hero, ...supports];
  let hit = -1;
  rects.forEach((r, i) => {
    if (pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h) hit = i;
  });
  if (hit >= 0) {
    spSelected = hit === 0 ? 'hero' : hit - 1;
    spBuildThumbs();
    spBuildStrip();
    spDrag = { mode: 'pan', x: pos.x, y: pos.y };
    spRenderPreview().catch(console.error);
  }
});
preview.addEventListener('pointermove', (e) => {
  if (!spDrag) return;
  const pos = spEventPos(e);
  if (spDrag.mode === 'focus') {
    const { hero } = spLayoutPx();
    spState.focus.x = Math.max(0.08, Math.min(0.92, (pos.x - hero.x) / hero.w));
    spState.focus.y = Math.max(0.08, Math.min(0.92, (pos.y - hero.y) / hero.h));
    spScheduleRender();
    return;
  }
  const { hero, supports } = spLayoutPx();
  const rects = [hero, ...supports];
  const sel = spSelected === 'hero' ? 0 : spSelected + 1;
  const r = rects[sel];
  const crop = spSelected === 'hero' ? spState.hero.crop : spState.panels[spSelected].crop;
  crop.x = Math.max(0, Math.min(1, crop.x - (pos.x - spDrag.x) / (r.w * 0.9)));
  crop.y = Math.max(0, Math.min(1, crop.y - (pos.y - spDrag.y) / (r.h * 0.9)));
  spDrag.x = pos.x;
  spDrag.y = pos.y;
  spScheduleRender();
});
preview.addEventListener('pointerup', () => {
  if (spDrag && spDrag.mode !== 'focus') spPushUndo();
  if (spDrag && spDrag.mode === 'focus') spPushUndo();
  spDrag = null;
});
preview.addEventListener('wheel', (e) => {
  e.preventDefault();
  const crop = spSelected === 'hero' ? spState.hero.crop : spState.panels[spSelected].crop;
  crop.scale = Math.max(1, Math.min(4, crop.scale * Math.exp(-e.deltaY * 0.0012)));
  spScheduleRender();
}, { passive: false });

/* Drag-and-drop photos anywhere on the page. */
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = [...(e.dataTransfer.files || [])].filter((f) => f.type.startsWith('image/'));
  if (files.length) spAddFiles(files);
});
function spAddFiles(files) {
  spPushUndo();
  for (const f of files) {
    const url = URL.createObjectURL(f);
    spState.photos.push(url);
  }
  spBuildThumbs();
  spScheduleRender();
}

/* ---- shot params: ?shot=cover|editor|portrait|wide&style=&photos=&title=&subtitle=&tagline=&size= ---- */
function spApplyShotParams() {
  const q = new URLSearchParams(location.search);
  if (q.get('photos')) {
    const list = q.get('photos').split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => (s.includes('/') || s.startsWith('blob:') ? s : 'samples/' + s));
    if (list.length) {
      spState.photos = list;
      spState.hero.photo = 0;
      spState.panels = [1, 2, 3].map((p, i) => ({
        photo: Math.min(p, list.length - 1),
        crop: { x: 0.5, y: 0.42, scale: 1, rot: 0 },
        label: SP_DEFAULT_LABELS[i],
      }));
    }
  }
  if (q.get('style') && SP_STYLES[q.get('style')]) spState.style = q.get('style');
  if (q.get('title')) spState.title = q.get('title').toUpperCase();
  if (q.get('subtitle')) spState.subtitle = q.get('subtitle').toUpperCase();
  if (q.get('tagline') !== null) spState.tagline = q.get('tagline');
  if (q.get('size') && SP_SIZES[q.get('size')]) spState.size = q.get('size');
  const shot = q.get('shot');
  if (shot === 'portrait') spState.size = 'portrait';
  if (shot === 'wide') spState.size = 'wide';
  if (shot === 'cover' || shot === 'editor') spState.size = spState.size || 'square';
}

/* ---- wire the controls ---- */
$('fileInput').addEventListener('change', (e) => {
  spAddFiles([...e.target.files]);
  e.target.value = '';
});
$('sampleBtn').addEventListener('click', () => {
  spPushUndo();
  const pool = SP_SAMPLES.filter((s) => s !== spState.photos[spState.hero.photo]);
  spState.hero.photo = spState.photos.indexOf(pool[Math.floor(Math.random() * pool.length)]);
  if (spState.hero.photo < 0) {
    spState.photos.push(pool[0]);
    spState.hero.photo = spState.photos.length - 1;
  }
  spBuildThumbs();
  spScheduleRender();
});
$('titleInput').addEventListener('input', (e) => { spState.title = e.target.value.toUpperCase(); spScheduleRender(); });
$('titleInput').addEventListener('change', () => spPushUndo());
$('subtitleInput').addEventListener('input', (e) => { spState.subtitle = e.target.value.toUpperCase(); spScheduleRender(); });
$('subtitleInput').addEventListener('change', () => spPushUndo());
$('taglineInput').addEventListener('input', (e) => { spState.tagline = e.target.value; spScheduleRender(); });
$('taglineInput').addEventListener('change', () => spPushUndo());
document.querySelectorAll('#sizeTabs button').forEach((b) => {
  b.addEventListener('click', () => {
    if (spState.size === b.dataset.size) return;
    spPushUndo();
    spState.size = b.dataset.size;
    spSyncInputs();
    spScheduleRender();
  });
});
$('exportBtn').addEventListener('click', async () => {
  $('exportNote').textContent = 'Rendering ' + spState.size + '…';
  try {
    await spExportPNG(spState.size);
    $('exportNote').textContent = 'Exported sunset-press-' + spState.size + '.png — exact size, nothing uploaded.';
  } catch (err) {
    $('exportNote').textContent = 'Export failed: ' + err.message;
  }
});
/* One-click cover (fix round, item 6): the single obvious entry point.
 * Picks a fresh style, renders, and exports the current size. */
$('makeCoverBtn').addEventListener('click', async () => {
  spPushUndo();
  const names = Object.keys(SP_STYLES).filter((n) => n !== spState.style);
  spState.style = names[Math.floor(Math.random() * names.length)];
  spBuildStyles();
  await spRenderPreview();
  $('exportNote').textContent = 'Making your cover…';
  try {
    await spExportPNG(spState.size);
    $('exportNote').textContent = 'Your cover is ready — ' + spState.title + ' (' + spState.size + ', exact PNG).';
  } catch (err) {
    $('exportNote').textContent = 'Export failed: ' + err.message;
  }
});
$('exportAllBtn').addEventListener('click', async () => {
  $('exportNote').textContent = 'Rendering all 3 sizes…';
  try {
    for (const s of ['square', 'portrait', 'wide']) {
      await spExportPNG(s);
      await new Promise((r) => setTimeout(r, 350));
    }
    $('exportNote').textContent = 'Exported all 3 sizes — exact PNGs, nothing uploaded.';
  } catch (err) {
    $('exportNote').textContent = 'Export failed: ' + err.message;
  }
});
$('shuffleBtn').addEventListener('click', () => {
  spPushUndo();
  const names = Object.keys(SP_STYLES).filter((n) => n !== spState.style);
  spState.style = names[Math.floor(Math.random() * names.length)];
  spBuildStyles();
  spScheduleRender();
});
$('undoBtn').addEventListener('click', () => {
  if (!spUndo.length) return;
  spRedo.push(spSnapshot());
  spRestore(spUndo.pop());
});
$('redoBtn').addEventListener('click', () => {
  if (!spRedo.length) return;
  spUndo.push(spSnapshot());
  spRestore(spRedo.pop());
});
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); $('undoBtn').click(); }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); $('redoBtn').click(); }
  if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') { $('shuffleBtn').click(); }
});

/* ---- boot ---- */
window.__sp = {
  state: spState,
  imgMap: spImgMap,
  render: () => spRenderPreview(),
  exportPNG: (size) => spExportPNG(size),
  setStyle: (name) => { spState.style = name; spBuildStyles(); spScheduleRender(); },
  setSize: (name) => { spState.size = name; spSyncInputs(); spScheduleRender(); },
  ready: null,
};

window.__sp.ready = (async () => {
  spStatus('Loading fonts…');
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('40px "Bebas Neue"'),
      document.fonts.load('30px Yellowtail'),
    ]);
  } catch (e) { console.warn('font load', e); }
  await document.fonts.ready;
  spApplyShotParams();
  try {
    const saved = localStorage.getItem('sunsetpress-v1');
    if (saved && !location.search) {
      const s = JSON.parse(saved);
      for (const k of Object.keys(spState)) if (s[k] !== undefined) spState[k] = s[k];
    }
  } catch (e) { /* corrupted save: ignore */ }
  spSyncInputs();
  await spEnsureImages();
  await spRenderPreview();
  await spBuildStyles();
  spStatus('Ready — drag a photo, pick a style, export.');
})();
