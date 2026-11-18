#!/usr/bin/env python3
"""Download catalogue photos and store them, resized, in public/catalog/<id>.webp.

Run after build_catalog.py, then run build_catalog.py again so records point at the local copies.
Already-downloaded photos are skipped, so it is safe to re-run.
"""
import io
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, "public", "catalog")
UA = "Mozilla/5.0 (compatible; catalog-builder/1.0)"
MAX_W, QUALITY = 720, 72


def grab(rec):
    out = os.path.join(DEST, rec["id"] + ".webp")
    url = rec.get("remoteImage")
    if not url or os.path.exists(out):
        return "skip"
    slow = "airplanemodelsg.com" in url
    for attempt in range(3):
        try:
            req = urllib.request.Request(urllib.parse.quote(url, safe=":/?&=%"), headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            im = Image.open(io.BytesIO(data))
            im = im.convert("RGB") if im.mode != "RGB" else im
            if im.width > MAX_W:
                im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
            im.save(out, "WEBP", quality=QUALITY, method=5)
            if slow:
                time.sleep(0.4)
            return "ok"
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(3 * (attempt + 1))
    print("  failed", rec["id"], err, flush=True)
    return "fail"


def main():
    os.makedirs(DEST, exist_ok=True)
    recs = json.load(open(os.path.join(ROOT, "data", "catalog.json")))
    slow = [r for r in recs if "airplanemodelsg.com" in (r.get("remoteImage") or "")]
    fast = [r for r in recs if r not in slow]
    counts = {}
    for group, workers in ((fast, 6), (slow, 2)):
        with ThreadPoolExecutor(workers) as ex:
            for i, res in enumerate(ex.map(grab, group)):
                counts[res] = counts.get(res, 0) + 1
                if i % 200 == 0:
                    print(f"  {i}/{len(group)} {counts}", flush=True)
    print("done", counts)


if __name__ == "__main__":
    sys.exit(main())
