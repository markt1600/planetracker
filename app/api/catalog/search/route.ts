import { searchCatalog, type CatalogSort } from "@/lib/catalog";
import { estimatePrice } from "@/lib/format";
import { getRates } from "@/lib/fx";
import { readStore } from "@/lib/store";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const limit = Math.min(Number(p.get("limit")) || 24, 60);
  const offset = Math.max(Number(p.get("offset")) || 0, 0);
  const store = await readStore().catch(() => null);
  const SORTS: CatalogSort[] = ["default", "name", "airline", "price", "number", "brand"];
  const sort = SORTS.find((x) => x === p.get("sort")) ?? "default";
  // Sorting by price compares everything in the display currency, at current exchange rates.
  const currency = store?.settings.currency ?? "SGD";
  const fx = sort === "price" ? await getRates() : null;
  const { total, results } = searchCatalog({
    sort,
    dir: p.get("dir") === "desc" ? "desc" : "asc",
    valueOf: fx ? (m) => estimatePrice(m.prices, currency, fx.toSGD)?.amount ?? null : undefined,
    custom: store?.customModels,
    q: p.get("q") ?? "",
    brand: p.get("brand") || undefined,
    scale: p.get("scale") || undefined,
    family: p.get("family") || undefined,
    airline: p.get("airline") || undefined,
    limit,
    offset,
  });
  const owned = new Set(store?.items.map((i) => i.catalogId));
  const wished = new Set(store?.wishlist.map((w) => w.catalogId));
  return Response.json({
    total,
    results: results.map((m) => { const userPhotos = store?.modelPhotos[m.id] ?? []; return { ...m, image: m.image ?? userPhotos[0], userPhotos, owned: owned.has(m.id), wished: wished.has(m.id) }; }),
  });
}
