# Vice City Cover Lab

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/dillahhhh/gta6-cover-art-01-entry/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/dillahhhh/gta6-cover-art-01-entry/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Turn your photos into a Vice City poster. **Vice City Cover Lab** is a
single-page web app that runs entirely offline in a desktop browser: add
your photos, pick one of eight multi-panel layouts, crop and position each
photo, write the headline, grade the light, and export a PNG to share.

## What it does

- **Your photos, local only.** Upload one photo or several at once. Photos
  are read on your machine and never uploaded anywhere.
- **8 multi-panel layouts, each a different composition** — not recolors:
  1. **Vice City Sunset** — big hero panel on top, three strips below.
  2. **Neon Noir** — tall side panel with two stacked smalls.
  3. **Miami Luxury** — clean four-grid over a wide caption banner.
  4. **Cinematic Collage** — overlapping tilted prints, film-poster feel.
  5. **Diagonal Heist** — two panels split on a diagonal.
  6. **Portrait Duo** — two tall portraits over a caption band.
  7. **Sunset Strip** — film strips top and bottom with a hero in the middle.
  8. **Vice Grid** — asymmetric mosaic: one big panel, two smalls, a wide base.
- **Per-panel crop and position.** Click a panel to select it, drag the
  photo inside it, or use the zoom and pan sliders. Each panel can hold a
  different photo, or one photo can fill them all.
- **Editable words.** Headline and subtitle with four fonts, size sliders,
  colour pickers, neon glow and dark outline. Drag the words on the cover
  to move them.
- **Light and film.** Five cinematic colour grades (Sunset, Neon, Noir,
  Miami, Cinematic), a sunset wash, neon glow, film grain and vignette —
  every one with a live slider.
- **Live preview.** What you see is exactly what the PNG gets: the preview
  and the export share one render pipeline.
- **One-click export.** PNG in 1080 × 1080, 1080 × 1350 and 1920 × 1080.

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome. No build step, no
network: every script, font and image is a file under `app/`.

## Layout

```
app/
  index.html            the page
  style.css             dark premium interface
  src/
    state.js            the cover's state (photos, crops, words, light)
    layouts.js          the 8 multi-panel compositions
    render.js           the one render pipeline (preview = export)
    effects.js          sunset wash, neon glow, grain, vignette
    ui.js               controls, drag-to-pan, export
    shots.js            fixed scenes for screenshots (?shot=...)
  fonts/                Anton, Bebas Neue, Yellowtail (SIL OFL)
  samples/              6 photos, free to use (see below)
screenshots/            4 screenshots made by running the app
main.ts                 the entry program (copies app/ + screenshots/,
                        writes dossier.json, verifies the hand-in)
serve.ts                tiny static server for local tries
```

## Fonts

Anton, Bebas Neue and Yellowtail are licensed under the SIL Open Font
License, Version 1.1 — see `app/fonts/OFL.txt`. No Rockstar Games logo,
wordmark, artwork, character or font is used anywhere in this app; the
cover art and lettering are original.

## Sample photos

`app/samples/heist-duo.jpg`, `getaway.jpg`, `hotel-night.jpg` and
`beach-night.jpg` are image-model art made for this entry: one heist crew —
two characters, their car, the hotel and the night beach — so the default
cover tells one story instead of four unrelated pictures. `neon-street.jpg`
and `palm-beach.jpg` are procedural canvas art drawn for this entry. No
real people, no game artwork anywhere.

Each sample carries a focus point (where its subject sits), and the renderer
centres each panel's crop on it: faces and heroes stay in frame in every
panel shape and export size. Headline and subtitle are kept inside a safe
zone, so no word is ever clipped at an edge.

## Screenshots

Made by running the app in headless Chromium (see `shots.json` for the
scenes): `1-cover.jpg` is an exported 1080 × 1080 cover, `2-editor.jpg`
the editor with photos loaded, `3-cover-portrait.jpg` an exported
1080 × 1350 cover, `4-cover-wide.jpg` an exported 1920 × 1080 cover.
