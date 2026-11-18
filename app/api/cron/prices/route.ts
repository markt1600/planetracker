import { allModels } from "@/lib/catalog";
import { PREFERRED_SOURCE } from "@/lib/format";
import { isAuthed, passcodeEnabled } from "@/lib/auth";
import { updateStore } from "@/lib/store";

export const maxDuration = 300;

type StoreProduct = { name: string; sku: string; is_in_stock: boolean; prices: { price: string; currency_code: string; currency_minor_unit: number } };

const squash = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Price tracker. Runs on a schedule (see vercel.json) and can be triggered from the site.
 * Looks up today's Airplane Model SG price for every plane in the collection and appends it to that
 * model's price history. Models the shop no longer lists keep their last known price.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const fromCron = Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!fromCron && (secret || passcodeEnabled()) && !(await isAuthed())) {
    return Response.json({ error: "Not allowed" }, { status: 401 });
  }

  const live = new Map<string, { amount: number; currency: string; inStock: boolean }>();
  for (let page = 1; page <= 40; page++) {
    const res = await fetch(`https://www.airplanemodelsg.com/wp-json/wc/store/v1/products?per_page=100&page=${page}`, { cache: "no-store" });
    if (!res.ok) break;
    const products = (await res.json()) as StoreProduct[];
    for (const p of products) {
      const amount = Number(p.prices.price) / 10 ** p.prices.currency_minor_unit;
      if (!(amount > 0)) continue;
      const entry = { amount, currency: p.prices.currency_code, inStock: p.is_in_stock };
      live.set(squash(p.name.split(" ")[0]), entry);
      if (/[a-z]/i.test(p.sku)) live.set(squash(p.sku), entry);
    }
    if (products.length < 100) break;
  }
  if (!live.size) return Response.json({ error: "Could not reach the price source" }, { status: 502 });

  const numberById = new Map(allModels().map((m) => [m.id, squash(m.modelNumber)]));
  const today = new Date().toISOString().slice(0, 10);
  const updated = await updateStore((doc) => {
    let n = 0;
    for (const id of new Set(doc.items.map((i) => i.catalogId).filter(Boolean) as string[])) {
      const hit = live.get(numberById.get(id) ?? "");
      if (!hit) continue;
      const history = (doc.priceHistory[id] ??= []);
      const last = history[history.length - 1];
      if (last?.date === today) history.pop();
      // Only record a new point when something changed, but always keep the first one.
      const prev = history[history.length - 1];
      if (!prev || prev.amount !== hit.amount || prev.inStock !== hit.inStock) history.push({ date: today, ...hit });
      doc.priceHistory[id] = history.slice(-120);
      n++;
    }
    doc.pricesCheckedAt = new Date().toISOString();
    return n;
  });
  return Response.json({ ok: true, source: PREFERRED_SOURCE, listed: live.size, tracked: updated });
}
