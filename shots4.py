#!/usr/bin/env python3
"""shots4.py — SUNSET PRESS screenshot driver (round 5, written fresh).

Serves app/ on localhost, drives it in headless Chromium (Playwright),
exports the 3 poster sizes at exact pixel dimensions, and captures the
4 screenshots from shots.json. Verifies every limit:
  - each screenshot <= 256 KiB, long side <= 1280 px, short side >= 480 px
  - each export at its exact pixel size (1080x1080 / 1080x1350 / 1920x1080)
  - zero console errors / page errors
Prints ALL SHOTS OK on success, else the failures. Exit code 0/1.

Usage: python3 shots4.py [--port 8123]
"""
import base64
import io
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
SHOTS = json.loads((HERE / "shots.json").read_text())
LIMITS = SHOTS["limits"]
EXPORT_SIZES = {k: tuple(v) for k, v in SHOTS["export_sizes"].items()}

# Screenshot output size per shot (long side <= 1280, short side >= 480).
SHOT_OUT = {
    "1-cover-wide": (1280, 720),
    "2-cover": (1080, 1080),
    "3-editor": (1280, 720),
    "4-cover-portrait": (1024, 1280),
}


def data_url_to_image(url):
    from PIL import Image
    assert url.startswith("data:image/jpeg;base64,")
    raw = base64.b64decode(url.split(",", 1)[1])
    return Image.open(io.BytesIO(raw))


def save_jpeg(img, path, quality=88):
    """Save as JPEG within the byte cap, lowering quality if needed."""
    from PIL import Image
    q = quality
    while q >= 55:
        buf = io.BytesIO()
        img.convert("RGB").save(buf, "JPEG", quality=q, optimize=True)
        if len(buf.getvalue()) <= LIMITS["max_bytes"]:
            Path(path).write_bytes(buf.getvalue())
            return len(buf.getvalue()), q
        q -= 6
    # Last resort: shrink a little and retry once at 55.
    small = img.resize((int(img.width * 0.9), int(img.height * 0.9)), Image.LANCZOS)
    buf = io.BytesIO()
    small.convert("RGB").save(buf, "JPEG", quality=55, optimize=True)
    Path(path).write_bytes(buf.getvalue())
    return len(buf.getvalue()), 55


def main():
    port = 8123
    if "--port" in sys.argv:
        port = int(sys.argv[sys.argv.index("--port") + 1])
    from playwright.sync_api import sync_playwright

    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--directory", str(HERE / "app")],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    errors = []
    try:
        # Wait for the server.
        for _ in range(50):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{port}/index.html", timeout=1)
                break
            except Exception:
                time.sleep(0.1)
        else:
            print("FAIL: local server did not come up")
            return 1

        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            console_errors = []
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: console_errors.append(str(e)))

            # --- verify the 3 export sizes are exact ----------------------
            page.goto(f"http://127.0.0.1:{port}/index.html?hero=samples/hero-real.jpg&size=square")
            page.wait_for_function("window.SunsetPress && window.SunsetPress.ready", timeout=30000)
            page.wait_for_function(
                "window.SunsetPress.ready.then ? true : false", timeout=5000
            )
            # wait for the ready promise to settle
            page.evaluate("window.SunsetPress.ready.catch(()=>{})")
            page.wait_for_timeout(1500)
            for key, (ew, eh) in EXPORT_SIZES.items():
                url = page.evaluate(f"window.SunsetPress.exportDataURL('{key}', 0.92)")
                img = data_url_to_image(url)
                ok = img.size == (ew, eh)
                print(f"export {key}: {img.size} expected {(ew, eh)} {'OK' if ok else 'FAIL'}")
                if not ok:
                    errors.append(f"export {key} size {img.size} != {(ew, eh)}")

            # --- capture the 4 screenshots --------------------------------
            outdir = HERE / "screenshots"
            outdir.mkdir(exist_ok=True)
            for shot in SHOTS["shots"]:
                name, kind, size = shot["name"], shot["kind"], shot["size"]
                hero = shot["hero"]
                page.goto(
                    f"http://127.0.0.1:{port}/index.html?hero={hero}&size={size}"
                )
                page.wait_for_function("window.SunsetPress && window.SunsetPress.ready", timeout=30000)
                page.evaluate("window.SunsetPress.ready.catch(()=>{})")
                page.wait_for_timeout(1500)
                target = SHOT_OUT[name]
                if kind == "cover":
                    url = page.evaluate(f"window.SunsetPress.exportDataURL('{size}', 0.92)")
                    img = data_url_to_image(url)
                    img = img.resize(target, __import__("PIL.Image", fromlist=["LANCZOS"]).LANCZOS)
                    path = outdir / f"{name}.jpg"
                    nbytes, q = save_jpeg(img, path)
                    print(f"{name}: {img.size} {nbytes} bytes q={q}")
                else:  # editor: viewport screenshot of the app UI
                    page.set_viewport_size({"width": 1280, "height": 720})
                    page.wait_for_timeout(800)
                    path = outdir / f"{name}.jpg"
                    page.screenshot(path=str(path), type="jpeg", quality=88)
                    from PIL import Image
                    img = Image.open(path)
                    nbytes = path.stat().st_size
                    print(f"{name}: {img.size} {nbytes} bytes (viewport shot)")
                # verify limits
                from PIL import Image
                im = Image.open(path)
                long_side = max(im.size)
                short_side = min(im.size)
                nbytes = path.stat().st_size
                if nbytes > LIMITS["max_bytes"]:
                    errors.append(f"{name}: {nbytes} bytes > {LIMITS['max_bytes']}")
                if long_side > LIMITS["long_max"]:
                    errors.append(f"{name}: long side {long_side} > {LIMITS['long_max']}")
                if short_side < LIMITS["short_min"]:
                    errors.append(f"{name}: short side {short_side} < {LIMITS['short_min']}")

            if console_errors:
                print("CONSOLE ERRORS:")
                for e in console_errors[:10]:
                    print("  ", e)
                errors.append(f"{len(console_errors)} console/page errors")

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
            print(" -", e)
        return 1
    print("ALL SHOTS OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
