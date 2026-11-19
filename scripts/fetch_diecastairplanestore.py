#!/usr/bin/env python3
"""Download current listings from diecastairplanestore.com, brand by brand.

The site's robots.txt asks AI agents for a 10-second pause between requests, so this reads the brand
listing pages (100 products each) rather than every product page, one request at a time. Results go to
.cache/catalog-raw/das/cards.jsonl. Takes roughly 15-25 minutes.
"""
import html
import json
import os
import re
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, ".cache", "catalog-raw", "das")
BASE = "https://diecastairplanestore.com"
UA = "Mozilla/5.0 (compatible; catalog-builder/1.0)"
PAUSE = 10


def fetch(url):
    req = urllib.request.Request(urllib.parse.quote(url, safe=":/?&=%"), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def cards(page, brand):
    out = []
    for c in re.findall(r'<article[^>]*class="[^"]*card[^"]*".*?</article>', page, flags=re.S):
        link = re.search(r'<a href="([^"]+)" class="card-figure__link" aria-label="([^"]*)"', c)
        img = re.search(r'data-src="([^"]+)"[^>]*alt="([^"]*)"', c)
        if not link:
            continue
        label = html.unescape(link.group(2))
        price = re.search(r"(?:Now|Price)?:?\s*\$([\d,]+\.\d\d)\s*$", label.strip()) or re.search(r"\$([\d,]+\.\d\d)", c)
        out.append({"brand": brand, "url": html.unescape(link.group(1)), "title": re.sub(r",\s*(Was:.*|\$[\d,.]+.*)$", "", label).strip(),
                    "alt": html.unescape(img.group(2)) if img else None, "image": img.group(1) if img else None,
                    "usd": float(price.group(1).replace(",", "")) if price else None,
                    "preorder": "Pre-Order" in c, "soldOut": "Out of stock" in c or "Sold Out" in c})
    return out


def main():
    os.makedirs(DEST, exist_ok=True)
    out_path = os.path.join(DEST, "cards.jsonl")
    brands = re.findall(r"<loc>([^<]+)</loc>", fetch(f"{BASE}/xmlsitemap.php?type=brands&page=1"))
    print(len(brands), "brands", flush=True)
    with open(out_path, "w") as f:
        for b in brands:
            page = 1
            while page <= 40:
                time.sleep(PAUSE)
                try:
                    text = fetch(f"{b}{'&' if '?' in b else '?'}limit=100&page={page}")
                except Exception as e:  # noqa: BLE001
                    print("  failed", b, page, e, flush=True)
                    break
                name = re.search(r"<h1[^>]*>\s*([^<]+?)\s*</h1>", text)
                found = cards(text, html.unescape(name.group(1)) if name else b)
                for c in found:
                    f.write(json.dumps(c, ensure_ascii=False) + "\n")
                f.flush()
                print(f"  {name.group(1) if name else b} page {page}: {len(found)}", flush=True)
                if len(found) < 100:
                    break
                page += 1
    print("done")


if __name__ == "__main__":
    main()
