import { searchCatalog } from "@/lib/catalog";
import { readStore } from "@/lib/store";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const limit = Math.min(Number(p.get("limit")) || 24, 60);
  const offset = Math.max(Number(p.get("offset")) || 0, 0);
  const { total, results } = searchCatalog({
    q: p.get("q") ?? "",
    brand: p.get("brand") || undefined,
    scale: p.get("scale") || undefined,
    family: p.get("family") || undefined,
    limit,
    offset,
  });
  const store = await readStore().catch(() => null);
  const owned = new Set(store?.items.map((i) => i.catalogId));
  return Response.json({
    total,
    results: results.map((m) => ({ ...m, userPhotos: store?.modelPhotos[m.id] ?? [], owned: owned.has(m.id) })),
  });
}
