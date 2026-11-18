import type { Metadata } from "next";
import Museum, { type Exhibit } from "@/components/Museum";
import { estimatePrice, money } from "@/lib/format";
import { loadCollection } from "@/lib/view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Museum" };

export default async function MuseumPage() {
  const { store, models, fx } = await loadCollection();
  const currency = store.settings.currency;
  const exhibits: Exhibit[] = store.items.map((i) => {
    const m = i.catalogId ? models[i.catalogId] : undefined;
    const own = store.modelPhotos[i.catalogId ?? i.id] ?? [];
    const est = estimatePrice(m?.prices, currency, fx.toSGD);
    return {
      id: i.id,
      title: i.title,
      brand: i.brand,
      modelNumber: i.modelNumber,
      scale: i.scale,
      airline: i.airline,
      aircraft: i.aircraft,
      family: i.family,
      registration: i.registration,
      notes: i.notes,
      images: [own[own.length - 1], m?.image ?? i.image, m?.remoteImage],
      value: est ? money(Math.round(est.amount), currency) : undefined,
    };
  });
  return (
    <div className="space-y-4">
      <header className="rise flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="label">Gallery</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">The museum hall</h1>
        </div>
        <p className="text-sm text-mute">{exhibits.length} {exhibits.length === 1 ? "exhibit" : "exhibits"} on display</p>
      </header>
      <Museum exhibits={exhibits} />
    </div>
  );
}
