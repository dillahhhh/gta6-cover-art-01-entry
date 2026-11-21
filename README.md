# SUNSET PRESS

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/dillahhhh/gta6-cover-art-01-entry/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/dillahhhh/gta6-cover-art-01-entry/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

One photo in. A full key-art poster out. **SUNSET PRESS** is a single-page
web app that runs entirely offline in a desktop browser: drop in your photos,
pick a poster style, write the headline, and export a GTA 6-style cover as a
PNG to share.

## What it does

- **Your photos, local only.** Upload photos or use the built-in samples.
  Photos are read on your machine and never uploaded anywhere.
- **Painted key-art engine, not a filter.** Every photo is run through a
  canvas pipeline — smoothing, a posterized gradient map, a Sobel ink
  outline, shadow grain and a rim light — so each panel reads as
  illustration, not a filtered photo.
- **Full-bleed hero + supporting cast composition.** One painted photo
  fills the whole poster, top to bottom, with the title, tagline and
  footer sitting on it over a dark bottom gradient, plus three slanted
  supporting panels on the right, each in a warm colour treatment, with
  editable pill labels.
- **Procedural Vice City sunset (opt-in).** A "Sunset backdrop" toggle
  paints the skyline in code — a striped sun, banded clouds, a neon
  art-deco skyline and palm silhouettes — behind the hero photo, which
  fades into it in the lower half. Off by default: the hero is one
  full photo.
- **Big original lettering.** A huge gold-to-pink 3D wordmark with
  extrusion, outline, neon glow and a top highlight, set in SIL Open Font
  License faces bundled under `app/fonts/` (Anton, Bebas Neue).
  No Rockstar logo, artwork or font anywhere.
- **6 poster styles** (Sunset, Neon Night, Teal Dusk, Mono Pink, Golden
  Hour, Vice Pop), each setting the grade and lettering together,
  shown as live thumbnails of your actual photo.
- **Exact export sizes.** 1080×1080, 1080×1350 and 1920×1080, each
  re-laid out (not just re-cropped), exported as exact-size PNGs.
- **Fast editor.** Live preview that is the true render, click-to-crop
  with drag pan and wheel zoom, a draggable subject-focus ring, undo/redo,
  shuffle, and autosave to localStorage.
- **One-click cover.** The big MAKE MY COVER button picks a fresh style
  and exports the current size in one tap.
- **Ordinary photos become key art.** The built-in samples include
  ordinary daylight photos (a selfie and friends in a park) alongside
  the cinematic cast shots, and every panel crops to the faces, so an
  ordinary phone selfie visibly becomes key art.
- Hero photo: Jace Ulloa / Unsplash (two men at a lakeside at golden hour).

## Try it

Serve `app/` with any static server (for example `node serve.ts`, then open
http://localhost:8080) and it works with no network request.

## Screenshots

`shots.json` records how each screenshot in `screenshots/` was taken:
`1-cover.jpg` is the exported square poster, `2-editor.jpg` the editor with
a photo loaded, `3-cover-portrait.jpg` the portrait export and
`4-cover-wide.jpg` the wide export.
