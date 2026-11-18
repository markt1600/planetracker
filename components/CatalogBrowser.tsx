"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { estimatePrice, money, shown, WISHLIST_MAX } from "@/lib/format";
import type { CatalogModel } from "@/lib/types";
import PlaneImage from "./PlaneImage";

type Facet = { value: string; n: number };
type Result = CatalogModel & { owned?: boolean; wished?: boolean };
type Wish = { catalogId: string; model: CatalogModel };
const PAGE = 36;

export default function CatalogBrowser({ brands, scales, families, airlines, currency, toSGD }: { brands: Facet[]; scales: Facet[]; families: Facet[]; airlines: Facet[]; currency: string; toSGD: Record<string, number> }) {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [scale, setScale] = useState("");
  const [family, setFamily] = useState("");
  const [airline, setAirline] = useState("");
  const [data, setData] = useState<{ key: string; total: number; results: Result[] }>({ key: "", total: 0, results: [] });
  const [more, setMore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Result | null>(null);
  const [wishes, setWishes] = useState<Wish[] | null>(null);
  const [wishNote, setWishNote] = useState<{ full?: boolean; text?: string }>({});
  const [wishBusy, setWishBusy] = useState(false);

  useEffect(() => {
    api<{ wishlist: Wish[] }>("/api/wishlist").then((d) => setWishes(d.wishlist)).catch(() => setWishes([]));
  }, []);

  const isWished = (id: string) => (wishes ? wishes.some((w) => w.catalogId === id) : false);
  const wish = async (method: "POST" | "DELETE", catalogId: string) => {
    setWishBusy(true);
    try {
      const res = await fetch("/api/wishlist", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalogId }) });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && data.needsPasscode) {
        // Reuse the shared helper so the passcode prompt appears, then try again once.
        const again = await api<{ wishlist: Wish[] }>("/api/wishlist", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalogId }) });
        setWishes(again.wishlist);
        setWishNote({});
      } else if (res.status === 409) {
        setWishes(data.wishlist ?? wishes);
        setWishNote({ full: true });
      } else if (!res.ok) {
        setWishNote({ text: data.error ?? "That didn't work. Try again." });
      } else {
        setWishes(data.wishlist);
        setWishNote(method === "POST" ? { text: "Added to your wishlist." } : wishNote.full ? { text: "Removed. There's room now — add this one." } : {});
      }
    } catch (e) {
      setWishNote({ text: (e as Error).message });
    } finally {
      setWishBusy(false);
    }
  };

  const key = JSON.stringify([q, brand, scale, family, airline]);

  useEffect(() => {
    const ctrl = new AbortController();
    const fresh = data.key !== key;
    const offset = fresh ? 0 : data.results.length;
    if (!fresh && more === 0) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q, brand, scale, family, airline, limit: String(PAGE), offset: String(offset) });
        const res = await api<{ total: number; results: Result[] }>(`/api/catalog/search?${params}`, { signal: ctrl.signal });
        setData((d) => ({ key, total: res.total, results: fresh ? res.results : [...d.results, ...res.results] }));
        setLoading(false);
      } catch {
        /* superseded */
      }
    }, fresh ? 200 : 0);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, more]);

  const select = (label: string, value: string, set: (v: string) => void, options: Facet[]) => (
    <select className="field sm:!w-auto sm:max-w-[11rem]" value={value} onChange={(e) => set(e.target.value)} aria-label={label}>
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.value} ({o.n})
        </option>
      ))}
    </select>
  );

  return (
    <>
      <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
        <input className="field col-span-2 min-w-0 sm:!w-auto sm:flex-1 sm:basis-64" placeholder="Search airline, type, model number, registration…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the catalogue" />
        {select("All manufacturers", brand, setBrand, brands)}
        {select("All scales", scale, setScale, scales)}
        {select("All aircraft", family, setFamily, families)}
        <div className="relative col-span-2 sm:col-span-1 sm:w-56">
          <input className="field pr-8" list="catalogue-airlines" placeholder="Any airline" value={airline} onChange={(e) => setAirline(e.target.value)} aria-label="Airline" autoComplete="off" />
          {airline && (
            <button type="button" onClick={() => setAirline("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-1.5 text-mute hover:text-ink" aria-label="Clear airline">✕</button>
          )}
          <datalist id="catalogue-airlines">
            {airlines.map((a) => (
              <option key={a.value} value={a.value}>{`${a.n} models`}</option>
            ))}
          </datalist>
        </div>
      </div>
      <p className="label mt-4">{data.key === key ? `${data.total.toLocaleString("en")} models` : "Searching…"}</p>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {data.results.map((m) => {
          const est = estimatePrice(m.prices, currency, toSGD);
          return (
            <button key={m.id} onClick={() => { setOpen(m); setWishNote({}); }} className="panel overflow-hidden text-left transition hover:-translate-y-0.5 hover:border-sky/60">
              <div className="relative">
                <PlaneImage sources={[m.image, m.remoteImage]} alt={m.title} className="aspect-[4/3]" />
                {m.owned && <span className="chip chip-amber absolute left-2 top-2 !bg-night/85">In hangar</span>}
                {(wishes ? isWished(m.id) : m.wished) && <span className="chip absolute right-2 top-2 !border-sky/60 !bg-night/85 !text-sky">♥ Wishlist</span>}
              </div>
              <div className="p-3">
                <p className="label truncate">{m.brand} · {m.modelNumber}</p>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm leading-snug">{m.title}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="chip">{m.scale}</span>
                  <span className="font-mono text-xs text-amber">{est ? `${est.converted ? "≈ " : ""}${money(Math.round(est.amount), currency)}` : ""}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {data.key === key && !data.results.length && !loading && <p className="mt-10 text-center text-mute">Nothing in the catalogue matches. You can still <Link href="/add" className="text-sky underline">add it by hand</Link>.</p>}
      {data.key === key && data.results.length < data.total && (
        <div className="mt-6 text-center">
          <button className="btn btn-ghost" disabled={loading} onClick={() => setMore((n) => n + 1)}>
            {loading ? "Loading…" : `Show more (${(data.total - data.results.length).toLocaleString("en")} left)`}
          </button>
        </div>
      )}

      <p className="mt-10 border-t border-line pt-5 text-center text-sm text-mute">
        Know a model that isn&rsquo;t listed?{" "}
        <Link href="/catalog/new" className="text-sky underline-offset-4 hover:underline">
          Add it to the catalogue
        </Link>{" "}
        — it won&rsquo;t be added to the collection.
      </p>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-night/85 backdrop-blur-sm sm:p-6" onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label={open.title}>
          <button onClick={() => setOpen(null)} className="fixed right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-line bg-night/90 text-lg text-ink md:hidden" aria-label="Close">✕</button>
          <div className="panel rise mx-auto max-w-3xl !rounded-none !bg-panel sm:!rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="grid md:grid-cols-2">
              <div>
                <PlaneImage sources={[open.image, open.remoteImage]} alt={open.title} className="aspect-[4/3] sm:rounded-tl-3xl" />
                {open.gallery && open.gallery.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 pb-0">
                    {open.gallery.map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer">
                        <PlaneImage sources={[u]} alt="More views" fit="cover" className="h-16 w-20 rounded-lg" />
                      </a>
                    ))}
                  </div>
                )}
                {open.userPhotos && open.userPhotos.length > 0 && (
                  <div className="p-3">
                    <p className="label">Collector photos</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {open.userPhotos.map((u) => (
                        <a key={u} href={u} target="_blank" rel="noreferrer">
                          <PlaneImage sources={[u]} alt="Collector photo" fit="cover" className="h-16 w-20 rounded-lg" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <p className="label">{open.line ?? open.brand} · {open.modelNumber}</p>
                  <button onClick={() => setOpen(null)} className="-mr-1 -mt-1 rounded-full p-1.5 text-mute hover:bg-raised hover:text-ink" aria-label="Close">✕</button>
                </div>
                <h2 className="mt-1.5 font-display text-2xl leading-tight">{open.title}</h2>
                <dl className="mt-4 space-y-1.5 font-mono text-xs">
                  {[["Manufacturer", open.brand], ["Model number", open.modelNumber], ["Scale", open.scale], ["Airline", open.airline], ["Aircraft", open.aircraft], ["Family", open.family], ["Registration", open.registration], ["Details", open.notes]].filter((r) => r[1]).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-line/60 pb-1.5">
                      <dt className="text-mute">{k}</dt>
                      <dd className="text-right">{v}</dd>
                    </div>
                  ))}
                </dl>
                {open.description && <p className="mt-3 text-sm text-mute">{open.description}</p>}
                {open.prices && open.prices.length > 0 && (
                  <div className="mt-4">
                    <p className="label">Prices</p>
                    <ul className="mt-1.5 space-y-1 text-sm">
                      {open.prices.map((p) => (
                        <li key={p.source} className="flex justify-between gap-3">
                          <a href={p.url} target="_blank" rel="noreferrer" className="truncate text-sky hover:underline">{p.source}</a>
                          <span className="font-mono text-xs text-mute">{shown(p.amount, p.currency, currency, toSGD)}{p.inStock === false && " · sold out"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-auto space-y-2 pt-6">
                  {wishNote.full && wishes && (
                    <div className="rounded-xl border border-amber/40 bg-amber/10 p-3">
                      <p className="text-sm text-amber">Your wishlist is full ({WISHLIST_MAX} planes). Remove one to make room for this one.</p>
                      <ul className="mt-2 space-y-1.5">
                        {wishes.map((w) => (
                          <li key={w.catalogId} className="flex items-center gap-2 text-sm">
                            <PlaneImage sources={[w.model.image, w.model.remoteImage]} alt="" className="h-8 w-11 shrink-0 rounded" />
                            <span className="min-w-0 flex-1 truncate">{w.model.title}</span>
                            <button className="shrink-0 text-xs text-bad hover:underline" disabled={wishBusy} onClick={() => wish("DELETE", w.catalogId)}>Remove</button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {wishNote.text && <p className="text-sm text-mute" role="status">{wishNote.text}</p>}
                  <Link href={`/add?model=${open.id}`} className="btn btn-primary w-full">
                    {open.owned ? "+ Add another copy" : "+ Add to my collection"}
                  </Link>
                  {isWished(open.id) ? (
                    <button className="btn btn-ghost w-full" disabled={wishBusy} onClick={() => wish("DELETE", open.id)}>♥ On your wishlist — remove</button>
                  ) : (
                    <button className="btn btn-ghost w-full" disabled={wishBusy || !wishes} onClick={() => wish("POST", open.id)}>
                      ♡ Add to wishlist{wishes ? ` (${wishes.length}/${WISHLIST_MAX})` : ""}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
