import "server-only";
import { catalogMeta, getModel } from "./catalog";
import { PREFERRED_SOURCE } from "./format";
import { getRates } from "./fx";
import { collectionStats } from "./stats";
import { readStore } from "./store";
import type { CatalogModel, StoreDoc } from "./types";

/** Catalogue model with the collector's photos and the latest tracked price folded in. */
export function enrich(model: CatalogModel, store: StoreDoc): CatalogModel {
  const history = store.priceHistory[model.id];
  const last = history?.[history.length - 1];
  let prices = model.prices;
  if (last) {
    const rest = (prices ?? []).filter((p) => p.source !== PREFERRED_SOURCE);
    const old = (prices ?? []).find((p) => p.source === PREFERRED_SOURCE);
    prices = [{ ...old, source: PREFERRED_SOURCE, amount: last.amount, currency: last.currency, inStock: last.inStock }, ...rest];
  }
  const userPhotos = store.modelPhotos[model.id] ?? [];
  // Site-added models have no stock photo, so the collector's first photo stands in for it.
  return { ...model, image: model.image ?? userPhotos[0], prices, userPhotos };
}

export async function loadCollection() {
  const [store, fx] = await Promise.all([readStore(), getRates()]);
  const meta = catalogMeta();
  const models: Record<string, CatalogModel> = {};
  for (const item of store.items) {
    const m = item.catalogId ? getModel(item.catalogId, store.customModels) : undefined;
    // Keyed by the id the collection stored, which may be an older id that now points at a merged entry.
    if (m && item.catalogId) models[item.catalogId] = models[m.id] = enrich(m, store);
  }
  const stats = collectionStats(store.items, (id) => models[id], store.settings.currency, fx.toSGD);
  // A fresh number per request drives the rotating featured plane and facts.
  const seed = Math.floor(Math.random() * 1_000_000);
  return { store, meta, models, stats, seed, fx };
}
