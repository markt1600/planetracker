#!/usr/bin/env python3
"""Build data/catalog.json — the die-cast model catalogue used by the app.

Sources (all public storefront product feeds):
  amsg  airplanemodelsg.com       WooCommerce Store API   prices in SGD (preferred price source)
  ard   aviationretaildirect.com  Shopify products.json   prices in GBP
  tas   airplaneshop.com          Shopify products.json   prices in USD
  wcd   westcoastdiecast.ca       Shopify products.json   prices in CAD

Usage:
  python3 scripts/build_catalog.py           # rebuild from .cache/catalog-raw
  python3 scripts/build_catalog.py --fetch   # re-download the feeds first (polite, ~5 min)
  python3 scripts/fetch_images.py            # then store photos locally and re-run this script
"""
import glob
import html
import json
import os
import re
import sys
import time
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, ".cache", "catalog-raw")
OUT = os.path.join(ROOT, "data")
UA = "Mozilla/5.0 (compatible; catalog-builder/1.0)"

BRANDS = [
    "GeminiJets", "JC Wings", "NG Models", "Aviation 400",
    "InFlight200", "Herpa Wings", "Phoenix Models", "AeroClassics",
    # Further manufacturers carried by the source retailers.
    "Panda Models", "SQ Wings", "HX Wings", "Aero Polaris", "C Models", "Big Bird", "V1 Models",
    "YU Model", "Patriot Models", "HYJL Wings", "Dragon Wings", "Apollo",
]
MORE_BRANDS = (("panda", "Panda Models"), ("sq wings", "SQ Wings"), ("hx ", "HX Wings"), ("aeropolaris", "Aero Polaris"),
               ("aero polaris", "Aero Polaris"), ("^c model", "C Models"), ("big bird", "Big Bird"), ("v1 models", "V1 Models"),
               ("v1:400", "V1 Models"), ("yu model", "YU Model"), ("yu400", "YU Model"), ("patriot", "Patriot Models"),
               ("hyjl", "HYJL Wings"), ("dragon wings", "Dragon Wings"), ("apollo", "Apollo"))
DEFAULT_SCALE = {"Aviation 400": "1:400", "InFlight200": "1:200", "AeroClassics": "1:400",
                 "NG Models": "1:400", "Phoenix Models": "1:400"}

ARD_COLLECTIONS = ["jc-wings", "herpa-wings", "phoenix", "inflight200", "gemini-jets-1-400",
                   "geminijets", "gemini200-1", "ng-models-1", "ng-models", "aero-classics",
                   "aero-classics-200", "aviation-400", "gemini-military", "jc-wings-military-1",
                   "inflight200-military", "herpa-military"]


# ---------------------------------------------------------------- fetching
def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            print("  retry", url, e)
            time.sleep(8 * (i + 1))


def save(sub, name, data):
    d = os.path.join(RAW, sub)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, name), "w") as f:
        json.dump(data, f)


def fetch_shopify(sub, base, prefix):
    page = 1
    while page <= 80:
        products = get(f"{base}/products.json?limit=250&page={page}").get("products", [])
        save(sub, f"{prefix}.{page}.json", {"products": products})
        print(f"  {sub} {prefix} page {page}: {len(products)}")
        if len(products) < 250:
            break
        page += 1
        time.sleep(1.2)


def fetch_all():
    for sub in ("amsg", "ard", "tas", "wcd"):
        for f in glob.glob(os.path.join(RAW, sub, "*.json")):
            os.remove(f)
    page = 1
    while True:
        items = get(f"https://www.airplanemodelsg.com/wp-json/wc/store/v1/products?per_page=100&page={page}")
        save("amsg", f"p{page}.json", items)
        print(f"  amsg page {page}: {len(items)}")
        if len(items) < 100:
            break
        page += 1
        time.sleep(0.6)
    fetch_shopify("ard", "https://www.aviationretaildirect.com", "all")
    for c in ARD_COLLECTIONS:
        fetch_shopify("ard", f"https://www.aviationretaildirect.com/collections/{c}", f"col.{c}")
    fetch_shopify("tas", "https://www.airplaneshop.com", "all")
    fetch_shopify("wcd", "https://westcoastdiecast.ca", "all")


# ---------------------------------------------------------------- parsing
B7 = r"(?:Boeing\s+|BOEING\s+|B-?)?7{n}7(?![0-9])(?:[- ]?MAX[- ]?\d{{0,2}}|-?\d[A-Z0-9]{{0,5}}(?:adv|Adv|ADV)?(?:[- ]?(?:MAX|Max|max))?)?(?:\([A-Z]+\))?(?:ER|LR|SF|BCF|BDSF|WL|[FWXM])*"
FAMILIES = [
    ("Boeing 707", B7.format(n=0) + r"|C-137[A-C]?|VC-137[A-C]?"),
    ("Boeing 717", B7.format(n=1)),
    ("Boeing 727", B7.format(n=2)),
    ("Boeing 737", B7.format(n=3) + r"|P-8[AI]?(?![0-9])"),
    ("Boeing 747", r"(?:Boeing\s+|BOEING\s+|B-?)?747(?![0-9])(?:SP|SR|-?8[FI]?(?![0-9])|-?\d[A-Z0-9]{0,5})?(?:\([A-Z]+\))?(?:ER|SF|BCF|BDSF|LCF|[FMD])*|VC-25[AB]?"),
    ("Boeing 757", B7.format(n=5) + r"|C-32[AB]?(?![0-9])"),
    ("Boeing 767", B7.format(n=6) + r"|KC-46[A]?|KC-767[A-Z]?"),
    ("Boeing 777", B7.format(n=7)),
    ("Boeing 787", B7.format(n=8)),
    ("Airbus A220", r"(?:Airbus\s+|AIRBUS\s+)?A220(?:-?[13]00)?|CS[13]00"),
    ("Airbus A300", r"(?:Airbus\s+|AIRBUS\s+)?A300(?:-?B\d(?:-\d{1,3})?|-?\d{3}[A-Z]{0,2}|B)?(?:ST|F)?"),
    ("Airbus A310", r"(?:Airbus\s+|AIRBUS\s+)?A310(?:-?\d{3}[A-Z]{0,2})?(?:MRTT|F)?"),
    ("Airbus A320 family", r"(?:Airbus\s+|AIRBUS\s+)?A3(?:18|19|20|21)(?:-?\d{3}[A-Z]{0,2})?(?:[- ]?(?:neo|NEO|ceo|CEO|XLR|LR))?(?:P2F)?"),
    ("Airbus A330", r"(?:Airbus\s+|AIRBUS\s+)?A330(?:-?\d{3,4}[A-Z]{0,2})?(?:[- ]?(?:neo|NEO))?(?:MRTT|P2F|F)?|KC-30A?|A332|A333|A339"),
    ("Airbus A340", r"(?:Airbus\s+|AIRBUS\s+)?A340(?:-?\d{3}[A-Z]{0,2})?"),
    ("Airbus A350", r"(?:Airbus\s+|AIRBUS\s+)?A350(?:-?\d{3,4}[A-Z]{0,3})?(?:F)?"),
    ("Airbus A380", r"(?:Airbus\s+|AIRBUS\s+)?A380(?:-?\d{3}[A-Z]{0,2})?"),
    ("McDonnell Douglas MD-11", r"MD-?11(?:F|ER|CF|BCF)?"),
    ("McDonnell Douglas MD-80/90", r"MD[- ‑]?(?:8[0-8]|9[05])(?:-\d{2})?"),
    ("Douglas DC-3", r"DC-?3(?![0-9])|C-47[A-D]?"),
    ("Douglas DC-8", r"DC-?8(?![0-9])(?:-\d{2}[A-Z]{0,2})?"),
    ("Douglas DC-9", r"DC-?9(?![0-9])(?:-\d{2}[A-Z]{0,2})?"),
    ("McDonnell Douglas DC-10", r"DC-?10(?:-\d{2}[A-Z]{0,2})?|KC-10A?"),
    ("Lockheed L-1011 TriStar", r"L-?1011(?:-\d{1,3})?(?:\s?Tri[Ss]tar)?"),
    ("Concorde", r"Concorde|CONCORDE"),
    ("Embraer E-Jet", r"(?:Embraer\s+|EMBRAER\s+)?(?:ERJ-?|EMB-?|E-?)1[79][05](?:-?E2|-\d{3,4}[A-Z]{0,3}|[A-Z]{2})?(?![0-9])|(?:Embraer|EMBRAER)\s+1[79][05](?:-\d{3,4}[A-Z]{0,3})?|E-?Jet"),
    ("Embraer ERJ", r"(?:Embraer\s+)?(?:ERJ-?|EMB-?)1[34][05][A-Z]{0,2}"),
    ("Bombardier CRJ", r"CRJ-?\d{3,4}[A-Z]{0,2}|CRJ"),
    ("ATR 42/72", r"ATR[- ]?[47]2(?:-\d{3})?[A-Z]?"),
    ("De Havilland Dash 8", r"(?:DHC-?8-?|Dash[- ]?8[- ]?)Q?\d{3}|Q400|DHC-8"),
    ("Comac C919", r"C919(?:-\d{3})?"),
    ("Comac ARJ21", r"ARJ-?21(?:-\d{3})?|C909"),
    ("Lockheed C-130 Hercules", r"[A-Z]{0,2}C-130[A-Z]{0,2}(?:-30)?|L-100(?:-30)?"),
    ("Boeing C-17 Globemaster", r"C-17A?"),
    ("Boeing KC-135", r"[KR]C-135[A-Z]?|E-3[A-G]?(?![0-9])|E-6B?"),
    ("Lockheed C-5 Galaxy", r"C-5[ABM]?(?![0-9])"),
    ("Tupolev", r"T[Uu]-?1[0-9]{2}[A-Z]?|T[Uu]-?[29]\d{2}[A-Z]?"),
    ("Ilyushin", r"I[Ll]{1,2}yushin\s+I[Ll]-?\d{2,3}[A-Z]{0,2}|I[Ll]-?\d{2,3}[A-Z]{0,2}"),
    ("Antonov", r"A[Nn]-?(?:12|22|24|26|72|74|124|148|158|225)(?:-\d{3})?"),
    ("Fokker", r"Fokker\s+F?-?\d{2,3}|F-?(?:27|28|50|70|100)(?![0-9])"),
    ("BAe 146 / Avro RJ", r"BAe[- ]?146(?:-\d{3})?|Avro\s+RJ-?\d{2,3}|RJ-?(?:70|85|100)"),
    ("Lockheed Constellation", r"L-?1049[A-Z]?|L-?749A?|L-?1649A?|Constellation"),
    ("Lockheed Electra", r"L-?188[A-Z]?"),
    ("Vickers VC10", r"VC-?10"),
    ("Sukhoi Superjet", r"SSJ-?100|Superjet\s?100"),
]
FAM_RE = [(fam, re.compile(r"(?<![A-Za-z0-9])(?:" + rx + r")(?![a-z0-9])")) for fam, rx in FAMILIES]

REG_RE = re.compile(
    r"(?<![A-Za-z0-9-])(?:N\d{1,5}[A-Z]{0,2}|JA-?\d{2,4}[A-Z]{0,2}|HL\d{4}|B-\d{3,5}[A-Z]{0,2}|RA-\d{5}|CCCP-\d{4,5}"
    r"|(?:[A-Z]{2}|[A-Z]\d|\d[A-Z]|[A-Z])-[A-Z][A-Z0-9]{2,4}|\d{2}-\d{4,5})(?![A-Za-z0-9-])")
NOT_REG = re.compile(r"^(?:MD|DC|KC|IL|TU|AN|SU|RC|EA|FA|CH|AH|UH|SR|YF|XB|EC|MC|AC|HC|WC|VC|ATR|CRJ|ERJ|EMB|DHC|E|F|C|P|A|L)-\d|^B-\d{1,2}$", re.I)
ACCESSORY_RE = re.compile(
    r"\b(stands?\b(?! included)|display case|airport (?:passenger )?bus|buses|GSE|ground (?:service|support)|air ?bridge|jet ?bridge|hangar|terminal|"
    r"key ?(?:chain|ring|tag)|tugs?|pushback|tractor|cargo (?:cart|container|set)|stair|foil|mat\b|runway|playset|pullback|"
    r"aircraft parking|fire station|tow ?bar|landing gear set|gears? set|engine set|catalog(?:ue)?|book|magazine|sticker|decal|puzzle|plush|"
    r"t-shirt|mug\b|luggage|airport (?:set|accessor)|accessor|snap[- ]?fit|blind box)", re.I)
QUOTE_RE = re.compile(r"[“\"‘']{1,2}\s?([^”\"’']{3,90}?)\s?[”\"’″']{1,2}")


def clean(s):
    s = html.unescape(s or "")
    s = s.replace("‑", "-").replace("–", "-").replace("—", "-").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


def strip_html(s):
    return clean(re.sub(r"<[^>]+>", " ", s or ""))


def find_type(text):
    best = None
    for fam, rx in FAM_RE:
        m = rx.search(text)
        if m and (best is None or m.start() < best[1].start()
                  or (m.start() == best[1].start() and len(m.group(0)) > len(best[1].group(0)))):
            best = (fam, m)
    return best


def find_reg(text):
    regs = [m for m in REG_RE.finditer(text) if not NOT_REG.match(m.group(0))]
    return regs[-1] if regs else None


def tidy_type(t):
    t = re.sub(r"^(BOEING|Boeing)\s+", "", t)
    t = re.sub(r"^(AIRBUS|Airbus)\s+", "", t)
    t = re.sub(r"^B-?(?=7\d7)", "", t)
    return t.strip()


def tidy_airline(a):
    a = QUOTE_RE.sub(" ", a)
    a = re.sub(r"\([^)]*\)?", " ", a)
    a = re.sub(r"[一-鿿぀-ヿ가-힯]+", " ", a)
    a = re.sub(r"\b(Reg(?:istration)?[:#.]?|REG#|With Stand|with stand|Polished|Flaps? Down|Dreamliner|Interactive Series|NEW MOULD|New Mould|w/ ?Winglets|"
               r"Winglets|W/GEAR|w/ ?gear|Limited Edition|Sharklets|Scimitars?|Ultimate Collection|ULTIMATE|Ultimate|With Antenna|Misc|COMAC|McDonnell Douglas|Lockheed|Bombardier)\b", " ", a, flags=re.I)
    a = re.sub(r"\s+", " ", a).strip(" -|,;:#/.·’'")
    if len(a) < 2 or len(a) > 60 or re.fullmatch(r"[\d\W]+", a):
        return None
    if a.isupper() and len(a) > 4:
        a = a.title().replace("Klm", "KLM").replace("Usaf", "USAF").replace("Ups", "UPS").replace("Twa", "TWA")
    return a


def parse(desc, airline_first):
    """Pull type, family, registration, airline and livery notes out of a free-text description."""
    desc = clean(desc)
    out = {"type": None, "family": None, "reg": None, "airline": None, "notes": None}
    notes = [q.strip() for q in QUOTE_RE.findall(desc)]
    notes += [p.strip() for p in re.findall(r"\(([^)]{3,80})\)", desc)]
    t = find_type(desc)
    r = find_reg(desc)
    if r:
        out["reg"] = r.group(0)
    if t:
        out["family"], out["type"] = t[0], tidy_type(t[1].group(0))
        if airline_first:
            cand = desc[:t[1].start()]
        else:
            end = r.start() if r and r.start() > t[1].end() else len(desc)
            cand = desc[t[1].end():end]
            if not tidy_airline(cand):
                cand = desc[:t[1].start()]
    else:
        cand = desc[:r.start()] if r else ""
    out["airline"] = tidy_airline(cand)
    seen, uniq = set(), []
    for n in notes:
        if n.lower() not in seen and n != out["reg"]:
            seen.add(n.lower())
            uniq.append(n)
    out["notes"] = "; ".join(uniq)[:160] or None
    return out


def brand_from_number(n):
    n = n.upper()
    if re.match(r"^(GJ|G2|GM|G5|GS)[A-Z0-9]", n): return "GeminiJets"
    if re.match(r"^(XX|EW|LH|KD)\d", n) or n.startswith("JCW"): return "JC Wings"
    if re.match(r"^NG(LITE)?\d", n): return "NG Models"
    if re.match(r"^(AV4|WB4|AV2)\d", n): return "Aviation 400"
    if re.match(r"^IF[A-Z0-9]{3}", n) and not n.startswith("IFC"): return "InFlight200"
    if re.match(r"^PH\d", n) or re.match(r"^PH[0-9A-Z]{4,}", n): return "Phoenix Models"
    if re.match(r"^AC\d", n) or re.match(r"^AC4", n): return "AeroClassics"
    return None


def brand_from_vendor(v):
    v = v.lower()
    if "gemini" in v and "aces" not in v: return "GeminiJets"
    if "jc wings" in v: return "JC Wings"
    if "ng models" in v: return "NG Models"
    if "aviation 400" in v or "aviation 200" in v: return "Aviation 400"
    if "inflight200" in v: return "InFlight200"
    if "herpa" in v and "snap" not in v: return "Herpa Wings"
    if v.startswith("phoenix"): return "Phoenix Models"
    if "aero classics" in v: return "AeroClassics"
    return next((b for k, b in MORE_BRANDS if (v.startswith(k[1:]) if k[0] == "^" else k in v + " ")), None)


def norm_key(brand, number):
    k = re.sub(r"[^A-Z0-9]", "", number.upper())
    if brand == "Phoenix Models": k = re.sub(r"^PH(?=\d)", "", k)
    if brand == "NG Models": k = re.sub(r"^NG(?=\d)", "", k)
    if brand == "Herpa Wings": k = re.sub(r"^HE(?=\d)", "", k)
    return brand + "|" + k


def line_for(brand, number, scale):
    n = number.upper()
    if brand == "GeminiJets":
        if n.startswith("G2"): return "Gemini200"
        if n.startswith("GM"): return "GeminiMACS"
        return "GeminiJets"
    if brand == "JC Wings":
        if n.startswith("JCW"): return "JC Wings Military"
    if brand == "Aviation 400" and scale == "1:200": return "Aviation 200"
    return None


def shopify_img(src, w):
    return src + ("&" if "?" in src else "?") + f"width={w}"


def rec_amsg(p):
    name = clean(p["name"])
    cats = [c["name"] for c in p["categories"]]
    if any(re.search(r"Accessor|Display Stand|Gift|AviationTag", c) for c in cats):
        return None
    first, _, rest = name.partition(" ")
    sku = (p.get("sku") or "").strip()
    number = sku if re.search(r"[A-Za-z]", sku) and len(sku) >= 4 else first
    number = number.upper().strip(".,")
    brand = brand_from_number(first) or brand_from_number(number)
    if not brand or ACCESSORY_RE.search(rest):
        return None
    scale = next((m.group(1) for c in cats for m in [re.search(r"\((1:\d+) scale\)", c)] if m), None)
    info = parse(rest, airline_first=True)
    tags = [clean(t["name"]) for t in p["tags"]]
    tag_air = [t for t in tags if t.isascii() and not find_type(t) and not re.search(r"\d{3}", t)
               and t not in ("Cargo", "House Color", "Flaps Down")]
    if tag_air:
        info["airline"] = tag_air[0]
    img = p["images"][0] if p["images"] else None
    image = thumb = None
    if img:
        m = re.search(r"(\S+-600x600\.\w+) 600w", img.get("srcset") or "")
        image = m.group(1) if m else img["src"]
        thumb = img.get("thumbnail") or image
    pr = p["prices"]
    amt = int(pr["price"]) / (10 ** pr["currency_minor_unit"]) if pr.get("price") else 0
    price = {"source": "Airplane Model SG", "amount": amt, "currency": pr["currency_code"],
             "url": p["permalink"], "inStock": bool(p.get("is_in_stock"))} if amt > 0 else None
    return dict(brand=brand, number=number, scale=scale, title=rest, image=image, thumb=thumb,
                description=strip_html(p.get("short_description") or p.get("description"))[:400] or None,
                price=price, **info)


def rec_shopify(p, source, currency, base):
    title = clean(p["title"])
    v = (p.get("variants") or [{}])[0]
    sku = clean(v.get("sku") or "")
    tags = p.get("tags") or []
    if source == "ard":
        segs = [s.strip() for s in title.split("|")]
        if len(segs) < 3:
            return None
        number = (sku or segs[0]).upper()
        brand = brand_from_vendor(p.get("vendor") or "") or brand_from_vendor(segs[1])
        desc = segs[2]
        m = re.search(r"1:(\d+)", segs[1]) or next((re.search(r"scale-1-(\d+)", t) for t in tags if t.startswith("scale-")), None)
        scale = "1:" + m.group(1) if m else None
        if any(t in ("category-accessory-only", "category-gift", "category-book") for t in tags):
            return None
        info = parse(desc, airline_first=False)
        if not info["airline"]:
            a = next((t[8:] for t in tags if t.startswith("airline-")), None)
            if a:
                info["airline"] = a.replace("-", " ").title()
    elif source == "wcd":
        # "<Month Year Release> <Brand> <Airline> <Type> <Reg> [- Pre Order] [- 1/200]"; the brand is the product type.
        kind = (p.get("product_type") or "").lower()
        brand = next((b for k, b in (("gemini", "GeminiJets"), ("jc wings", "JC Wings"), ("ng model", "NG Models"),
                                     ("av400", "Aviation 400"), ("aviation 400", "Aviation 400"), ("inflight", "InFlight200"),
                                     ("herpa", "Herpa Wings"), ("phoenix", "Phoenix Models"), ("aeroclassics", "AeroClassics")) + MORE_BRANDS if (kind.startswith(k[1:]) if k[0] == "^" else k in kind + " ")), None)
        if not brand or not sku or sku.lower() == "none":
            return None
        number = sku.upper()
        if brand == "NG Models" and number.isdigit(): number = "NG" + number
        if brand == "Phoenix Models" and number.isdigit(): number = "PH" + number
        desc = re.sub(r"\s*-\s*(Pre[- ]?Order|1/\d+)\b", "", title, flags=re.I)
        desc = re.sub(r"^.*?\b(NG Models|Phoenix Models|AV400|Aviation 400|JC Wings|Gemini Jets|Gemini 200|Gemini200|Aeroclassics|Inflight ?200|Herpa|Panda Models?|SQ Wings|HX Wings|Aero ?polaris|C Models?|Big Bird|V1 Models?|YU Models?|Patriot Models?|HYJL Wings|Dragon Wings|Apollo)\s+", "", desc, count=1, flags=re.I).strip()
        sm = next((re.match(r"1/(\d+)$", t) for t in tags if re.match(r"1/\d+$", t)), None) or re.search(r"\b1/(\d+)\b", title)
        scale = "1:" + sm.group(1) if sm else None
        info = parse(desc, airline_first=True)
    else:
        m = re.match(r"^(GEMINI200|GEMINIMACS|GEMINI|HERPA|INFLIGHT200)\s+(.*)$", title)
        if not m or p.get("product_type") not in ("AIRCRAFT", ""):
            return None
        brand = {"GEMINI200": "GeminiJets", "GEMINIMACS": "GeminiJets", "GEMINI": "GeminiJets",
                 "HERPA": "Herpa Wings", "INFLIGHT200": "InFlight200"}[m.group(1)]
        number = sku.upper()
        desc = re.sub(r"\(\*+\)", "", m.group(2)).strip()
        sm = re.search(r"\b1/(\d+)\b", desc)
        scale = "1:" + sm.group(1) if sm else None
        desc = re.sub(r"\s*\b1/\d+\b\s*", " ", desc)
        desc = re.sub(r"REG#\s?|\s#(?=[A-Z0-9])", " ", desc)
        info = parse(desc, airline_first=True)
        desc = clean(desc).title() if desc.isupper() else clean(desc)
        if info["reg"]:
            desc = re.sub(re.escape(info["reg"]), info["reg"], desc, flags=re.I)
        if info["type"]:
            desc = re.sub(re.escape(info["type"]), info["type"], desc, flags=re.I)
    if not brand or not number or len(number) < 3 or ACCESSORY_RE.search(desc):
        return None
    if brand == "Herpa Wings":
        number = re.sub(r"^HE(?=\d)", "", number)
    imgs = p.get("images") or []
    image = shopify_img(imgs[0]["src"], 800) if imgs else None
    thumb = shopify_img(imgs[0]["src"], 360) if imgs else None
    more = [shopify_img(i["src"], 800) for i in imgs[1:2]] if source == "wcd" else []
    try:
        amt = float(v.get("price") or 0)
    except ValueError:
        amt = 0
    name = {"ard": "Aviation Retail Direct", "tas": "The Airplane Shop", "wcd": "West Coast Diecast"}[source]
    price = {"source": name, "amount": amt, "currency": currency,
             "url": f"{base}/products/{p['handle']}", "inStock": bool(v.get("available"))} if amt > 0 else None
    return dict(brand=brand, number=number, scale=scale, title=desc, image=image, thumb=thumb, more=more,
                description=strip_html(p.get("body_html"))[:400] or None, price=price, **info)


def load(sub, key=None):
    seen, out = set(), []
    for f in sorted(glob.glob(os.path.join(RAW, sub, "*.json"))):
        data = json.load(open(f))
        for p in (data[key] if key else data):
            if p["id"] not in seen:
                seen.add(p["id"])
                out.append(p)
    return out


def fx_rates():
    """Rates to convert each currency into SGD; live if reachable, else sensible defaults."""
    rates = {"SGD": 1.0, "GBP": 1.72, "USD": 1.30, "EUR": 1.50, "AUD": 0.85, "CAD": 0.93, "MYR": 0.30, "HKD": 0.167}
    asof = None
    try:
        d = get("https://api.frankfurter.dev/v1/latest?base=SGD", tries=1)
        for cur in list(rates):
            if cur in d["rates"]:
                rates[cur] = round(1 / d["rates"][cur], 4)
        asof = d.get("date")
    except Exception as e:  # noqa: BLE001
        print("  fx: using default rates (", e, ")")
    return {"base": "SGD", "asOf": asof, "toSGD": rates}


def main():
    if "--fetch" in sys.argv:
        fetch_all()
    recs = []
    for p in load("amsg"):
        r = rec_amsg(p)
        if r: recs.append(r)
    n1 = len(recs)
    for p in load("ard", "products"):
        r = rec_shopify(p, "ard", "GBP", "https://www.aviationretaildirect.com")
        if r: recs.append(r)
    n2 = len(recs)
    for p in load("tas", "products"):
        r = rec_shopify(p, "tas", "USD", "https://www.airplaneshop.com")
        if r: recs.append(r)
    n3 = len(recs)
    for p in load("wcd", "products"):
        r = rec_shopify(p, "wcd", "CAD", "https://westcoastdiecast.ca")
        if r: recs.append(r)
    print(f"records: amsg {n1}, ard {n2 - n1}, tas {n3 - n2}, wcd {len(recs) - n3}")

    merged = {}
    for r in recs:
        r["scale"] = r["scale"] or DEFAULT_SCALE.get(r["brand"])
        k = norm_key(r["brand"], r["number"])
        price = r.pop("price")
        if k not in merged:
            m = merged[k] = dict(r)
            m["prices"] = []
        else:
            m = merged[k]
            # A second retailer's photo of the same model is kept as an extra picture.
            if m.get("image") and r.get("image") and r["image"] != m["image"]:
                m.setdefault("extra", []).append(r["image"])
            for f in ("scale", "type", "family", "reg", "airline", "notes", "image", "thumb", "description"):
                if not m.get(f) and r.get(f):
                    m[f] = r[f]
        m.setdefault("extra", []).extend(r.get("more") or [])
        if price and not any(x["source"] == price["source"] for x in m["prices"]):
            m["prices"].append(price)

    out = []
    for k, m in merged.items():
        if not m["scale"]:
            continue
        slug = re.sub(r"[^a-z0-9]+", "-", (m["brand"] + "-" + m["number"]).lower()).strip("-")
        rec = {"id": slug, "brand": m["brand"], "modelNumber": m["number"], "scale": m["scale"],
               "line": line_for(m["brand"], m["number"], m["scale"]), "title": m["title"],
               "airline": m["airline"], "aircraft": m["type"], "family": m["family"],
               "registration": m["reg"], "notes": m["notes"], "remoteImage": m["image"],
               "image": f"/catalog/{slug}.webp" if os.path.exists(os.path.join(ROOT, "public", "catalog", slug + ".webp")) else m["image"],
               "description": m["description"], "prices": m["prices"]}
        extra = list(dict.fromkeys(m.get("extra") or []))[:3]
        rec["remoteGallery"] = extra
        rec["gallery"] = [f"/catalog/{slug}-{n + 2}.webp" for n in range(len(extra))
                          if os.path.exists(os.path.join(ROOT, "public", "catalog", f"{slug}-{n + 2}.webp"))]
        out.append({a: b for a, b in rec.items() if b not in (None, "", [])})
    # Hand-added models (data/catalog-extra.json) are kept across rebuilds and win over scraped records.
    extra_path = os.path.join(OUT, "catalog-extra.json")
    if os.path.exists(extra_path):
        extras = json.load(open(extra_path))
        ids = {e["id"] for e in extras}
        out = [r for r in out if r["id"] not in ids] + extras
        print("extras", len(extras))
    out.sort(key=lambda r: (BRANDS.index(r["brand"]), r["modelNumber"]))

    os.makedirs(OUT, exist_ok=True)
    meta = {"builtAt": date.today().isoformat(), "count": len(out), "brands": BRANDS, "fx": fx_rates(),
            "sources": ["airplanemodelsg.com", "aviationretaildirect.com", "airplaneshop.com", "westcoastdiecast.ca"]}
    json.dump(out, open(os.path.join(OUT, "catalog.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(meta, open(os.path.join(OUT, "catalog-meta.json"), "w"), indent=2)
    from collections import Counter
    print("total", len(out))
    for label, fn in [("brand", lambda r: r["brand"]), ("scale", lambda r: r["scale"])]:
        print(label, Counter(map(fn, out)).most_common(12))
    for f in ("image", "aircraft", "airline", "registration", "prices"):
        print(f"  with {f}: {sum(1 for r in out if r.get(f))}")


if __name__ == "__main__":
    main()
