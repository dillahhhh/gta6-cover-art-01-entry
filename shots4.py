#!/usr/bin/env python3
"""SUNSET PRESS screenshot runner (round 4 rebuild).

Serves app/ with the repo's own serve.ts, opens each shots.json scene in headless
Chromium, waits for the app to flag window.__shotReady, and saves a JPEG.
Then it verifies the gate's screenshot limits and the app's three PNG exports.
Usage: python3 shots4.py [--port 8901] [--skip-exports]
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

REPO = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(REPO, "shots.json")
OUT = os.path.join(REPO, "screenshots")
PORT = 8901

MAX_BYTES = 262144
MAX_LONG = 1280
MIN_SHORT = 480
EXPORT_SIZES = [(1080, 1080), (1080, 1350), (1920, 1080)]


def wait_for_server(port, timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=2) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(0.3)
    return False


def check_shot(path, expect_w, expect_h):
    from PIL import Image
    problems = []
    size = os.path.getsize(path)
    if size > MAX_BYTES:
        problems.append(f"{size} bytes > {MAX_BYTES} cap")
    with Image.open(path) as im:
        w, h = im.size
        if max(w, h) > MAX_LONG:
            problems.append(f"long side {max(w, h)} > {MAX_LONG}")
        if min(w, h) < MIN_SHORT:
            problems.append(f"short side {min(w, h)} < {MIN_SHORT}")
        if (w, h) != (expect_w, expect_h):
            problems.append(f"size {w}x{h}, expected {expect_w}x{expect_h}")
    return problems


def main():
    skip_exports = "--skip-exports" in sys.argv
    port = PORT
    if "--port" in sys.argv:
        port = int(sys.argv[sys.argv.index("--port") + 1])

    with open(SHOTS, encoding="utf-8") as f:
        shots = json.load(f)
    os.makedirs(OUT, exist_ok=True)

    server = subprocess.Popen(
        ["node", "serve.ts", "--port", str(port)],
        cwd=REPO, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    errors = []
    try:
        if not wait_for_server(port):
            print("FATAL: serve.ts did not come up")
            return 1
        from playwright.sync_api import sync_playwright

        with sync_playwright() as pw:
            browser = pw.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            console_errors = []
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: console_errors.append(str(e)))

            for shot in shots:
                name = shot["name"]
                url = f"http://127.0.0.1:{port}/{shot['query']}"
                page.set_viewport_size({"width": shot["w"], "height": shot["h"]})
                page.goto(url, wait_until="load")
                try:
                    page.wait_for_function("window.__shotReady === true", timeout=90000)
                except Exception:
                    errors.append(f"{name}: __shotReady never fired")
                    continue
                page.wait_for_timeout(400)
                path = os.path.join(OUT, name)
                page.screenshot(path=path, type="jpeg", quality=85)
                problems = check_shot(path, shot["w"], shot["h"])
                if problems:
                    errors.append(f"{name}: " + "; ".join(problems))
                else:
                    print(f"OK {name} ({os.path.getsize(path)} bytes)")
                if console_errors:
                    errors.append(f"{name}: console errors: {console_errors[:3]}")
                    console_errors = []

            if not skip_exports:
                # Verify the app's own single-size Export PNG at each exact size
                # (one download per click; three parallel expect_downloads all
                # catch the same first download, so they are done sequentially).
                page.set_viewport_size({"width": 1280, "height": 900})
                page.goto(f"http://127.0.0.1:{port}/", wait_until="load")
                page.wait_for_function("window.__shotReady === true", timeout=90000)
                got = set()
                for name, size in [("square", (1080, 1080)), ("portrait", (1080, 1350)), ("wide", (1920, 1080))]:
                    page.select_option("#exportSize", name)
                    with page.expect_download() as dl_info:
                        page.click("#exportOneBtn")
                    dl = dl_info.value
                    tmp = os.path.join("/tmp", "sp-export-" + dl.suggested_filename)
                    dl.save_as(tmp)
                    from PIL import Image
                    with Image.open(tmp) as im:
                        got.add(im.size)
                    print(f"OK export {dl.suggested_filename} {os.path.getsize(tmp)} bytes")
                missing = [s for s in EXPORT_SIZES if s not in got]
                if missing:
                    errors.append(f"exports missing exact sizes: {missing} (got {sorted(got)})")
            browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except Exception:
            server.kill()

    if errors:
        print("FAILURES:")
        for e in errors:
            print(" - " + e)
        return 1
    print("ALL SHOTS OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
