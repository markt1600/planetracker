#!/usr/bin/env python3
"""Slowly read diecastairplanestore.com's older product pages (mostly sold-out models).

Only commercial die-cast aircraft are read: pages for 1:400, 1:200 and 1:500 models, skipping military
subjects, plastic lines, toys and accessories, and anything the brand listings already covered. The site
asks AI agents to wait 10 seconds between requests, so about 5,800 pages take roughly 18 hours.

Resumable: results are appended to .cache/catalog-raw/das/archive.jsonl and pages already there are
skipped, so it can be stopped and started again. An existing checkpoint (data/sources/das-archive.jsonl)
is used as the starting point if the cache is empty.
"""
import html
import json
import os
import re
import shutil
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, ".cache", "catalog-raw", "das")
OUT = os.path.join(DEST, "archive.jsonl")
CHECKPOINT = os.path.join(ROOT, "data", "sources", "das-archive.jsonl")
BASE = "https://diecastairplanestore.com"
UA = "Mozilla/5.0 (compatible; catalog-builder/1.0)"
PAUSE = 10

MILITARY = re.compile(
    r"hobby-master|air-force|usaf|u-s-navy|us-navy|-navy-|army|marine|luftwaffe|-raf-|squadron|fighter|bomber|f-1[4-8]|f-22|f-35|"
    r"f-4-|f-5|mig-|su-\d|b-52|b-1b|b-2-|c-130|c-17|c-5|kc-|e-3|p-8|a-10|ah-64|uh-|ch-47|helicopter|tank|legion|panzer|warbird|"
    r"spitfire|mustang|corsair|zero|bf-109|fw-190|ww2|wwii|vietnam|blue-angels|thunderbirds")
NOT_A_MODEL = re.compile(
    r"skymarks|plastic|snap|executive-series|exec-ser|runway-?24|realtoy|toy|playset|play-?mat|stand|gse|airport|terminal|hangar|"
    r"key-?chain|tug|bus|vehicle|truck|decal|book|magazine|gift|mug|shirt|puzzle|plush|flight-miniatures|wooster|pull-?back|"
    r"single-plane|lego|daron|postage-stamp|tower-set")


def fetch(url):
    req = urllib.request.Request(urllib.parse.quote(url, safe=":/?&=%"), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def wanted(url, known):
    m = re.search(r"(?:scale-)?1-(\d{2,3})(?:-[a-z0-9-]*)?/$", url)
    return bool(m) and m.group(1) in ("400", "200", "500") and url not in known and not MILITARY.search(url) and not NOT_A_MODEL.search(url)


def extract(url, page):
    rec = {"url": url}
    block = next((b for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', page, flags=re.S) if '"Product"' in b), None)
    if not block:
        return {"url": url, "error": "no product data"}
    try:
        data = json.loads(block, strict=False)
    except ValueError:
        return {"url": url, "error": "unreadable product data"}
    offer = data.get("offers") or {}
    rec.update(name=html.unescape(data.get("name") or ""), sku=data.get("sku"), brand=(data.get("brand") or {}).get("name"),
               description=data.get("description"), image=data.get("image"), usd=float(offer["price"]) if offer.get("price") else None,
               inStock="InStock" in (offer.get("availability") or ""))
    return rec


def main():
    os.makedirs(DEST, exist_ok=True)
    if not os.path.exists(OUT) and os.path.exists(CHECKPOINT):
        shutil.copy(CHECKPOINT, OUT)
    known = {json.loads(line)["url"] for line in open(os.path.join(DEST, "cards.jsonl"))} if os.path.exists(os.path.join(DEST, "cards.jsonl")) else set()
    done = {json.loads(line)["url"] for line in open(OUT)} if os.path.exists(OUT) else set()
    urls = []
    for page in (1, 2, 3, 4):
        time.sleep(PAUSE)
        found = re.findall(r"<loc>([^<]+)</loc>", fetch(f"{BASE}/xmlsitemap.php?type=products&page={page}"))
        if not found:
            break
        urls += found
    todo = [u for u in urls if wanted(u, known) and u not in done]
    print(f"{len(urls)} product pages listed, {len(done)} already read, {len(todo)} to read (about {len(todo) * 11 / 3600:.1f} hours)", flush=True)
    for i, url in enumerate(todo):
        time.sleep(PAUSE)
        try:
            rec = extract(url, fetch(url))
        except Exception as e:  # noqa: BLE001
            rec = {"url": url, "error": str(e)[:200]}
            time.sleep(30)  # back off a little if the site is unhappy
        with open(OUT, "a") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        if i % 100 == 0:
            print(f"  {i}/{len(todo)}", flush=True)
    print("done", flush=True)


if __name__ == "__main__":
    main()
