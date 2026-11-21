#!/usr/bin/env python3
"""shots4.py — renders the 4 SUNSET PRESS screenshots with headless Chromium.

Serves app/ locally, drives the editor through window.__sunsetPress, and
saves each shot as a JPEG inside the 256 KiB / 1280px limits.

Usage: python3 shots4.py [--port 8123]
Exits non-zero if any shot is missing, oversized, or a console error fired.
"""
import argparse
import base64
import io
import json
import os
import subprocess
import sys
import time

REPO = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(REPO, 'app')
OUT_DIR = os.path.join(REPO, 'screenshots')
MAX_BYTES = 262144
LONG_MAX = 1280
SHORT_MIN = 480

EXPORT_SHOTS = [
    ('wide', '1-cover-wide.jpg'),
    ('square', '2-cover.jpg'),
    ('portrait', '4-cover-portrait.jpg'),
]
EXPECTED_PX = {'wide': (1920, 1080), 'square': (1080, 1080), 'portrait': (1080, 1350)}


def save_jpeg(pil_img, path):
    """Resize to the limits and save as JPEG under MAX_BYTES."""
    img = pil_img.convert('RGB')
    w, h = img.size
    scale = min(1.0, LONG_MAX / max(w, h))
    if scale < 1.0:
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    w, h = img.size
    assert max(w, h) <= LONG_MAX, f'{path}: long side {max(w, h)} > {LONG_MAX}'
    assert min(w, h) >= SHORT_MIN, f'{path}: short side {min(w, h)} < {SHORT_MIN}'
    quality = 84
    while quality >= 40:
        buf = io.BytesIO()
        img.save(buf, 'JPEG', quality=quality, optimize=True)
        if len(buf.getvalue()) <= MAX_BYTES:
            with open(path, 'wb') as f:
                f.write(buf.getvalue())
            return len(buf.getvalue()), img.size
        quality -= 8
    raise SystemExit(f'{path}: cannot fit under {MAX_BYTES} bytes')


def main():
    global Image
    from PIL import Image
    from playwright.sync_api import sync_playwright

    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=8123)
    args = ap.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)
    server = subprocess.Popen(
        [sys.executable, '-m', 'http.server', str(args.port), '--bind', '127.0.0.1'],
        cwd=APP_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    errors = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={'width': 1280, 'height': 720})
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(f'http://127.0.0.1:{args.port}/', wait_until='networkidle')
            page.wait_for_function('window.__sunsetPress && window.__sunsetPress.ready', timeout=60000)
            # Let the preview finish painting.
            page.wait_for_timeout(2500)
            # Exact export sizes, straight from the canvas.
            for size in ('wide', 'square', 'portrait'):
                dims = page.evaluate(
                    """async (s) => {
                        const c = await window.__sunsetPress.renderCover(s);
                        return [c.width, c.height];
                    }""", size)
                assert tuple(dims) == EXPECTED_PX[size], f'{size}: exported {dims}, expected {EXPECTED_PX[size]}'
            # Exported covers.
            for size, name in EXPORT_SHOTS:
                data_url = page.evaluate(
                    'async (s) => window.__sunsetPress.exportPNG(s)', size)
                assert data_url.startswith('data:image/png;base64,'), f'{size}: bad data URL'
                raw = base64.b64decode(data_url.split(',', 1)[1])
                img = Image.open(io.BytesIO(raw))
                path = os.path.join(OUT_DIR, name)
                nbytes, dims = save_jpeg(img, path)
                print(f'{name}: {dims[0]}x{dims[1]}, {nbytes} bytes')
            # Editor shot: the app in a browser with the hero photo loaded.
            page.set_viewport_size({'width': 1280, 'height': 720})
            page.wait_for_timeout(1200)
            editor_path = os.path.join(OUT_DIR, '3-editor.jpg')
            page.screenshot(path=editor_path)
            img = Image.open(editor_path)
            nbytes, dims = save_jpeg(img, editor_path)
            print(f'3-editor.jpg: {dims[0]}x{dims[1]}, {nbytes} bytes')
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)

    if errors:
        print('CONSOLE ERRORS:', file=sys.stderr)
        for e in errors:
            print(' -', e, file=sys.stderr)
        raise SystemExit(1)
    print('ALL SHOTS OK, 0 console errors')


if __name__ == '__main__':
    main()
