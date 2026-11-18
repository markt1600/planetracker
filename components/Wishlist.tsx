"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { estimatePrice, money, WISHLIST_MAX } from "@/lib/format";
import type { CatalogModel } from "@/lib/types";
import PlaneImage from "./PlaneImage";

type Wish = { catalogId: string; addedAt: string; model: CatalogModel };

export default function Wishlist({ wishes, currency, toSGD }: { wishes: Wish[]; currency: string; toSGD: Record<string, number> }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const total = wishes.reduce((sum, w) => sum + (estimatePrice(w.model.prices, currency, toSGD)?.amount ?? 0), 0);

  const remove = async (catalogId: string) => {
    setBusy(catalogId);
    setError("");
    try {
      await api("/api/wishlist", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalogId }) });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        {wishes.map((w, i) => {
          const m = w.model;
          const est = estimatePrice(m.prices, currency, toSGD);
          return (
            <article key={w.catalogId} className="panel rise flex flex-col overflow-hidden">
              <div className="relative">
                <PlaneImage sources={[m.image, m.remoteImage]} alt={m.title} className="aspect-[4/3]" />
                <span className="chip chip-amber absolute left-3 top-3 !bg-night/85">Wish {i + 1}</span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="label truncate">{m.brand} · {m.modelNumber}</p>
                <h2 className="mt-1.5 font-display text-xl leading-tight">{m.airline && m.aircraft ? `${m.airline} ${m.aircraft}` : m.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-mute">{m.title}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="chip">{m.scale}</span>
                  {m.registration && <span className="chip">{m.registration}</span>}
                  {est && <span className="chip chip-amber">{est.converted ? "≈ " : ""}{money(Math.round(est.amount), currency)}</span>}
                </div>
                {est && <p className="mt-2 text-xs text-faint">Price from {est.source}{est.original.inStock === false ? " · currently sold out" : ""}</p>}
                <div className="mt-auto flex gap-2 pt-4">
                  <Link href={`/add?model=${m.id}`} className="btn btn-primary flex-1 !py-2">I got it!</Link>
                  <button className="btn btn-ghost !py-2" disabled={busy === w.catalogId} onClick={() => remove(w.catalogId)}>Remove</button>
                </div>
              </div>
            </article>
          );
        })}
        {Array.from({ length: Math.max(0, WISHLIST_MAX - wishes.length) }, (_, i) => (
          <Link key={i} href="/catalog" className="grid min-h-56 place-items-center rounded-[1.25rem] border border-dashed border-line p-6 text-center text-mute transition hover:border-sky/60 hover:text-ink">
            <span>
              <span className="block text-3xl" aria-hidden>♡</span>
              <span className="mt-2 block text-sm">Empty spot — choose a plane from the catalogue</span>
            </span>
          </Link>
        ))}
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      {wishes.length > 1 && total > 0 && <p className="text-sm text-mute">All {wishes.length} together: about {money(Math.round(total), currency)}.</p>}
    </>
  );
}
