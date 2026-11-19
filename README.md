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
- **Poster art engine, one treatment for every panel.** Photos are run
  through a Painterly / Ink Art Engine (posterized colour separation,
  edge-aware ink outlines, halftone dots, cinematic light, print grain) so
  the cover reads as one illustration, not photos pasted on a template.
  Three treatments (Ink Heist, Painterly, Airbrushed Retro) with a strength
  slider; skin-safe grading keeps faces natural (separate face-protection
  control) while the background goes full poster.
- **3D poster lettering.** The headline is extruded in depth with a
  directional shadow, layered outlines, a gradient fill and a bevel
  highlight — three styles (Extrude, Neon Stack, Slab) — not just glow.
- **Poster formulas + Surprise Me.** Five curated picks (Ink Heist, Neon
  Noir Collage, Sunset Pulp, Retro Airbrush, Golden Hour) set layout,
  treatment, lettering and grade together; Surprise Me picks one of them.
- **Auto-composition.** Uploads get their subject found offline (skin-tone
  clusters + contrast saliency — a heuristic, not face recognition) and the
  crop centres on it; faces ride high in their panel so heads and cars are
  not cut. Or tap a subject on the cover to set the focus point by hand.
  Proven: every sample photo's focus survives wide, tall, square,
  selfie-like and group-like crops without manual adjustment.
- **Story beats.** Each sample photo plays a chapter of the heist
  (THE CREW, THE GETAWAY, THE MEET, THE SCORE, THE AFTERMATH,
  NEON STREETS, PALM BEACH), labelled on its panel, so the lower panels
  tell one story instead of showing locations.
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
    state.js            the cover's state (photos, crops, words, light, art)
    layouts.js          the 8 multi-panel compositions
    render.js           the one render pipeline (preview = export)
    painterly.js        the Painterly / Ink Art Engine (posterize, ink, halftone)
    focus.js            auto-composition: subject detection + cover-fit maths
    formulas.js         the 5 curated poster formulas + Surprise Me
    effects.js          sunset wash, neon glow, grain, vignette
    ui.js               controls, drag-to-pan, export
    shots.js            fixed scenes for screenshots (?shot=...)
  fonts/                Anton, Bebas Neue, Yellowtail (SIL OFL)
  samples/              7 photos, free to use (see below)
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

`app/samples/heist-duo.jpg`, `getaway.jpg`, `hotel-night.jpg`,
`beach-night.jpg` and `group-night.jpg` are image-model art made for this
entry: one heist crew — two characters, their car, the hotel, the night
beach and five friends on Ocean Drive — so the default cover tells one
story instead of four unrelated pictures. `neon-street.jpg` and
`palm-beach.jpg` are procedural canvas art drawn for this entry. No
real people, no game artwork anywhere.

Each sample carries a focus point (where its subject sits), and the renderer
centres each panel's crop on it: faces and heroes stay in frame in every
panel shape and export size. Headline and subtitle are kept inside a safe
zone, so no word is ever clipped at an edge. Uploaded photos get their focus
auto-detected offline (skin-tone clusters + contrast saliency, a heuristic —
not face recognition; measured misses remain, e.g. it counts two people in
Heist Duo with the midpoint biased left, and Getaway lands 0.32 from its
curated focus), or the user taps the subject to set it by hand. A
sky-wash guard re-picks below the sky when the winning saliency cluster
looks like clouds: Beach Night's tiny couple is found at 0.22 from the
curated focus (NEAR, not exact). A row of people that merges into one wide
skin blob is split into ~bw/2.5 person points, so Group Night reads as a
group near the row's centroid. Samples always keep their curated focus.

## Screenshots

Made by running the app in headless Chromium (see `shots.json` for the
scenes): `1-cover.jpg` is an exported 1080 × 1080 cover (Sunset Pulp
formula), `2-editor.jpg` the editor with photos loaded (Golden Hour),
`3-cover-portrait.jpg` an exported 1080 × 1350 cover (Ink Heist),
`4-cover-wide.jpg` an exported 1920 × 1080 cover (Neon Noir).
