import type { Metadata } from "next";
import Link from "next/link";
import CatalogBrowser from "@/components/CatalogBrowser";
import { catalogMeta, facets } from "@/lib/catalog";
import { WISHLIST_MAX } from "@/lib/format";
import { getRates } from "@/lib/fx";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Catalogue" };

export default async function CatalogPage() {
  const meta = catalogMeta();
  const f = facets();
  const [store, fx] = await Promise.all([readStore(), getRates()]);
  return (
    <div className="space-y-5">
      <header className="rise">
        <p className="label">Reference · updated {meta.builtAt}</p>
        <h1 className="mt-1 font-display text-4xl tracking-tight">The catalogue</h1>
        <p className="mt-2 max-w-2xl text-mute">
          {meta.count.toLocaleString("en")} die-cast models from {meta.brands.length} manufacturers, including {meta.brands.slice(0, 8).join(", ")}.
        </p>
        <Link href="/wishlist" className="btn btn-ghost mt-4 !py-2">
          ♡ Wishlist ({store.wishlist.length}/{WISHLIST_MAX})
        </Link>
      </header>
      <CatalogBrowser brands={f.brands} scales={f.scales} families={f.families} airlines={f.airlines} currency={store.settings.currency} toSGD={fx.toSGD} />
    </div>
  );
}
