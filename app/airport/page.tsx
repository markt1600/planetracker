import type { Metadata } from "next";
import Airport from "@/components/Airport";
import type { Exhibit } from "@/components/plane3d";
import ViewSwitch from "@/components/ViewSwitch";
import { estimatePrice, money } from "@/lib/format";
import { loadCollection } from "@/lib/view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Airport" };

export default async function AirportPage() {
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
          <p className="label">On the apron</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">Changi apron</h1>
        </div>
        <ViewSwitch current="airport" />
      </header>
      <Airport exhibits={exhibits} />
    </div>
  );
}
