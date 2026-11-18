#!/usr/bin/env python3
"""Download model details from scalemodelstore.com (no product feed, so each model page is read once).

Polite and resumable: two requests at a time with a pause between them, results appended to
.cache/catalog-raw/sms/pages.jsonl. Re-running skips pages already saved. Takes roughly an hour.
"""
import html
import json
import os
import re
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, ".cache", "catalog-raw", "sms")
OUT = os.path.join(DEST, "pages.jsonl")
UA = "Mozilla/5.0 (compatible; catalog-builder/1.0)"
lock = threading.Lock()


def fetch(url):
    # Airline names with accents appear in the addresses, so they must be percent-encoded.
    req = urllib.request.Request(urllib.parse.quote(url, safe=":/?&=%"), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def extract(url, page):
    ld = re.search(r'<script type="application/ld\+json">(.*?)</script>', page, flags=re.S)
    rec = {"url": url}
    if ld:
        block = ld.group(1)
        for key in ("name", "mpn", "gtin", "image"):
            m = re.search(r'"%s":\s*"([^"]*)"' % key, block)
            rec[key] = html.unescape(m.group(1)) if m else None
        m = re.search(r'"brand":\s*\{[^}]*"name":\s*"([^"]*)"', block, flags=re.S)
        rec["brand"] = html.unescape(m.group(1)) if m else None
        m = re.search(r'"price":\s*"([\d.]+)",\s*"priceCurrency":\s*"EUR"', block)
        rec["eur"] = float(m.group(1)) if m else None
        rec["inStock"] = "schema.org/InStock" in block
    t = re.search(r"<title>([^<]*)", page)
    rec["title"] = html.unescape(t.group(1)) if t else None
    body = re.sub(r"<script.*?</script>|<style.*?</style>", "", page, flags=re.S)
    text = html.unescape(re.sub(r"(\|\s*)+", "|", re.sub(r"<[^>]+>", "|", body)))
    k = text.find("Click on image to enlarge")
    rec["detail"] = re.sub(r"\s+", " ", text[k:k + 900]) if k >= 0 else None
    crumbs = re.search(r"\|(Airliners|Military|[A-Z][A-Za-z ]+)\| > \|([^|]+)\| > \|([^|]+)\| > \|", text)
    rec["crumbs"] = [crumbs.group(i) for i in (1, 2, 3)] if crumbs else None
    rec["images"] = list(dict.fromkeys(re.findall(r"/content/shop/images/original/\d+\.jpg", page)))[:4]
    return rec


def work(url):
    for attempt in range(3):
        try:
            rec = extract(url, fetch(url))
            break
        except Exception as e:  # noqa: BLE001
            rec = {"url": url, "error": str(e)}
            time.sleep(5 * (attempt + 1))
    with lock, open(OUT, "a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    time.sleep(0.8)


def main():
    os.makedirs(DEST, exist_ok=True)
    sitemap = fetch("https://www.scalemodelstore.com/sitemap.xml")
    urls = [u for u in re.findall(r"<loc>([^<]+)</loc>", sitemap) if "/model/" in u]
    done = set()
    if os.path.exists(OUT):
        done = {json.loads(line)["url"] for line in open(OUT) if '"error"' not in line}
    todo = [u for u in urls if u not in done]
    print(f"{len(urls)} model pages, {len(todo)} to fetch", flush=True)
    with ThreadPoolExecutor(2) as ex:
        for i, _ in enumerate(ex.map(work, todo)):
            if i % 250 == 0:
                print(f"  {i}/{len(todo)}", flush=True)
    print("done")


if __name__ == "__main__":
    main()
