# SUNSET PRESS — one photo in, a full key-art poster out

An offline web app that turns any photo and a caption into GTA 6-style cover art:
a multi-panel poster with bold lettering and a Vice City sunset or neon grade,
exported as a PNG to share. Made for the make.fun competition
`gta6-cover-art-01`.

## What it does

- **One photo in.** Pick a bundled sample or upload your own. The photo fills
  the hero panel and the three supporting panels, each with its own paint grade.
- **Painted key art, not a filter.** A hand-written canvas pipeline (smoothing,
  posterize, gradient map, ink outline, grain, vignette) turns photos into flat
  "ink and paint" poster art. Four grades: Sunset, Neon Night, Teal Dusk,
  Mono Pink.
- **Real poster layout.** A large hero, three supporting panels with slanted
  cuts and neon gutters, a huge gradient wordmark with extrusion and glow, a
  star row and a footer line. Panels go Auto (the side that never covers a
  face), Left, Right or Off.
- **Any photo.** Drag the preview to pan the hero, scroll to zoom; the crop
  always recentres on the subject. A Subject Focus point per photo keeps faces
  in frame, and the title band can be nudged up or down with the Title height
  slider so it never sits on a face.
- **Fast and easy.** Three steps — photo, style, caption — then Export PNG in
  1080 × 1080, 1080 × 1350 and 1920 × 1080, one at a time or all three at once.
  Undo/redo and autosave to localStorage.
- **Optional Sunset Backdrop.** A procedural Vice City sunset (sun disc,
  banded clouds, palm silhouettes, art-deco skyline) behind the hero, with a
  feathered subject-focus mask. Off by default.

## Run it

```sh
node serve.ts            # serves app/ on http://localhost:8080
```

No build step, no network: every script, font and photo lives under `app/`.
The hand-in program is `main.ts` (Node 22): it copies `app/` and
`screenshots/` to `/output` and writes `dossier.json`.

Screenshots are taken by `shots4.py` (Playwright): it serves the app, opens
each scene from `shots.json`, waits for the app to finish rendering, and saves
a JPEG under `screenshots/` — wide cover, square cover, editor, portrait cover.

## Credits and rights

- Cover photo `app/samples/hero-real.jpg`: Jace Ulloa, via Unsplash
  (two men at a lakeside at golden hour). Used with attribution; the photo is
  not claimed as our own.
- The other sample photos under `app/samples/` were made for this app with an
  image model and are free to use.
- Fonts: Anton and Bebas Neue, both under the SIL Open Font License 1.1
  (see `app/fonts/OFL.txt`).
- No Rockstar Games logo, artwork, character or font is used anywhere. All
  lettering, panels and grades are original.

## Licence

MIT — see `LICENSE`.
