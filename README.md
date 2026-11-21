# SUNSET PRESS — GTA-style cover art maker

One photo in. A full key-art poster out. SUNSET PRESS turns any photo into
painted GTA-style cover art: a full-bleed hero, three supporting panels with
their own colour grades, and a huge gold-to-pink wordmark — exported as a PNG
in the three common post sizes (1080 × 1080, 1080 × 1350, 1920 × 1080).

## How it works

- **Painted look, all canvas, no ML.** A smoothing pass, luminance posterize
  (13–14 levels) with ordered dithering so skin never bands into contour
  stripes, a sunset gradient map blended with the original photo so faces
  and cars stay readable, full-resolution Sobel ink weakened inside the
  face zone, light grain in the shadows, and a vignette.
- **Full-bleed hero.** The hero photo covers the whole canvas edge to edge.
  The panel stack sits on top of it, clipped to its own rect, and the title
  overlaps the hero's lower body — never a face.
- **Three panels, three grades.** THE CREW (warm sunset), THE GETAWAY
  (magenta night), THE SCORE (bright teal dusk). Each panel is a real photo,
  painted at output resolution, with a pill label.
- **Editor.** Live preview, size tabs, six style presets, panel side
  (Auto / Left / Right / Off), title-height control, subject-focus drag
  (a DOM overlay shown only while dragging — it never appears in exports),
  inline caption editing, one-click PNG export in all three sizes.

## Run it

Serve `app/` with any static server, then open it in a desktop browser:

```sh
node serve.ts        # http://localhost:8080
```

Everything is offline: every script, image and font is a file under `app/`.

## Screenshots

`shots4.py` renders all four with headless Chromium:

```sh
python3 shots4.py
```

## Hand it in

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Credits

- Hero photo: Jace Ulloa, "two people at a lakeside at golden hour"
  (Unsplash). Used under the Unsplash licence; not our photo, not claimed as
  ours.
- Fonts: Anton and Bebas Neue, both under the SIL Open Font License
  (see `app/fonts/OFL.txt`).
- Original work: no Rockstar Games logo, artwork, characters or fonts.

## License

MIT — see `LICENSE`.
