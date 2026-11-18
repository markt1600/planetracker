import Link from "next/link";
import Featured, { type FeaturedPlane } from "@/components/Featured";
import PlaneImage from "@/components/PlaneImage";
import Stats from "@/components/Stats";
import { allModels } from "@/lib/catalog";
import { FACTS } from "@/lib/facts";
import { loadCollection } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { store, models, stats, meta, seed } = await loadCollection();
  const items = store.items;

  if (!items.length) {
    // Nothing in the hangar yet: show off a random catalogue plane that has facts and a photo.
    const pool = allModels().filter((m) => m.image && m.family && FACTS[m.family]);
    const m = pool[seed % pool.length];
    const plane: FeaturedPlane = { ...m, images: [m.image, m.remoteImage], href: `/add?model=${m.id}` };
    return (
      <div className="space-y-8">
        <section className="rise pt-6 text-center sm:pt-10">
          <p className="label">Welcome aboard</p>
          <h1 className="mx-auto mt-3 max-w-2xl font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            {store.settings.owner}&rsquo;s hangar is ready for its first plane.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-mute">
            Pick a model from a catalogue of {meta.count.toLocaleString("en")} die-cast aircraft, or snap a photo and let the AI spotter work out what it is.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/add" className="btn btn-primary">
              + Add the first plane
            </Link>
            <Link href="/catalog" className="btn btn-ghost">
              Browse the catalogue
            </Link>
          </div>
        </section>
        <Featured plane={plane} eyebrow="From the catalogue" seed={seed} />
      </div>
    );
  }

  const item = items[seed % items.length];
  const model = item.catalogId ? models[item.catalogId] : undefined;
  const photos = store.modelPhotos[item.catalogId ?? item.id] ?? [];
  const plane: FeaturedPlane = { ...item, images: [photos[photos.length - 1], model?.image ?? item.image, model?.remoteImage], note: item.notes, href: `/collection?plane=${item.id}` };
  const recent = [...items].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, 4);

  return (
    <div className="space-y-8">
      <Featured plane={plane} eyebrow="Featured from the hangar" seed={seed} />
      <Stats stats={stats} currency={store.settings.currency} />
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-2xl">Latest arrivals</h2>
          <Link href="/collection" className="text-sm text-sky hover:underline">
            See all {items.length} →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {recent.map((r) => {
            const m = r.catalogId ? models[r.catalogId] : undefined;
            const own = store.modelPhotos[r.catalogId ?? r.id] ?? [];
            return (
              <Link key={r.id} href={`/collection?plane=${r.id}`} className="panel group overflow-hidden transition hover:border-sky/60">
                <PlaneImage sources={[own[own.length - 1], m?.image ?? r.image, m?.remoteImage]} alt={r.title} className="aspect-[4/3]" />
                <div className="p-3">
                  <p className="label truncate">{r.brand} · {r.scale}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-snug">{r.title}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
