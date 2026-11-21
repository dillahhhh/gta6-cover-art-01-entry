#!/usr/bin/env python3
"""SUNSET PRESS — take the four entry screenshots with headless Chromium.

Serves app/ with the repo's own serve.ts, opens each scene from shots.json,
waits for window.__shotReady, then captures it: cover scenes as a shot of the
preview canvas itself (the app's own export-size drawing), the editor scene as
a viewport shot of the page. Every image is downscaled to the competition
limits (long side <= 1280, short side >= 480, <= 256 KiB) and saved as JPEG.

Usage: python3 shots4.py [--port 8091]
Exits non-zero on any console error, any failed shot, or any oversize file.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
NODE22 = Path.home() / "workspace/makefun/github-core-clone-01/work/node22/node-v22.23.4-linux-x64/bin/node"


def node_bin():
    return str(NODE22) if NODE22.exists() else "node"


def wait_for_server(port, timeout=30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=2) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(0.5)
    return False


def main():
    port = 8091
    if "--port" in sys.argv:
        port = int(sys.argv[sys.argv.index("--port") + 1])
    spec = json.loads((HERE / "shots.json").read_text())
    limits = spec["limits"]

    server = subprocess.Popen(
        [node_bin(), "serve.ts", "--port", str(port)],
        cwd=HERE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        if not wait_for_server(port):
            print("server did not come up")
            return 1
        from PIL import Image
        from playwright.sync_api import sync_playwright

        errors = []
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            for shot in spec["shots"]:
                page = browser.new_page(viewport={"width": shot["w"], "height": shot["h"]})
                page_errors = []
                page.on("console", lambda m: page_errors.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e: page_errors.append(str(e)))
                url = f"http://127.0.0.1:{port}/index.html{shot['query']}"
                print(f"shot {shot['name']}: {url}")
                page.goto(url, wait_until="load")
                try:
                    page.wait_for_function("window.__shotReady === true", timeout=120000)
                except Exception:
                    print(f"  TIMEOUT waiting for __shotReady on {shot['name']}")
                    errors.append(shot["name"])
                    page.close()
                    continue
                out_png = Path(f"/tmp/shot-{shot['name']}.png")
                if shot["kind"] == "export":
                    page.locator("#preview").screenshot(path=str(out_png))
                else:
                    page.screenshot(path=str(out_png))
                page.close()
                if page_errors:
                    print(f"  CONSOLE ERRORS on {shot['name']}: {page_errors}")
                    errors.append(shot["name"])
                    continue
                img = Image.open(out_png).convert("RGB")
                long_side = max(img.size)
                scale = min(1.0, limits["long_side_max"] / long_side)
                if scale < 1.0:
                    img = img.resize(
                        (round(img.width * scale), round(img.height * scale)),
                        Image.LANCZOS,
                    )
                if min(img.size) < limits["short_side_min"]:
                    print(f"  {shot['name']}: short side {min(img.size)} below minimum")
                    errors.append(shot["name"])
                    continue
                dest = HERE / "screenshots" / shot["name"]
                quality = 88
                while True:
                    img.save(dest, "JPEG", quality=quality, optimize=True)
                    if dest.stat().st_size <= limits["max_bytes"] or quality <= 55:
                        break
                    quality -= 5
                size = dest.stat().st_size
                print(f"  saved {dest.name}: {img.size[0]}x{img.size[1]}, {size} bytes (q{quality})")
                if size > limits["max_bytes"]:
                    print(f"  OVERSIZE: {dest.name}")
                    errors.append(shot["name"])
            browser.close()
        if errors:
            print(f"FAILED shots: {errors}")
            return 1
        print("ALL SHOTS OK, 0 console errors")
        return 0
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    raise SystemExit(main())
