# SUNSET PRESS — one photo in, a full key-art poster out

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/dillahhhh/gta6-cover-art-01-entry/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/dillahhhh/gta6-cover-art-01-entry/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Built for the [gta6-cover-art-01 bounty on make.fun](https://make.fun/bounty/gta6-cover-art-01).

A web app that turns a person's photo and a caption into GTA-style cover art:
one hero photo painted full-bleed, three slanted supporting panels (The Crew,
The Getaway, The Score), and one huge gold-to-pink wordmark — exported as a
PNG in the common post sizes 1080×1080, 1080×1350 and 1920×1080.

## How it works

1. **Your photo** — pick a file from your machine or tap a sample. Photos are
   read on your machine only, never uploaded.
2. **Poster style** — six painted grades (Sunset, Neon Night, Teal Dusk, Warm
   Crew, Golden Hour, Vice Nights), or shuffle for a surprise.
3. **Caption** — type the title and kicker; move the title up or down.
4. **Panels** — each supporting panel takes any sample photo, and the hero can
   be panned (drag) and zoomed (scroll) right on the preview.
5. **Export** — one size, or all three at once.

The painted look is a hand-written canvas pipeline, no ML: the photo is
smoothed into flat regions, its light is posterized into 10 levels and washed
through a sunset gradient, a thin dark ink line is laid on the strong edges,
and a little of the real photo is blended back so faces stay readable. Grain
is kept very light on purpose.

## Run it

```sh
node serve.ts            # serves app/ on http://localhost:8080
```

No build step, no network at runtime: every script, font and sample photo is
a file under `app/`. Screenshots are taken with `python3 shots4.py`.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored make.fun library.

## Credits

- Hero photo: two men at a lakeside at golden hour, by Jace Ulloa on Unsplash
  (`app/samples/hero-real.jpg`). Used under the Unsplash licence.
- Fonts: Anton and Bebas Neue, both under the SIL Open Font License
  (`app/fonts/OFL.txt`).
- The other sample photos are original illustrations/photos bundled with the
  entry, free to use.

Licence: MIT (see `LICENSE`).
