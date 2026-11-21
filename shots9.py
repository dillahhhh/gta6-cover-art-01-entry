#!/usr/bin/env python3
"""SUNSET PRESS round 9 — screenshot runner (written fresh, from scratch).

Serves app/ with serve.ts, renders the three cover sizes plus the editor
in headless Chromium, and writes 4 JPEG screenshots into screenshots/:
  1-cover-wide.jpg      1280x720    (wide export downscaled)
  2-cover.jpg           1080x1080   (square export)
  3-editor.jpg          1280x960    (editor at 1280x960 viewport)
  4-cover-portrait.jpg  1024x1280   (portrait export downscaled)
Every file must be <= 262144 bytes (kit limit). JPEG quality is stepped
down until the file fits. Run from the repo root: python3 shots9.py
"""
import io
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
SHOTS_DIR = ROOT / "screenshots"
BASE = "http://localhost:8080"
MAX_BYTES = 262144

# (shot-key, out-file, target w, target h, viewport w, viewport h)
COVERS = [
    ("wide", "1-cover-wide.jpg", 1280, 720, 1920, 1080),
    ("square", "2-cover.jpg", 1080, 1080, 1080, 1080),
    ("portrait", "4-cover-portrait.jpg", 1024, 1280, 1080, 1350),
]


def save_jpeg(img: Image.Image, path: Path, target_w: int, target_h: int) -> int:
    img = img.convert("RGB").resize((target_w, target_h), Image.LANCZOS)
    for quality in (90, 85, 80, 75, 70, 62, 55, 48):
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=quality, optimize=True)
        if len(buf.getvalue()) <= MAX_BYTES:
            path.write_bytes(buf.getvalue())
            return len(buf.getvalue())
    # last resort: keep shrinking the long side a little
    for scale in (0.95, 0.9, 0.85):
        small = img.resize((int(target_w * scale), int(target_h * scale)), Image.LANCZOS)
        buf = io.BytesIO()
        small.save(buf, "JPEG", quality=48, optimize=True)
        if len(buf.getvalue()) <= MAX_BYTES:
            path.write_bytes(buf.getvalue())
            return len(buf.getvalue())
    raise RuntimeError(f"cannot fit {path} under {MAX_BYTES} bytes")


def wait_server(timeout=30):
    for _ in range(timeout * 2):
        try:
            urllib.request.urlopen(BASE + "/", timeout=1)
            return
        except Exception:
            time.sleep(0.5)
    raise RuntimeError("serve.ts did not come up")


def main():
    SHOTS_DIR.mkdir(exist_ok=True)
    server = subprocess.Popen(
        ["node", "serve.ts"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        wait_server()
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            try:
                for key, name, tw, th, vw, vh in COVERS:
                    page = browser.new_page(viewport={"width": vw, "height": vh})
                    page.goto(f"{BASE}/?shot={key}", wait_until="load")
                    page.wait_for_selector("#stage[data-ready='1']", timeout=60000)
                    page.wait_for_timeout(400)
                    png = page.locator("#stage").screenshot()
                    page.close()
                    img = Image.open(io.BytesIO(png))
                    size = save_jpeg(img, SHOTS_DIR / name, tw, th)
                    print(f"{name}: {tw}x{th} {size} bytes")

                page = browser.new_page(viewport={"width": 1280, "height": 960})
                page.goto(BASE + "/", wait_until="load")
                page.wait_for_selector("#stage[data-ready='1']", timeout=60000)
                page.wait_for_timeout(400)
                png = page.screenshot()
                page.close()
                img = Image.open(io.BytesIO(png))
                size = save_jpeg(img, SHOTS_DIR / "3-editor.jpg", 1280, 960)
                print(f"3-editor.jpg: 1280x960 {size} bytes")
            finally:
                browser.close()
    finally:
        server.terminate()
    print("done")


if __name__ == "__main__":
    sys.exit(main())
