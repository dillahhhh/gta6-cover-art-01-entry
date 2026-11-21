# SUNSET PRESS — a GTA 6-style cover maker

One photo in. A full key-art poster out.

SUNSET PRESS is an offline browser web app that turns a person's photo and
a caption into GTA 6-style cover art: a painted hero, a slanted three-panel
stack (THE CREW / THE GETAWAY / THE SCORE), and a big gold-to-pink 3D title,
exported as PNGs in the three common post sizes (1920×1080, 1080×1080,
1080×1350). No network at runtime, no uploads — photos never leave the
machine. Every file lives under `app/`.

## How it works

- **Painted look** (`app/src/paint.js`): a hand-written canvas pipeline —
  gentle smoothing, luminance posterize with dithering (so skin never shows
  contour bands), a gradient map (shadows deep violet, mids magenta/coral,
  highlights peach/gold) blended back with the original photo, a
  full-resolution Sobel ink outline, and fine uniform grain. No halftone
  dot pattern, so the sky stays clean.
- **Cover renderer** (`app/src/render.js`): per-size layout. The hero is
  painted full-bleed; the panel stack sits on the left with neon pink
  borders and pill labels; the title block is laid out **bottom-up from
  the footer**, so the footer always keeps its margin and the kicker and
  title can never drift up onto a face. That bottom-up layout is the fix
  for the wide cover, where the title used to cover the front subject's
  mouth and chin.
- **Editor** (`app/src/ui.js`, `app/index.html`): pick a photo or tap a
  sample, pick one of six poster styles, type the caption, switch sizes,
  drag on the preview to move the subject focus, export one size or all
  three. The subject-focus ring is a drag-only DOM overlay and never
  appears in exports or in the editor screenshot.

## Run it

```
node serve.ts            # app/ on http://localhost:8080
python3 shots4.py        # renders the 4 screenshots into screenshots/
```

## Hand it in

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored make.fun library
(`vendor/makefun-app.ts`).

## Photo credits

- Hero photo (`app/samples/hero-real.jpg`): Jace Ulloa, via Unsplash —
  two people at a lakeside at golden hour. Used as-is; not claimed as our
  own.
- The other sample photos in `app/samples/` are stand-ins shipped with
  the app so the first screenshot is never empty.

## Notes

- No Rockstar Games logo, wordmark, artwork, characters, or fonts are
  used. The lettering is built from SIL OFL display faces bundled under
  `app/fonts/` (Anton, Bebas Neue) and original shapes.
- No ML, no model downloads, no CDN fonts, no remote images, no
  analytics.
