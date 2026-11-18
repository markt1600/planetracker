import { convert, estimatePrice } from "./format";
import type { CatalogModel, CollectionItem } from "./types";

export type Tally = { label: string; n: number };

const tally = (values: (string | undefined)[]): Tally[] => {
  const map = new Map<string, number>();
  for (const v of values) if (v) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
};

export function collectionStats(items: CollectionItem[], lookup: (id: string) => CatalogModel | undefined, currency: string, toSGD: Record<string, number>) {
  let paid = 0;
  let paidCount = 0;
  let market = 0;
  let marketCount = 0;
  let topValue: { item: CollectionItem; amount: number } | null = null;
  for (const item of items) {
    const p = item.pricePaid != null ? convert(item.pricePaid, item.currency, currency, toSGD) : null;
    if (p != null) {
      paid += p;
      paidCount++;
    }
    const est = item.catalogId ? estimatePrice(lookup(item.catalogId)?.prices, currency, toSGD) : null;
    // Fall back to what was paid when no retailer lists the model any more.
    const value = est?.amount ?? p;
    if (value != null) {
      market += value;
      marketCount++;
      if (!topValue || value > topValue.amount) topValue = { item, amount: value };
    }
  }
  const airlines = tally(items.map((i) => i.airline));
  const families = tally(items.map((i) => i.family));
  const types = tally(items.map((i) => i.aircraft?.toUpperCase()));
  return {
    count: items.length,
    paid,
    paidCount,
    market,
    marketCount,
    topValue,
    airlines,
    families,
    types,
    brands: tally(items.map((i) => i.brand)),
    scales: tally(items.map((i) => i.scale)),
    registrations: new Set(items.map((i) => i.registration).filter(Boolean)).size,
    newest: [...items].sort((a, b) => b.addedAt.localeCompare(a.addedAt))[0] ?? null,
  };
}

export type CollectionStats = ReturnType<typeof collectionStats>;
