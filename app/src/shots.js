// SUNSET PRESS — fixed scenes for screenshots.
//
// ?shot=cover&size=wide&photo=hero-real.jpg&caption=SUNSET%20HEIST
//   The cover alone at export resolution: the page shows only the preview
//   canvas, which holds the true export render.
// ?shot=editor&photo=hero-real.jpg
//   The full editor in a browser with the hero photo loaded, panels and
//   controls visible.
// window.__shotReady is set once the scene has painted (two frames later).

export async function runShot(api, query) {
  const shot = query.get('shot');
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const size = query.get('size') || 'square';
    const photo = query.get('photo') || 'hero-real.jpg';
    await api.loadCoverPhoto(photo);
    api.setTitle(query.get('caption') || 'SUNSET HEIST');
    api.setKicker(query.get('kicker') || 'ONE LAST JOB.');
    api.setSize(size);
    api.renderPreview();
  } else {
    document.body.classList.add('shot-editor');
    const photo = query.get('photo') || 'hero-real.jpg';
    await api.loadCoverPhoto(photo);
    api.setSize(query.get('size') || 'square');
    api.renderPreview();
  }
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
  window.__shotReady = true;
}
