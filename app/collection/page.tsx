import type { Metadata } from "next";
import CollectionView from "@/components/CollectionView";
import Stats from "@/components/Stats";
import { loadCollection } from "@/lib/view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Collection" };

export default async function CollectionPage({ searchParams }: PageProps<"/collection">) {
  const { plane, from } = await searchParams;
  // Where "full details" was opened from, so closing it goes back there.
  const returnTo = from === "airport" || from === "museum" ? from : undefined;
  const { store, models, stats, fx } = await loadCollection();
  return (
    <div className="space-y-6">
      <header className="rise">
        <p className="label">The collection</p>
        <h1 className="mt-1 font-display text-4xl tracking-tight">{store.settings.owner}&rsquo;s fleet</h1>
      </header>
      <Stats stats={stats} currency={store.settings.currency} detailed />
      <section>
        <CollectionView items={store.items} models={models} photos={store.modelPhotos} history={store.priceHistory} currency={store.settings.currency} toSGD={fx.toSGD} openId={typeof plane === "string" ? plane : undefined} returnTo={returnTo} pricesCheckedAt={store.pricesCheckedAt} />
      </section>
    </div>
  );
}
