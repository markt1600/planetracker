import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { CatalogMeta, CatalogModel } from "./types";

type Indexed = { model: CatalogModel; hay: string; num: string };

let cache: { models: CatalogModel[]; index: Indexed[]; byId: Map<string, CatalogModel>; meta: CatalogMeta } | null = null;

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function load() {
  if (cache) return cache;
  const dir = path.join(process.cwd(), "data");
  const models = JSON.parse(fs.readFileSync(path.join(dir, "catalog.json"), "utf8")) as CatalogModel[];
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "catalog-meta.json"), "utf8")) as CatalogMeta;
  const index = models.map((model) => ({
    model,
    num: squash(model.modelNumber),
    hay: [model.brand, model.line, model.modelNumber, model.title, model.airline, model.aircraft, model.family, model.registration, model.notes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  }));
  cache = { models, index, byId: new Map(models.map((m) => [m.id, m])), meta };
  return cache;
}

export const catalogMeta = () => load().meta;
export const getModel = (id: string) => load().byId.get(id);
export const allModels = () => load().models;

export type SearchOptions = { q?: string; brand?: string; scale?: string; family?: string; limit?: number; offset?: number };

export function searchCatalog({ q = "", brand, scale, family, limit = 24, offset = 0 }: SearchOptions) {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const qNum = squash(q);
  const scored: { model: CatalogModel; score: number }[] = [];
  for (const entry of load().index) {
    const m = entry.model;
    if (brand && m.brand !== brand) continue;
    if (scale && m.scale !== scale) continue;
    if (family && m.family !== family) continue;
    let score = 0;
    if (tokens.length) {
      if (qNum.length >= 3 && entry.num === qNum) score += 100;
      else if (qNum.length >= 3 && entry.num.startsWith(qNum)) score += 60;
      else if (qNum.length >= 4 && entry.num.includes(qNum)) score += 40;
      let all = true;
      for (const t of tokens) {
        if (entry.hay.includes(t) || entry.hay.replace(/[^a-z0-9 ]/g, "").includes(t.replace(/[^a-z0-9]/g, ""))) score += 10;
        else all = false;
      }
      if (!all && score < 40) continue;
    }
    scored.push({ model: m, score });
  }
  if (tokens.length) scored.sort((a, b) => b.score - a.score);
  return { total: scored.length, results: scored.slice(offset, offset + limit).map((s) => s.model) };
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
