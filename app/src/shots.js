// Fixed scenes for screenshots: ?shot=cover shows the cover alone at an
// export size; ?shot=editor shows the app with a photo loaded. `photo`
// picks a sample, `layout` a layout id, `caption` the headline, `subtitle`
// the subline, `size` square/portrait/wide, `grade` a colour grade.
// `formula` applies a curated poster formula first (layout, treatment,
// lettering, grade together); `treatment` and `lettering` then override
// single art settings, and `layout` overrides the formula's layout.
// window.__shotReady is set once the cover is painted.
import { layoutById } from './layouts.js';
import { applyFormula } from './formulas.js';

export async function runShot(shot, query, app) {
  const { state, addSample, fitPreviewSize, requestRedraw } = app;
  const size = query.get('size') || 'square';
  if (['square', 'portrait', 'wide'].includes(size)) state.sizeId = size;
  const formula = query.get('formula');
  if (formula) applyFormula(state, formula);
  const layout = layoutById(query.get('layout') || state.layoutId);
  state.layoutId = layout.id;
  document.querySelectorAll('.layout-btn').forEach((el) => el.classList.toggle('active', el.dataset.layout === layout.id));
  state.headline.x = layout.text.headline.x;
  state.headline.y = layout.text.headline.y;
  state.subtitle.x = layout.text.subtitle.x;
  state.subtitle.y = layout.text.subtitle.y;
  const caption = query.get('caption');
  if (caption !== null) state.headline.text = caption;
  const subtitle = query.get('subtitle');
  if (subtitle !== null) state.subtitle.text = subtitle;
  const grade = query.get('grade');
  if (grade) state.fx.grade = grade;
  const treatment = query.get('treatment');
  if (treatment) state.art.treatment = treatment;
  const lettering = query.get('lettering');
  if (lettering) state.art.lettering = lettering;
  const photo = query.get('photo') || 'heist-duo.jpg';
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await addSample(photo);
  const extra = query.get('photos');
  if (extra) {
    for (const file of extra.split(',')) {
      if (file && file !== photo) await addSample(file);
    }
  }
  const sizeSelect = document.getElementById('sizeSelect');
  if (sizeSelect) sizeSelect.value = state.sizeId;
  if (app.syncControls) app.syncControls();
  fitPreviewSize();
  requestRedraw();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
