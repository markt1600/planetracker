import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { CatalogMeta, CatalogModel } from "./types";

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

type Indexed = { model: CatalogModel; hay: string; num: string; nums: string[] };

const indexOf = (model: CatalogModel): Indexed => ({
  model,
  num: squash(model.modelNumber),
  nums: [model.modelNumber, ...(model.aka ?? [])].map(squash),
  hay: [model.brand, model.line, model.modelNumber, ...(model.aka ?? []), model.title, model.airline, model.aircraft, model.family, model.registration, model.notes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase(),
});

let cache: { models: CatalogModel[]; index: Indexed[]; byId: Map<string, CatalogModel>; meta: CatalogMeta; aliases: Record<string, string> } | null = null;

function load() {
  if (cache) return cache;
  const dir = path.join(process.cwd(), "data");
  const models = JSON.parse(fs.readFileSync(path.join(dir, "catalog.json"), "utf8")) as CatalogModel[];
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "catalog-meta.json"), "utf8")) as CatalogMeta;
  const index = models.map(indexOf);
  // Ids of entries that were later merged into another entry (same model listed twice) still resolve.
  let aliases: Record<string, string> = {};
  try {
    aliases = JSON.parse(fs.readFileSync(path.join(dir, "catalog-aliases.json"), "utf8"));
  } catch {
    /* no aliases file */
  }
  cache = { models, index, byId: new Map(models.map((m) => [m.id, m])), meta, aliases };
  return cache;
}

let airlineNames: Record<string, string> | null = null;

/** The catalogue's one agreed spelling of an airline ("LOT" -> "LOT Polish Airlines"); unknown names pass through. */
export function canonicalAirline(name: string | undefined) {
  if (!name) return name;
  if (!airlineNames) {
    try {
      airlineNames = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "airline-aliases.json"), "utf8")) as Record<string, string>;
    } catch {
      airlineNames = {};
    }
  }
  const tidy = name.trim().replace(/\s+/g, " ");
  return airlineNames[tidy.toLowerCase()] ?? tidy;
}

export const catalogMeta = () => load().meta;
/** Looks in the built-in catalogue first, then in models added from the site. */
export const getModel = (id: string, custom: CatalogModel[] = []) => {
  const c = load();
  return c.byId.get(id) ?? c.byId.get(c.aliases[id] ?? "") ?? custom.find((m) => m.id === id);
};
export const allModels = () => load().models;

/** Title as sorted: without a leading "(Ultimate Collection)"-style label or punctuation. */
const sortName = (title: string) => title.replace(/^(\([^)]*\)|[^A-Za-z0-9])+\s*/, "");

export type SearchOptions = { q?: string; brand?: string; scale?: string; family?: string; airline?: string; limit?: number; offset?: number; custom?: CatalogModel[]; sort?: CatalogSort; dir?: "asc" | "desc"; valueOf?: (m: CatalogModel) => number | null };
export type CatalogSort = "default" | "name" | "airline" | "price" | "number" | "brand";

export function searchCatalog({ q = "", brand, scale, family, airline = "", limit = 24, offset = 0, custom = [], sort = "default", dir = "asc", valueOf }: SearchOptions) {
  const wanted = airline.toLowerCase().split(/\s+/).filter(Boolean);
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const qNum = squash(q);
  const scored: { model: CatalogModel; score: number }[] = [];
  // Site-added models come first so a newly added plane is easy to find.
  for (const entry of [...custom.map(indexOf), ...load().index]) {
    const m = entry.model;
    if (brand && m.brand !== brand) continue;
    if (scale && m.scale !== scale) continue;
    if (family && m.family !== family) continue;
    // Airline names vary between retailers ("Delta", "Delta Air Lines"), so match on the words typed.
    if (wanted.length && !wanted.every((w) => (m.airline ?? "").toLowerCase().includes(w))) continue;
    let score = 0;
    if (tokens.length) {
      // Any spelling of the model number counts, and leading zeros are optional (PH4737 finds PH04737).
      const loose = (n: string) => n.replace(/^([a-z]*)0+(?=\d)/, "$1");
      if (qNum.length >= 3 && entry.nums.some((n) => n === qNum || loose(n) === loose(qNum))) score += 100;
      else if (qNum.length >= 3 && entry.nums.some((n) => n.startsWith(qNum))) score += 60;
      else if (qNum.length >= 4 && entry.nums.some((n) => n.includes(qNum))) score += 40;
      let all = true;
      for (const t of tokens) {
        if (entry.hay.includes(t) || entry.hay.replace(/[^a-z0-9 ]/g, "").includes(t.replace(/[^a-z0-9]/g, ""))) score += 10;
        else all = false;
      }
      if (!all && score < 40) continue;
    }
    scored.push({ model: m, score });
  }
  if (sort !== "default") {
    const read = { name: (m: CatalogModel) => sortName(m.title), airline: (m: CatalogModel) => m.airline, number: (m: CatalogModel) => m.modelNumber, brand: (m: CatalogModel) => m.brand, price: (m: CatalogModel) => valueOf?.(m) ?? null }[sort];
    const sign = dir === "asc" ? 1 : -1;
    const keyed = scored.map((s) => ({ s, v: read(s.model) }));
    keyed.sort((a, b) => {
      // Models without the value (no price, no airline) go last in either direction.
      if (a.v == null || a.v === "") return b.v == null || b.v === "" ? 0 : 1;
      if (b.v == null || b.v === "") return -1;
      const c = typeof a.v === "number" && typeof b.v === "number" ? a.v - b.v : String(a.v).localeCompare(String(b.v), "en", { numeric: true });
      return c * sign || a.s.model.title.localeCompare(b.s.model.title);
    });
    return { total: keyed.length, results: keyed.slice(offset, offset + limit).map((k) => k.s.model) };
  }
  if (tokens.length) scored.sort((a, b) => b.score - a.score);
  return { total: scored.length, results: scored.slice(offset, offset + limit).map((s) => s.model) };
}

function airlines() {
  const map = new Map<string, number>();
  for (const m of load().models) if (m.airline) map.set(m.airline, (map.get(m.airline) ?? 0) + 1);
  return [...map.entries()].map(([value, n]) => ({ value, n }));
}

export function facets() {
  const { models, meta } = load();
  const count = (key: "scale" | "family" | "brand") => {
    const map = new Map<string, number>();
    for (const m of models) {
      const v = m[key];
      if (v) map.set(v, (map.get(v) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, n]) => ({ value, n }));
  };
  const brands = count("brand");
  return {
    brands: meta.brands.map((b) => ({ value: b, n: brands.find((x) => x.value === b)?.n ?? 0 })),
    scales: count("scale"),
    families: count("family"),
    // Airlines with at least two models, A–Z, as suggestions for the airline filter.
    airlines: airlines()
      .filter((a) => a.n >= 2)
      .sort((a, b) => a.value.localeCompare(b.value)),
  };
}

/** Rank catalogue models against what the AI saw in a photo. */
export function matchGuess(g: { airline?: string | null; aircraft?: string | null; family?: string | null; registration?: string | null; brand?: string | null; scale?: string | null; keywords?: string[] }) {
  const reg = g.registration ? squash(g.registration) : "";
  const airlineTokens = (g.airline ?? "").toLowerCase().split(/\s+/).filter((t) => t.length > 2 && !["air", "airlines", "airways", "the"].includes(t));
  const type = g.aircraft ? squash(g.aircraft.replace(/^(boeing|airbus)\s*/i, "")) : "";
  const typeBase = type.replace(/^([a-z]?\d{3}).*$/, "$1");
  const out: { model: CatalogModel; score: number }[] = [];
  for (const { model: m, hay } of load().index) {
    let score = 0;
    if (reg && m.registration && squash(m.registration) === reg) score += 60;
    const al = (m.airline ?? m.title).toLowerCase();
    const hits = airlineTokens.filter((t) => al.includes(t)).length;
    if (airlineTokens.length && hits) score += (25 * hits) / airlineTokens.length;
    const mt = m.aircraft ? squash(m.aircraft) : "";
    if (type && mt) {
      if (mt === type) score += 25;
      else if (mt.startsWith(type) || type.startsWith(mt)) score += 20;
      else if (typeBase.length >= 3 && mt.includes(typeBase)) score += 12;
    }
    if (g.family && m.family === g.family) score += 5;
    if (g.brand && m.brand === g.brand) score += 6;
    if (g.scale && m.scale === g.scale) score += 4;
    for (const k of g.keywords ?? []) if (k.length > 2 && hay.includes(k.toLowerCase())) score += 4;
    if (score >= 30 && (hits || (reg && score >= 60))) out.push({ model: m, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}
