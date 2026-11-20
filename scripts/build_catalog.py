#!/usr/bin/env python3
"""Build data/catalog.json — the die-cast model catalogue used by the app.

Sources (all public storefront product feeds):
  amsg  airplanemodelsg.com       WooCommerce Store API   prices in SGD (preferred price source)
  ard   aviationretaildirect.com  Shopify products.json   prices in GBP
  tas   airplaneshop.com          Shopify products.json   prices in USD
  wcd   westcoastdiecast.ca       Shopify products.json   prices in CAD
  ams   aircraftmodelstore.co.uk  Shopify products.json   prices in GBP (die-cast only)
  das   diecastairplanestore.com   brand listings (run scripts/fetch_diecastairplanestore.py)   prices in USD
  sms   scalemodelstore.com       model pages (run scripts/fetch_scalemodelstore.py)   prices in EUR

Usage:
  python3 scripts/build_catalog.py           # rebuild from .cache/catalog-raw
  python3 scripts/build_catalog.py --fetch   # re-download the feeds first (polite, ~5 min)
  python3 scripts/fetch_images.py            # then store photos locally
  python3 scripts/dedupe_images.py           # drop photos that repeat one already stored, and re-run this script
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
    "Hobby Master", "B Models", "KJ Models", "WLTK", "Aether Model", "Kylin Model", "El Aviador", "Legacy Jets",
    "JFox", "JetX", "Retro Models", "Fantasy Wings", "Hogan", "Limox", "ODEWM", "Oxford Aviation", "Postage Stamp",
    "AviaBoss", "ARD Models", "YY Wings",
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
    for sub in ("amsg", "ard", "tas", "wcd", "ams"):
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
    fetch_shopify("ams", "https://www.aircraftmodelstore.co.uk", "all")


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
    r"t-shirt|mug\b|luggage|airport (?:set|accessor)|accessor|snap[- ]?fit|blind box|"
    r"weapons? pack|landing gear|jet blast|scenix|flood ?lights?|container loader|boarding station|fire engine|passenger gate|"
    r"airport (?:building|tower|fire)|construction kit|\bvehicles\b|\bvan set\b|marshall?er|apa system|carrier deck|display deck|diorama|\d\s*pcs?\b|\bpieces\b)", re.I)
QUOTE_RE = re.compile(r"[“\"‘']{1,2}\s?([^”\"’']{3,90}?)\s?[”\"’″']{1,2}")


def clean(s):
    s = html.unescape(s or "")
    s = s.replace("‑", "-").replace("–", "-").replace("—", "-").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


def strip_html(s):
    return clean(re.sub(r"<[^>]+>", " ", s or ""))


# Shop talk that has no place in a reference catalogue: ordering, stock, shipping, sales, contact details.
SHOP_PHRASES = re.compile(
    r"\S+@\S+\.\w+|(?:https?://|www\.)\S+|\|\||"
    r"any questions,? please (?:e-?mail|contact)(?: us)?(?: at)?|please (?:e-?mail|contact|call|get in touch with) us[^.!?]*|"
    r"sold as[- ]is|final sale|all sales (?:are )?final|no returns?(?: or refunds?)?|"
    r"pre-?order etas? are estimates,? not guarantees\.?|"
    r"if you(?:'|’)?d like your in-stock items shipped first[^.!?]*[.!?]?|"
    r"\b\d/\d{2,3} scale\s+(?=made by)|\bmade by [A-Z][\w&:.' -]*?(?=\s+(?:die-?cast|fully|antennas?|$))|\bdie-?cast model\b|\bfully assembled\b",
    re.I)
SHOP_SENTENCE = re.compile(
    r"pre-?order|\beta\b|\betas\b|\bdue\b|expected|delivery|dates? may change|in[- ]stock|out of stock|back ?order|restock|"
    r"\bship|postage|dispatch|\bsale\b|\bsold\b|discount|\bprice|\brrp\b|\bmsrp\b|refund|\breturns?\b|warranty|"
    r"e-?mail|contact us|get in touch|customer|\border(?:s|ed|ing)?\b|deposit|cancel|reserve|per customer|"
    r"pre-?owned|second[- ]hand|shelf wear|packaging may|as[- ]is|adult collectible|ages? \d+\+?|not a toy|choking|"
    r"future releases?|release date|newsletter|notify|click|website|our (?:shop|store)|we (?:will|can|do|are|have|offer)\b|"
    r"[£$€]\s?\d", re.I)


def clean_description(text, limit=400):
    """Keep what describes the model (stand, gear, size, edition, history); drop anything about buying it."""
    text = strip_html(text)
    text = re.sub(r"^.{0,160}?\bAircraft Scale Model\b\s*", "", text)  # the shop's own title repeated up front
    text = re.sub(r"^.{0,40}?\b1/\d+\s+(?:\([^)]*\)\s+)?(?=This )", "", text)  # "A320-200 1/200 This die-cast ..."
    # A flattened spec table ("Brand X Scale 1/400 Aircraft ... Length 17.5 cm ... Features ...") repeats
    # fields the catalogue already has; keep only the length and features from it.
    table = re.search(r"\s*\bBrand [\w' ]+? Scale 1/\d+ .*$", text)
    if table:
        length = re.search(r"\bLength ([\d.]+ ?cm)", table.group(0))
        features = re.search(r"\bFeatures (.+?)\.?$", table.group(0))
        tail = (f" Model length {length.group(1)}." if length else "") + (f" Features: {features.group(1).strip().lower()}." if features else "")
        text = text[:table.start()] + tail
    text = SHOP_PHRASES.sub(" ", text)
    keep = []
    for part in re.split(r"(?<=[.!?])\s+", text):
        part = re.sub(r"\s+", " ", part).strip(" -–|,;:")
        if len(part) < 4 or SHOP_SENTENCE.search(part) or " | " in part or re.fullmatch(r"[\w' ]{2,30} 1:\d+ scale model\.?", part):
            continue  # shop talk, a repeated title line, or "InFlight200 1:200 scale model."
        if part.isupper() and len(part) > 12:
            part = part.capitalize()
        keep.append(part if part[-1] in ".!?" else part + ".")
    out = ""
    for part in keep:  # stop at a whole sentence rather than cutting one in half
        if len(out) + len(part) + 1 > limit:
            break
        out = (out + " " + part).strip()
    return out if len(out) >= 12 else None


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
    a = re.sub(r"\s+(Boeing|Airbus|BOEING|AIRBUS)\s*$", "", a)
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
    # Retailers write the same model number differently; these rules make them meet.
    if brand == "Phoenix Models": k = re.sub(r"^PH(?=\d)", "", k).lstrip("0")  # PH04737 / PH4737 / 04737
    if brand == "NG Models": k = re.sub(r"^NG(?=\d)", "", k).lstrip("0")  # NG04006 / NG4006 / 04006
    if brand == "Herpa Wings": k = re.sub(r"^HE(?=\d)", "", k)
    if brand == "Panda Models": k = re.sub(r"^PM(?=\d)", "", k)  # PM62421 / 62421
    if brand == "YU Model": k = re.sub(r"^(YU400|YU|Y)(?=\d)", "", k)  # YU40030001 / Y30001 / 30001
    if brand == "JC Wings": k = re.sub(r"^(JC|X)(?=\d)", "XX", k)  # JC4430 / X40020 are XX numbers
    if brand == "Aviation 400": k = re.sub(r"^(AV|WB)(?=\d)", "", k)  # AV4077 / WB4077
    if brand == "V1 Models": k = re.sub(r"^V1(?=\d)", "", k)  # V1-400008 / 400008
    if brand == "InFlight200": k = re.sub(r"^IF(?=\d+$)", "", k)  # IF54651 / 54651
    return brand + "|" + k


# ---------------------------------------------------------------- airline names
# Retailers spell airlines many ways ("LOT", "LOT-Polish Airline", "Viscount 800 LOT Polish"). Each row is:
# canonical name, pattern that identifies it, subsidiaries to keep apart {pattern: name}, and an optional
# pattern that means "this is something else" (e.g. "United Arab Emirates" is not Emirates).
AIRLINES = [
    ("LOT Polish Airlines", r"\bLOT\b", {}, None),
    ("KLM Royal Dutch Airlines", r"\bKLM\b", {r"city ?hopper": "KLM Cityhopper", r"\bexel\b": "KLM Exel", r"cargo": "KLM Cargo", r"aeroclub": "KLM Aeroclub"}, r"viasa"),
    ("All Nippon Airways (ANA)", r"\bANA\b|All Nippon", {r"\bwings\b": "ANA Wings", r"cargo": "ANA Cargo"}, r"ansett|torch"),
    ("Japan Airlines (JAL)", r"\bJAL\b|Jal No|Japan Air ?[Ll]ines", {r"cargo": "JAL Cargo", r"express": "JAL Express"}, r"torch|system"),
    ("US Air Force", r"\bUSAF\b|United States Air Force|\bU\.?S\.? Air Force|\bUs Air Force|\bUSA ?-? ?Air Force", {}, None),
    ("Royal Air Force", r"\bRAF\b|Royal Air Force", {}, r"australian|canadian|new zealand|saudi|netherlands|danish|norwegian|thai|malaysian|jordanian|moroccan|oman|brunei|bahrain"),
    ("Delta Air Lines", r"\bDelta\b", {r"connection": "Delta Connection", r"express": "Delta Express", r"shuttle": "Delta Shuttle"}, None),
    ("Cathay Pacific", r"Cathay Pacific|Cathay Cargo|^Cathay\b", {r"cargo": "Cathay Pacific Cargo", r"dragon": "Cathay Dragon"}, None),
    ("Qantas", r"\bQantas\b|\bQANTAS\b", {r"freight": "Qantas Freight", r"link": "QantasLink"}, r"/"),
    ("Emirates", r"^Emirates\b", {r"sky ?cargo": "Emirates SkyCargo"}, None),
    ("Lufthansa", r"\bLufthansa\b", {r"cargo": "Lufthansa Cargo", r"regional": "Lufthansa Regional", r"city ?line": "Lufthansa CityLine", r"express": "Lufthansa Express", r"city airlines": "Lufthansa City Airlines", r"italia": "Lufthansa Italia"}, None),
    ("British Airways", r"British Airways", {r"cargo": "British Airways World Cargo", r"express": "British Airways Express"}, r"/"),
    ("Singapore Airlines", r"Singapore Airlines|^Singapore$", {r"cargo": "Singapore Airlines Cargo"}, r"/"),
    ("United Airlines", r"United Air ?[Ll]ines|^United$", {r"express": "United Express"}, None),
    ("American Airlines", r"American Airlines|^American$", {r"eagle": "American Eagle"}, None),
    ("Air France", r"Air France", {r"cargo": "Air France Cargo", r"hop": "Air France Hop"}, r"/|-KLM"),
    ("Air China", r"Air China", {r"cargo": "Air China Cargo"}, None),
    ("China Eastern Airlines", r"China Eastern", {r"cargo": "China Eastern Cargo", r"yunnan": "China Eastern Yunnan"}, None),
    ("China Southern Airlines", r"China Southern", {r"cargo": "China Southern Cargo"}, None),
    ("China Airlines", r"^China Airlines", {r"cargo": "China Airlines Cargo"}, None),
    ("Korean Air", r"Korean Air", {r"cargo": "Korean Air Cargo"}, None),
    ("Thai Airways International", r"Thai Airways|^Thai( International)?$", {r"smile": "Thai Smile"}, None),
    ("Turkish Airlines", r"Turkish Airlines|^Turkish$", {r"cargo": "Turkish Cargo"}, None),
    ("Qatar Airways", r"Qatar Airways|^Qatar$", {r"cargo": "Qatar Airways Cargo"}, None),
    ("Etihad Airways", r"\bEtihad\b", {r"cargo": "Etihad Cargo"}, None),
    ("Air Canada", r"Air Canada", {r"rouge": "Air Canada Rouge", r"express": "Air Canada Express", r"jetz": "Air Canada Jetz", r"cargo": "Air Canada Cargo", r"jazz": "Air Canada Jazz"}, r"trans"),
    ("Southwest Airlines", r"\bSouthwest\b", {}, r"china"),
    ("Alaska Airlines", r"^Alaska\b", {r"horizon": "Horizon Air"}, None),
    ("JetBlue Airways", r"\bjet ?blue\b", {}, None),
    ("EVA Air", r"\bEVA Air", {r"cargo": "EVA Air Cargo"}, None),
    ("Malaysia Airlines", r"Malaysia Airlines|Malaysian Airline|^Malaysia$", {}, None),
    ("Garuda Indonesia", r"\bGaruda\b", {r"citilink": "Citilink"}, None),
    ("Philippine Airlines", r"Philippine Air ?[Ll]ines|^Philippines?$", {}, None),
    ("Virgin Atlantic", r"Virgin Atlantic", {}, None),
    ("Air New Zealand", r"Air New Zealand", {}, None),
    ("Swiss International Air Lines", r"^Swiss( International( Air ?Lines)?)?$|^SWISS", {}, r"swissair"),
    ("Iberia", r"^Iberia\b", {r"express": "Iberia Express", r"regional": "Iberia Regional"}, None),
    ("Finnair", r"\bFinnair\b", {}, None),
    ("SAS Scandinavian Airlines", r"\bSAS\b|Scandinavian Airlines", {}, None),
    ("Aeroflot", r"\bAeroflot\b", {r"cargo": "Aeroflot Cargo"}, None),
    ("Air India", r"Air India", {r"express": "Air India Express"}, None),
    ("Hainan Airlines", r"Hainan Airlines", {}, None),
    ("Saudia", r"\bSaudia\b|Saudi Arabian Airlines", {r"cargo": "Saudia Cargo"}, None),
    ("Ethiopian Airlines", r"^Ethiopian\b", {r"cargo": "Ethiopian Cargo"}, None),
    ("FedEx", r"\bFedEx\b|\bFedex\b|Federal Express", {}, None),
    ("UPS", r"\bUPS\b|United Parcel Service", {}, None),
    ("DHL", r"^DHL\b", {}, r"/"),
    ("Pan Am", r"\bPan Am\b|Pan American", {}, None),
    ("TWA", r"\bTWA\b|Trans World Airlines", {}, None),
    ("Northwest Airlines", r"^Northwest\b|\bNWA\b", {r"airlink": "Northwest Airlink"}, None),
    ("Continental Airlines", r"^Continental\b", {r"express": "Continental Express", r"micronesia": "Continental Micronesia"}, None),
    ("easyJet", r"\beasy ?jet\b", {}, None),
    ("Ryanair", r"\bRyanair\b", {}, None),
    ("Scoot", r"^Scoot\b", {}, None),
    ("AirAsia", r"\bAir ?Asia\b", {r"\bx\b": "AirAsia X"}, None),
    ("Vietnam Airlines", r"Vietnam Airlines", {}, None),
    ("Asiana Airlines", r"\bAsiana\b", {r"cargo": "Asiana Cargo"}, None),
    ("Hawaiian Airlines", r"^Hawaiian\b", {}, None),
    ("Aer Lingus", r"Aer Lingus", {}, None),
    ("TAP Air Portugal", r"^TAP\b", {r"express": "TAP Express"}, None),
    ("Icelandair", r"\bIcelandair\b", {}, None),
    ("Austrian Airlines", r"^Austrian\b", {}, None),
    ("Xiamen Airlines", r"\bXiamen\b", {}, None),
    ("Sichuan Airlines", r"^Sichuan\b", {}, None),
    ("Shenzhen Airlines", r"^Shenzhen\b", {}, None),
    ("Japan Transocean Air", r"Japan Trans ?[Oo]cean", {}, None),
    ("Japan Air Self-Defense Force", r"Japan Air Self[- ]Defen[cs]e Force|\bJASDF\b", {}, None),
    ("Republic of Singapore Air Force", r"Singapore Air Force|\bRSAF\b", {}, None),
    ("PLA Air Force", r"People.?s Liberation Army Air Force|\bPLAAF\b|PLA Air Force|^China Air Force", {}, None),
]
AIRLINES = [(name, re.compile(pat, re.I if pat == pat.lower() else 0), {re.compile(k, re.I): v for k, v in subs.items()},
             re.compile(skip, re.I) if skip else None) for name, pat, subs, skip in AIRLINES]


def canonical_airline(a):
    for name, pat, subs, skip in AIRLINES:
        if pat.search(a) and not (skip and skip.search(a)):
            return next((v for k, v in subs.items() if k.search(a)), name)
    return None


def normalize_airlines(out):
    """Give every spelling of an airline one name, so filters and stats count them together."""
    from collections import Counter
    original = {id(r): r.get("airline") for r in out}
    for r in out:
        if r.get("airline"):
            r["airline"] = canonical_airline(r["airline"]) or r["airline"]
    # Long tail: spellings that differ only in case, punctuation, brackets or an "Airlines" suffix.
    def key(a):
        k = re.sub(r"\([^)]*\)", " ", a.lower())
        k = re.sub(r"[^a-z0-9 ]", " ", k)
        k = re.sub(r"\b(air ?lines?|the)\b", " ", k)
        return re.sub(r"\s+", "", k)  # spacing too: "Silk Air" / "Silkair", "Hong Kong Airlines" / "HongKong Airlines"
    counts = Counter(r["airline"] for r in out if r.get("airline"))
    best = {}
    for name, n in counts.items():
        k = key(name)
        # Most used wins; on a tie the spaced-out spelling ("Hi Fly" over "Hifly") reads better.
        same_letters = k in best and re.sub(r"\W", "", name.lower()) == re.sub(r"\W", "", best[k].lower())
        if k and (k not in best or n > counts[best[k]] or (n == counts[best[k]] and same_letters and name.count(" ") > best[k].count(" "))):
            best[k] = name
    for r in out:
        if r.get("airline") and key(r["airline"]) in best:
            r["airline"] = best[key(r["airline"])]
    # Every spelling seen -> the name it became. The site uses this to tidy airlines typed or saved earlier.
    aliases = {}
    for r in out:
        if r.get("airline"):
            aliases[r["airline"].lower()] = r["airline"]
            if original[id(r)]: aliases.setdefault(original[id(r)].strip().lower(), r["airline"])
    return aliases


def true_brand(brand, number):
    """Some retailers file a model under a sister brand; the number format says who really made it."""
    n = re.sub(r"[^A-Z0-9]", "", number.upper())
    if n.startswith("KJ"): return "KJ Models"
    # InFlight's sister brands are often filed under "InFlight200".
    if brand == "InFlight200":
        if n.startswith("JF"): return "JFox"  # JF-737-8-043, JF-A300-006
        if re.match(r"^B\d{3}", n): return "B Models"  # B-773-ANA-52A, B-722-251
        if n.startswith("ARD"): return "ARD Models"
        if n.startswith("EAV"): return "El Aviador"
        if re.match(r"^RM\d", n): return "Retro Models"
    if re.match(r"^YY\d", n) and brand in ("AeroClassics", "YY Wings"): return "YY Wings"
    if re.match(r"^L2\d{3}", n) and brand in ("JC Wings", "SQ Wings"): return "SQ Wings"
    if re.match(r"^5\d{5}(\d{3})?$", n) and brand == "JC Wings": return "Herpa Wings"
    if re.match(r"^C0\d{3}", n) and brand in ("Panda Models", "Aero Polaris", "C Models"): return "C Models"
    if re.match(r"^HA\d{6,}", n) and brand in ("NG Models", "Aero Polaris", "HYJL Wings"): return "Aero Polaris"  # HYJL is the same maker
    return brand


GEMINI_NUM = re.compile(r"^(GJ|G2|GM|G5|GS)([A-Z]{2,4})?(\d{2,}[A-Z]*)$")


def gemini_keys(recs):
    """Work out which GeminiJets spellings are the same model.

    The full number carries an airline code (GJTAM2062); some shops drop it (GJ2062) or mistype it
    (GJSSO2014 / GJSOO2014). The digits are usually unique, but not always (GJDAL2294 is a Delta A321neo,
    GJGTI2294 an Atlas 777), so spellings are only joined when the registration agrees or there is
    exactly one coded model with those digits.
    """
    coded = {}  # prefix+digits -> list of clusters, each {"key": first spelling, "regs": set, "types": set}
    plain = lambda n: re.sub(r"[^A-Z0-9]", "", n.upper())
    for r in recs:
        m = GEMINI_NUM.match(plain(r["number"])) if r["brand"] == "GeminiJets" else None
        if not m or not m.group(2):
            continue
        clusters = coded.setdefault(m.group(1) + m.group(3), [])
        hit = next((c for c in clusters if plain(r["number"]) in c["names"] or (r.get("reg") and r["reg"] in c["regs"])), None)
        if not hit:
            hit = {"key": plain(r["number"]), "names": set(), "regs": set(), "types": set()}
            clusters.append(hit)
        hit["names"].add(plain(r["number"]))
        if r.get("reg"): hit["regs"].add(r["reg"])
        if r.get("family"): hit["types"].add(r["family"])
    for r in recs:
        m = GEMINI_NUM.match(plain(r["number"])) if r["brand"] == "GeminiJets" else None
        if not m:
            continue
        clusters = coded.get(m.group(1) + m.group(3), [])
        if m.group(2):
            hit = next(c for c in clusters if plain(r["number"]) in c["names"])
        else:
            hit = (clusters[0] if len(clusters) == 1 else
                   next((c for c in clusters if r.get("reg") and r["reg"] in c["regs"]), None) or
                   next((c for c in clusters if r.get("family") and r["family"] in c["types"]), None))
        if hit:
            r["key_number"] = hit["key"]


def slug_of(brand, number):
    return re.sub(r"[^a-z0-9]+", "-", (brand + "-" + number).lower()).strip("-")


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
                description=clean_description(p.get("short_description") or p.get("description")),
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
    elif source == "ams":
        # "<Brand> <Airline> <Type> <Reg> ... 1/400 Aircraft Scale Model"; plastic kits and gifts are tagged otherwise.
        if "Diecast Models" not in tags or not sku:
            return None
        vendor = (p.get("vendor") or "").lower()
        brand = {"ng models": "NG Models", "geminijets": "GeminiJets", "phoenix": "Phoenix Models", "herpa": "Herpa Wings",
                 "sq wings": "SQ Wings", "aviation400": "Aviation 400", "aviation200": "Aviation 400", "hx models": "HX Wings",
                 "jc wings": "JC Wings", "hogan": "Hogan", "fantasy wings": "Fantasy Wings", "postage stamp": "Postage Stamp"}.get(vendor)
        if not brand:
            return None
        number = sku.upper()
        if brand == "NG Models" and number.isdigit(): number = "NG" + number
        if brand == "Phoenix Models" and number.isdigit(): number = "PH" + number
        sm = re.search(r"\b1/(\d+)\b", title)
        scale = "1:" + sm.group(1) if sm else None
        desc = re.sub(r"\s*\b1/\d+\b.*$", "", title)
        desc = re.sub(r"\s*Aircraft Scale Model\s*$", "", desc, flags=re.I)
        desc = re.sub(r"^(NG Models|GeminiJets|Gemini Jets|Phoenix|Herpa Wings|Herpa|SQ Wings|Aviation ?[24]00|HX Models|JC Wings|Hogan Wings|Hogan|Fantasy Wings|Postage Stamp)\s+", "", desc, flags=re.I).strip()
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
    # Aircraft Model Store photographs models from several angles; keep up to five more of those.
    more = [shopify_img(i["src"], 800) for i in imgs[1:(6 if source == "ams" else 2)]] if source in ("wcd", "ams") else []
    try:
        amt = float(v.get("price") or 0)
    except ValueError:
        amt = 0
    name = {"ard": "Aviation Retail Direct", "tas": "The Airplane Shop", "wcd": "West Coast Diecast", "ams": "Aircraft Model Store"}[source]
    price = {"source": name, "amount": amt, "currency": currency,
             "url": f"{base}/products/{p['handle']}", "inStock": bool(v.get("available"))} if amt > 0 else None
    # A second-hand or damaged copy is still the same model; say so on the price rather than in the title.
    worn = re.search(r"[*#\s]*\b(PRE-?OWNED|DAMAGED(?: BOX)?)\b[*\s]*", desc, flags=re.I)
    if worn:
        condition = "pre-owned" if worn.group(1).upper().startswith("PRE") else worn.group(1).lower()
        desc = (desc[:worn.start()] + " " + desc[worn.end():]).strip()
        if price: price.update(source=f"{name} ({condition})", condition=condition)
    return dict(brand=brand, number=number, scale=scale, title=desc, image=image, thumb=thumb, more=more,
                description=clean_description(p.get("body_html")), price=price, **info)


SMS_BRANDS = {
    "JC Wings": "JC Wings", "NG Models": "NG Models", "NG Lite": "NG Models", "Inflight200": "InFlight200",
    "GeminiJets": "GeminiJets", "Herpa Wings": "Herpa Wings", "Aviation400": "Aviation 400", "Aviation200": "Aviation 400",
    "Apollo": "Apollo", "Aero Polaris": "Aero Polaris", "Panda Models": "Panda Models", "V1:400": "V1 Models",
    "Yu ModeL": "YU Model", "Hobby Master": "Hobby Master", "B Models": "B Models", "KJ Models": "KJ Models",
    "WLTK": "WLTK", "Aether Model": "Aether Model", "Kylin Model": "Kylin Model", "El Aviador": "El Aviador",
    "Legacy Jets": "Legacy Jets", "Other (JFox)": "JFox", "Other (JetX)": "JetX", "Retro Models": "Retro Models",
    "Fantasy Wings": "Fantasy Wings", "Hogan": "Hogan", "Limox": "Limox", "ODEWM": "ODEWM",
    "Oxford Aviation": "Oxford Aviation", "Postage Stamp": "Postage Stamp", "AviaBoss": "AviaBoss", "ARD": "ARD Models",
    "Phoenix": "Phoenix Models", "Phoenix Models": "Phoenix Models", "Aeroclassics": "AeroClassics", "Big Bird": "Big Bird",
    "Dragon Wings": "Dragon Wings", "SQ Wings": "SQ Wings", "HX Models": "HX Wings", "C Models": "C Models",
}


def rec_sms(r):
    """One scalemodelstore.com model page (already reduced to fields by fetch_scalemodelstore.py)."""
    brand = SMS_BRANDS.get((r.get("brand") or "").strip())
    number = clean(r.get("mpn") or "").upper()
    if not brand or len(number) < 3 or "error" in r:
        return None
    # The shop lists imperfect copies (dented box, paint flaw) as separate products with a suffix on the
    # number. They are the same model: fold them into it as an extra, clearly labelled price.
    filed, condition = number, None
    vm = re.match(r"^(.+?)_((?:DAMAGED?|PAINT|BOX\d*|PLINTH|COVER|SKEW|NO|STAND)(?:_[A-Z0-9]+)*)$", number)
    if vm:
        number, flaw = vm.group(1), vm.group(2)
        condition = ("missing engines" if "ENGINE" in flaw else "skewed tail" if "SKEW" in flaw else "paint flaw" if "PAINT" in flaw
                     else "damaged stand" if re.search("PLINTH|STAND", flaw) else "damaged cover" if "COVER" in flaw else "damaged box")
    parts = [x.strip() for x in (r.get("detail") or "").split("|")]
    airline = parts[1] if len(parts) > 2 else None
    kind = parts[2] if len(parts) > 2 else None
    name = clean(r.get("name") or "")
    if not airline or not kind or f"{airline} {kind}" != name:
        airline, kind = None, name
    m = re.search(r"\b1:(\d+)\b", r.get("title") or "")
    if not m or ACCESSORY_RE.search(name):
        return None
    # Remarks (registration, livery, squadron) sit between the announcement date and the price.
    remarks = []
    detail = r.get("detail") or ""
    rm = re.search(r"Brochure / announcement: \|[^|]*\|(.*?)\|Our price", detail)
    if rm:
        remarks = [x.strip() for x in rm.group(1).split("|") if x.strip()]
    reg = next((x for x in remarks if REG_RE.fullmatch(x) and not NOT_REG.match(x)), None)
    notes = [x for x in remarks if x != reg and len(x) < 90]
    t = find_type(kind)
    if brand == "NG Models" and number.isdigit(): number = "NG" + number
    if brand == "Phoenix Models" and number.isdigit(): number = "PH" + number
    title = " ".join(x for x in [name, f'"{notes[0].title() if notes[0].isupper() else notes[0]}"' if notes else None, reg] if x)
    imgs = ["https://www.scalemodelstore.com" + i for i in (r.get("images") or [])]
    price = {"source": "ScaleModelStore", "amount": r["eur"], "currency": "EUR", "url": r["url"],
             "inStock": bool(r.get("inStock"))} if r.get("eur") else None
    if condition:
        imgs = []  # photos of the flaw are not catalogue photos
        if price: price.update(source=f"ScaleModelStore ({condition})", condition=condition)
    return dict(brand=brand, number=number, filed_number=filed, scale="1:" + m.group(1), title=title, image=imgs[0] if imgs else None,
                thumb=None, more=[], description=None, price=price, type=tidy_type(t[1].group(0)) if t else clean(kind)[:40],
                family=t[0] if t else None, reg=reg, airline=tidy_airline(airline) if airline else None,
                notes="; ".join(notes)[:160] or None)


DAS_BRANDS = {
    "inflight200": "InFlight200", "hobby master": "Hobby Master", "sq wings": "SQ Wings", "gemini jets": "GeminiJets",
    "geminijets": "GeminiJets", "gemini200": "GeminiJets", "geminimacs": "GeminiJets", "gemini100": "GeminiJets",
    "jc wings": "JC Wings", "ng model": "NG Models", "hx models": "HX Wings", "jfox": "JFox", "yy wings": "YY Wings",
    "b-models": "B Models", "apollo": "Apollo", "aviation400": "Aviation 400", "aviation200": "Aviation 400",
    "wb models": "Aviation 400", "aero polaris": "Aero Polaris", "ard200": "ARD Models", "v1-400": "V1 Models",
    "panda models": "Panda Models", "phoenix model": "Phoenix Models", "herpa 1:500": "Herpa Wings", "herpa 1:200": "Herpa Wings",
    "legacy jets": "Legacy Jets", "el aviador": "El Aviador", "aviaboss": "AviaBoss", "retro models": "Retro Models",
    "jet-x": "JetX", "postage stamp planes": "Postage Stamp",
}
DAS_PREFIX = re.compile(r"^(?:NG Models?|Gemini ?Jets|Gemini ?200|GeminiMACS|Gemini ?100|JC Wings|In[Ff]light ?200|Hobby Master|SQ Wings|"
                        r"HX Models|JFox|YY Wings|B-Models|Apollo|Aviation ?[24]00|WB Models|Aero ?Polaris|ARD ?200|V1[- ]?400|"
                        r"Panda Models?|Phoenix(?: Models?)?|Herpa(?: Wings)?|Legacy Jets|El Aviador|AviaBoss|Retro Models|Jet-?X|"
                        r"Postage Stamp)\s+", re.I)


def rec_das(c, brand=None):
    """One product card from a diecastairplanestore.com brand listing."""
    brand = brand or DAS_BRANDS.get((c.get("brand") or "").strip().lower())
    # The picture's caption is the fuller title (it includes the livery); both end "<number> [Scale] 1:NNN".
    text = clean(c.get("alt") or c.get("title") or "")
    m = re.search(r"\s(\S*\d\S*)\s+(?:Scale\s+)?1:(\d+)\s*$", text) or re.search(r"\s(\S*\d\S*)\s+(?:Scale\s+)?1:(\d+)\s*$", clean(c.get("title") or ""))
    if not brand or not m:
        return None
    number = m.group(1).strip(",.").upper()
    desc = DAS_PREFIX.sub("", text[:m.start()].strip(), count=1)
    desc = re.sub(r"\bReg:\s*", "", desc)
    desc = re.sub(r"\s*\(?(?:includes|with|w/) stand\)?", "", desc, flags=re.I).strip(" ,")
    if len(number) < 3 or not desc or ACCESSORY_RE.search(desc):
        return None
    if brand == "NG Models" and number.isdigit(): number = "NG" + number
    if brand == "Phoenix Models" and number.isdigit(): number = "PH" + number
    info = parse(desc, airline_first=True)
    # The shop shows a stock "no picture" graphic for some products; that is not a photo of the model.
    image = re.sub(r"/stencil/\d+x\d+/", "/stencil/1280x1280/", c["image"]) if c.get("image") and "ProductDefault" not in c["image"] else None
    price = {"source": "Diecast Airplane Store", "amount": c["usd"], "currency": "USD", "url": c["url"],
             "inStock": not c.get("soldOut")} if c.get("usd") else None
    return dict(brand=brand, number=number, scale="1:" + m.group(2), title=desc, image=image, thumb=None, more=[],
                description=None, price=price, **info)


def load_das():
    path = os.path.join(RAW, "das", "cards.jsonl")
    seen, out = set(), []
    for line in (open(path) if os.path.exists(path) else []):
        c = json.loads(line)
        if c["url"] not in seen:
            seen.add(c["url"])
            out.append(c)
    return out


DAS_ARCHIVE_BRANDS = {
    "ng models": "NG Models", "ng lite": "NG Models", "herpa": "Herpa Wings", "herpa wings": "Herpa Wings",
    "phoenix 1:400": "Phoenix Models", "aeroclassics": "AeroClassics", "c models": "C Models", "fantasy wings": "Fantasy Wings",
    "odewm": "ODEWM", "kj models": "KJ Models", "ard400": "ARD Models", "bigbird400": "Big Bird",
}
# Lines every product page repeats; what is left over says something about this particular model.
DAS_BOILERPLATE = re.compile(r"^(?:&nbsp;|Die-?cast metal|Detailed (?:scale )?landing gear|Limited production run|Display stand included|"
                             r"Finished model size|Tampo-printed|Dimensions:|Material:|Accessories:|Ultimate edition|This die-cast|"
                             r"Jet-X Models features|See the full)", re.I)
DAS_SKIP = re.compile(r"\b(?:repaired|damaged?|broken|pre-?owned|as[- ]is)\b", re.I)
DAS_BY_NUMBER = [(r"^(?:G[J2]|GJ)[A-Z]{3}\d", "gemini jets"), (r"^PH4", "phoenix model"), (r"^(?:LH[24]|XX[24]|JC[24])", "jc wings")]


DAS_TYPOS = {"Tukish": "Turkish", "Portgual": "Portugal", "Allegient": "Allegiant", "Internatiional": "International",
             "Tuploev": "Tupolev", "Deutscheland": "Deutschland"}
# Where an airline name stops on pages whose aircraft type the catalogue does not recognise.
DAS_AIRLINE_END = re.compile(
    r"\s+(?:Gulfstream|Dassault|Falcon|Tupolev|Douglas|Vickers|Convair|Dornier|Sud SE|Hawker|Dash 8|Saab|C[Vv]-?\d|EMB|E[Rr][Jj]|"
    r"H[Ss]-?748|DHC|TriStar|Boeing|Q200|E145|P-3B|with\b|named\b|hybrid\b|(?:old|new|delivery|early|\d{4}'?s)\b.*\blivery\b|#\d).*$"
    r"|\s+(?:[A-Z0-9]{1,2}-[A-Z0-9]{3,5}|N\d{2,5}[A-Z]{0,2})$|;.*$")


def das_airline(a):
    a = re.sub(r"^(?:AeroClassics|NG Lite|KJ Models|(?:El )?Aviador)\s+", "", a)
    a = DAS_AIRLINE_END.sub("", a).strip(" -/,")
    for wrong, right in DAS_TYPOS.items():
        a = re.sub(wrong, right, a, flags=re.I)
    return a if len(a) > 1 and a.lower() != "the" else None


def rec_das_archive(p):
    """One archived product page from diecastairplanestore.com (models no longer in its brand listings)."""
    name = clean((p.get("name") or "").replace("\x96", "-"))
    for wrong, right in DAS_TYPOS.items():
        name = name.replace(wrong, right)
    if p.get("error") or not name or DAS_SKIP.search(name):
        return None
    key = (p.get("brand") or "").strip().lower()
    if not key:  # a few pages name no manufacturer; the model number says which it is
        sku = (p.get("sku") or "").strip().upper()
        key = next((b for rx, b in DAS_BY_NUMBER if re.match(rx, sku)), "")
    if key in ("geminimacs", "hobby master"):  # military lines; this read is airliners only
        return None
    brand = DAS_ARCHIVE_BRANDS.get(key) or DAS_BRANDS.get(key)
    if not brand:
        return None
    r = rec_das({"alt": name, "title": name, "image": p.get("image"), "usd": p.get("usd"), "url": p["url"],
                 "soldOut": not p.get("inStock")}, brand)
    if not r:
        return None
    if r.get("airline"):
        r["airline"] = das_airline(r["airline"])
    lines = [l.strip() for l in (p.get("description") or "").split("\n") if l.strip()][1:]
    rest = [l for l in lines if not DAS_BOILERPLATE.match(l) and not DAS_SKIP.search(l)]
    text = clean_description(" ".join(rest)) if rest else None
    if text and len(text) > 3:
        r["description"] = text
    return r


def load_das_archive():
    path = os.path.join(RAW, "das", "archive.jsonl")
    if not os.path.exists(path):
        path = os.path.join(ROOT, "data", "sources", "das-archive.jsonl")
    seen, out = {c["url"] for c in load_das()}, []
    for line in (open(path) if os.path.exists(path) else []):
        p = json.loads(line)
        if p["url"] not in seen:
            seen.add(p["url"])
            out.append(p)
    return out


def load_sms():
    path = os.path.join(RAW, "sms", "pages.jsonl")
    return [json.loads(line) for line in open(path)] if os.path.exists(path) else []


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
    for p in load("ams", "products"):
        r = rec_shopify(p, "ams", "GBP", "https://www.aircraftmodelstore.co.uk")
        if r: recs.append(r)
    n4 = len(recs)
    for p in load_sms():
        r = rec_sms(p)
        if r: recs.append(r)
    n5 = len(recs)
    for c in load_das():  # last, so its photos are added after the ones already stored
        r = rec_das(c)
        if r: recs.append(r)
    n6 = len(recs)
    for p in load_das_archive():  # after the listings, for the same reason
        r = rec_das_archive(p)
        if r: recs.append(r)
    print(f"records: amsg {n1}, ard {n2 - n1}, tas {n3 - n2}, wcd+ams {n4 - n3}, sms {n5 - n4}, das {n6 - n5}, das archive {len(recs) - n6}")

    merged = {}
    # A shop that files a sister brand under "InFlight200": use the brand everyone else gives that number.
    plain = lambda n: re.sub(r"[^A-Z0-9]", "", n.upper())
    elsewhere = {}
    for r in recs:
        if r["brand"] != "InFlight200": elsewhere.setdefault(plain(r["number"]), set()).add(r["brand"])
    for r in recs:
        others = elsewhere.get(plain(r["number"]), set())
        if r["brand"] == "InFlight200" and len(others) == 1:
            r["filed_slug"] = slug_of(r["brand"], r.get("filed_number") or r["number"])  # so its old address still resolves
            r["brand"] = next(iter(others))
    gemini_keys(recs)
    for r in recs:
        filed_as = r.pop("filed_slug", None) or slug_of(r["brand"], r.get("filed_number") or r["number"])
        r.pop("filed_number", None)
        r["brand"] = true_brand(r["brand"], r["number"])
        r["scale"] = r["scale"] or DEFAULT_SCALE.get(r["brand"])
        k = norm_key(r["brand"], r.get("key_number") or r["number"])
        price = r.pop("price")
        if k not in merged:
            m = merged[k] = dict(r)
            m["prices"] = []
            m["display"] = r["number"]
            m["spellings"] = {filed_as}
            m["numbers"] = {r["number"]}
        else:
            m = merged[k]
            m["spellings"].add(filed_as)
            m["numbers"].add(r["number"])
            # Show the fullest spelling of the number (e.g. with GeminiJets' airline code).
            if len(r["number"]) > len(m["display"]): m["display"] = r["number"]
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
    aliases = {}
    dupes_path = os.path.join(OUT, "duplicate-photos.json")
    repeated_photos = set(json.load(open(dupes_path))) if os.path.exists(dupes_path) else set()
    for k, m in merged.items():
        if not m["scale"]:
            continue
        slug = slug_of(m["brand"], m["number"])
        # Other spellings used to be separate entries; point their old ids at this one.
        for other in m["spellings"]:
            if other != slug: aliases[other] = slug
        rec = {"id": slug, "brand": m["brand"], "modelNumber": m["display"], "scale": m["scale"],
               "line": line_for(m["brand"], m["number"], m["scale"]), "title": m["title"],
               "airline": m["airline"], "aircraft": m["type"], "family": m["family"],
               "registration": m["reg"], "notes": m["notes"], "remoteImage": m["image"],
               "image": f"/catalog/{slug}.webp" if os.path.exists(os.path.join(ROOT, "public", "catalog", slug + ".webp")) else m["image"],
               "description": m["description"], "prices": m["prices"]}
        rec["aka"] = sorted(n for n in m["numbers"] if n != m["display"])
        rec["prices"] = sorted(m["prices"], key=lambda x: bool(x.get("condition")))  # imperfect-copy offers listed last
        extra = list(dict.fromkeys(m.get("extra") or []))[:8]
        rec["remoteGallery"] = extra
        # Photos that repeat one already shown (see scripts/dedupe_images.py) are left out.
        rec["gallery"] = [f"/catalog/{slug}-{n + 2}.webp" for n in range(len(extra))
                          if f"{slug}-{n + 2}" not in repeated_photos
                          and os.path.exists(os.path.join(ROOT, "public", "catalog", f"{slug}-{n + 2}.webp"))]
        out.append({a: b for a, b in rec.items() if b not in (None, "", [])})
    # Hand-added models (data/catalog-extra.json) are kept across rebuilds and win over scraped records.
    extra_path = os.path.join(OUT, "catalog-extra.json")
    if os.path.exists(extra_path):
        extras = json.load(open(extra_path))
        ids = {e["id"] for e in extras}
        out = [r for r in out if r["id"] not in ids] + extras
        print("extras", len(extras))
    airline_aliases = normalize_airlines(out)
    out.sort(key=lambda r: (BRANDS.index(r["brand"]), r["modelNumber"]))

    os.makedirs(OUT, exist_ok=True)
    meta = {"builtAt": date.today().isoformat(), "count": len(out), "brands": BRANDS, "fx": fx_rates(),
            "sources": ["airplanemodelsg.com", "aviationretaildirect.com", "airplaneshop.com", "westcoastdiecast.ca", "aircraftmodelstore.co.uk", "scalemodelstore.com", "diecastairplanestore.com"]}
    json.dump(out, open(os.path.join(OUT, "catalog.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(meta, open(os.path.join(OUT, "catalog-meta.json"), "w"), indent=2)
    json.dump(dict(sorted(airline_aliases.items())), open(os.path.join(OUT, "airline-aliases.json"), "w"), ensure_ascii=False, indent=0)
    ids = {r["id"] for r in out}
    json.dump({k: v for k, v in sorted(aliases.items()) if k not in ids}, open(os.path.join(OUT, "catalog-aliases.json"), "w"), indent=0)
    from collections import Counter
    print("total", len(out))
    for label, fn in [("brand", lambda r: r["brand"]), ("scale", lambda r: r["scale"])]:
        print(label, Counter(map(fn, out)).most_common(12))
    for f in ("image", "aircraft", "airline", "registration", "prices"):
        print(f"  with {f}: {sum(1 for r in out if r.get(f))}")


if __name__ == "__main__":
    main()
