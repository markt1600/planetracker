import type { Metadata } from "next";
import Link from "next/link";
import Wishlist from "@/components/Wishlist";
import { getModel } from "@/lib/catalog";
import { WISHLIST_MAX } from "@/lib/format";
import { enrich, loadCollection } from "@/lib/view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const { store, fx } = await loadCollection();
  const wishes = store.wishlist.flatMap((w) => {
    const model = getModel(w.catalogId, store.customModels);
    return model ? [{ ...w, model: enrich(model, store) }] : [];
  });
  return (
    <div className="space-y-6">
      <header className="rise">
        <p className="label">Next for the hangar</p>
        <h1 className="mt-1 font-display text-4xl tracking-tight">Wishlist</h1>
        <p className="mt-2 max-w-2xl text-mute">
          Up to {WISHLIST_MAX} planes {store.settings.owner} wants most. To add another, one has to come off. Pick them from the{" "}
          <Link href="/catalog" className="text-sky underline-offset-4 hover:underline">catalogue</Link>.
        </p>
      </header>
      <Wishlist wishes={wishes} currency={store.settings.currency} toSGD={fx.toSGD} />
    </div>
  );
}
