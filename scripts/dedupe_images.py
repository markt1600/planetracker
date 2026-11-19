#!/usr/bin/env python3
"""Find photos of the same model that are really the same picture.

Retailers often reuse the manufacturer's own photo, so a model listed by three shops can end up with the
same image three times at slightly different sizes. This compares each model's stored photos by a
perceptual fingerprint and records the repeats in data/duplicate-photos.json; build_catalog.py then
leaves them out and fetch_images.py does not download them again. Run after fetch_images.py.
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS = os.path.join(ROOT, "public", "catalog")
LIST = os.path.join(ROOT, "data", "duplicate-photos.json")
SIZE = 16  # 16x16 comparisons -> 256-bit fingerprint
LIMIT = 38  # bits that may differ (about 15%) for two files to count as the same picture; checked by eye:
# pairs up to this distance were all the same photo, above it some were different angles


def fingerprint(path):
    """Difference hash: which of each pair of neighbouring pixels is brighter, on a tiny grey copy."""
    im = Image.open(path).convert("L").resize((SIZE + 1, SIZE), Image.LANCZOS)
    px = list(im.tobytes())
    bits = 0
    for row in range(SIZE):
        for col in range(SIZE):
            bits = (bits << 1) | (px[row * (SIZE + 1) + col] > px[row * (SIZE + 1) + col + 1])
    return bits


def distance(a, b):
    return bin(a ^ b).count("1")


def main():
    catalog = json.load(open(os.path.join(ROOT, "data", "catalog.json")))
    known = set(json.load(open(LIST))) if os.path.exists(LIST) else set()
    report = "--report" in sys.argv
    found, gaps = [], []
    for r in catalog:
        files = [u.split("/")[-1][:-5] for u in [r.get("image")] + (r.get("gallery") or []) if u and u.startswith("/catalog/")]
        if len(files) < 2:
            continue
        kept = []
        for stem in files:
            path = os.path.join(PHOTOS, stem + ".webp")
            if not os.path.exists(path):
                continue
            fp = fingerprint(path)
            near = min((distance(fp, k) for k in kept), default=999)
            gaps.append(near)
            if near <= LIMIT and kept:
                found.append(stem)  # the first copy (the main photo comes first) is the one kept
            else:
                kept.append(fp)
    if report:
        hist = {}
        for g in gaps:
            if g != 999: hist[g // 8 * 8] = hist.get(g // 8 * 8, 0) + 1
        print("closest-match distance histogram:", sorted(hist.items()))
    print(f"{len(found)} repeated photos found")
    if "--dry-run" not in sys.argv and not report:
        for stem in found:
            os.remove(os.path.join(PHOTOS, stem + ".webp"))
        json.dump(sorted(known | set(found)), open(LIST, "w"), indent=0)


if __name__ == "__main__":
    main()
