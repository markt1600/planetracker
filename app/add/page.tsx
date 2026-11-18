import type { Metadata } from "next";
import AddPlane from "@/components/AddPlane";
import { catalogMeta, facets, getModel } from "@/lib/catalog";
import { readStore } from "@/lib/store";
import { getRates } from "@/lib/fx";
import { enrich } from "@/lib/view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add a plane" };

export default async function AddPage({ searchParams }: PageProps<"/add">) {
  const { model } = await searchParams;
  const [store, fx] = await Promise.all([readStore(), getRates()]);
  const meta = catalogMeta();
  const found = typeof model === "string" ? getModel(model) : undefined;
  return (
    <div className="space-y-6">
      <header className="rise text-center">
        <p className="label">New arrival</p>
        <h1 className="mt-1 font-display text-4xl tracking-tight">Add a plane</h1>
      </header>
      <AddPlane brands={meta.brands} scales={facets().scales.map((s) => s.value)} currency={store.settings.currency} toSGD={fx.toSGD} initial={found ? enrich(found, store) : null} aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)} />
    </div>
  );
}
