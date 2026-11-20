#!/usr/bin/env python3
"""Take SUNSET PRESS screenshots per shots.json (fix round 4).

Cover shots (cover/portrait/wide) come from __sp.exportPNG (exact-size
PNG) resized to the shots.json dimensions and saved as JPEG.
The editor shot is a full-page screenshot.
Also verifies the 3 export PNG sizes and reports console errors.
"""
import base64
import io
import json
import os
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.expanduser('~/workspace/makefun/gta6-cover-art-01-entry')
SHOTS = json.load(open(os.path.join(ROOT, 'shots.json')))
BASE = 'http://localhost:8080/'


def save_jpeg(img, path, max_bytes=262144):
    q = 90
    while q >= 40:
        buf = io.BytesIO()
        img.save(buf, 'JPEG', quality=q)
        if len(buf.getvalue()) <= max_bytes or q == 40:
            open(path, 'wb').write(buf.getvalue())
            return len(buf.getvalue()), q
        q -= 6
    return len(buf.getvalue()), q


def main():
    only = sys.argv[1:] or None
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(accept_downloads=True)
        ctx.set_default_timeout(120000)
        page = ctx.new_page()
        page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        for shot in SHOTS:
            if only and shot['name'] not in only:
                continue
            page.set_viewport_size({'width': shot['w'], 'height': shot['h']})
            page.goto(BASE + shot['query'])
            # evaluate() awaits the __sp.ready promise: fonts loaded,
            # photos loaded, first preview + style thumbs rendered.
            page.evaluate('window.__sp.ready')
            page.wait_for_timeout(400)
            out = os.path.join(ROOT, 'screenshots', shot['name'])
            if 'shot=editor' in shot['query']:
                page.screenshot(path='/tmp/editor-raw.png', full_page=False)
                img = Image.open('/tmp/editor-raw.png').convert('RGB')
                n, q = save_jpeg(img, out)
                print(f"{shot['name']}: editor full-page {img.size} -> {n} B q={q}")
            else:
                size = {'cover': 'square', 'portrait': 'portrait', 'wide': 'wide'}
                q = shot['query']
                size_name = 'portrait' if 'portrait' in q else ('wide' if 'wide' in q else 'square')
                data_url = page.evaluate(f"window.__sp.exportPNG('{size_name}')")
                raw = base64.b64decode(data_url.split(',', 1)[1])
                img = Image.open(io.BytesIO(raw)).convert('RGB')
                print(f"{shot['name']}: export {size_name} PNG {img.size}")
                if img.size != (shot['w'], shot['h']):
                    img = img.resize((shot['w'], shot['h']), Image.LANCZOS)
                n, qq = save_jpeg(img, out)
                print(f"{shot['name']}: saved {img.size} -> {n} B q={qq} {'OK' if n <= 262144 else 'OVER'}")
        # Export size verification for all 3 sizes (square page)
        page.set_viewport_size({'width': 1280, 'height': 900})
        page.goto(BASE + '?shot=cover&photos=heist-duo.jpg,selfie-day.jpg,friends-day.jpg,group-night.jpg&style=sunset&title=SUNSET%20HEIST&subtitle=VICE%20CITY%20%C2%B7%20TONIGHT&tagline=One%20last%20job.&size=square')
        page.evaluate('window.__sp.ready')
        for size_name, expect in [('square', (1080, 1080)), ('portrait', (1080, 1350)), ('wide', (1920, 1080))]:
            data_url = page.evaluate(f"window.__sp.exportPNG('{size_name}')")
            raw = base64.b64decode(data_url.split(',', 1)[1])
            img = Image.open(io.BytesIO(raw))
            ok = 'OK' if img.size == expect else 'MISMATCH'
            print(f"export {size_name}: {img.size} expected {expect} {ok}")
        browser.close()
    print('CONSOLE ERRORS:' if errors else 'CONSOLE: no errors')
    for e in errors:
        print(' ', e)


if __name__ == '__main__':
    main()
