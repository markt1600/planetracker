import type { Metadata } from "next";
import Link from "next/link";
import NewModel from "@/components/NewModel";
import { catalogMeta, facets } from "@/lib/catalog";
import { FACTS } from "@/lib/facts";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add to the catalogue" };

export default async function NewModelPage() {
  const store = await readStore();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="rise">
        <Link href="/catalog" className="text-sm text-mute hover:text-ink">← Back to the catalogue</Link>
        <h1 className="mt-2 font-display text-4xl tracking-tight">Add a model to the catalogue</h1>
        <p className="mt-2 text-mute">For models the catalogue doesn&rsquo;t know yet. This only adds it to the reference list — not to {store.settings.owner}&rsquo;s collection.</p>
      </header>
      <NewModel brands={catalogMeta().brands} scales={facets().scales.map((s) => s.value)} families={Object.keys(FACTS)} currency={store.settings.currency} />
    </div>
  );
}
