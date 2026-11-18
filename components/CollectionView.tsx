"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, shrinkImage, uploadPhoto } from "@/lib/client";
import { dimensions, factsFor, modelSize } from "@/lib/facts";
import { convert, CURRENCIES, estimatePrice, money, shown as showPrice } from "@/lib/format";
import type { CatalogModel, CollectionItem, PricePoint } from "@/lib/types";
import PlaneImage from "./PlaneImage";

type Props = {
  items: CollectionItem[];
  models: Record<string, CatalogModel>;
  photos: Record<string, string[]>;
  history: Record<string, PricePoint[]>;
  currency: string;
  toSGD: Record<string, number>;
  openId?: string;
  pricesCheckedAt?: string;
};

const SORTS = { newest: "Newest first", name: "Name A–Z", airline: "Airline A–Z", type: "Aircraft type", scale: "Scale", value: "Highest value", paid: "Highest price paid", brand: "Manufacturer", number: "Model number" } as const;

function Sparkline({ points }: { points: PricePoint[] }) {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.amount);
  const min = Math.min(...xs);
  const span = Math.max(...xs) - min || 1;
  const d = points.map((p, i) => `${i ? "L" : "M"}${(i / (points.length - 1)) * 100},${28 - ((p.amount - min) / span) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-10 w-full" aria-hidden>
      <path d={d} fill="none" stroke="var(--color-sky)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Detail({ item, model, photos, history, currency, toSGD, onClose }: { item: CollectionItem; model?: CatalogModel; photos: string[]; history: PricePoint[]; currency: string; toSGD: Record<string, number>; onClose: () => void }) {
  const router = useRouter();
  const gallery = [...[...photos].reverse().map((url) => ({ url, own: true })), ...(model?.image || item.image ? [{ url: (model?.image ?? item.image)!, own: false }] : [])];
  const [shown, setShown] = useState(0);
  const [price, setPrice] = useState(item.pricePaid != null ? String(item.pricePaid) : "");
  const [cur, setCur] = useState(item.currency);
  const [date, setDate] = useState(item.acquiredAt ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const base = { title: item.title, brand: item.brand, modelNumber: item.modelNumber, scale: item.scale, airline: item.airline ?? "", aircraft: item.aircraft ?? "", registration: item.registration ?? "" };
  const [info, setInfo] = useState(base);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const f = factsFor(item.family);
  const size = modelSize(item.family, item.scale, item.aircraft);
  const dim = dimensions(item.family, item.aircraft);
  const est = estimatePrice(model?.prices, currency, toSGD);
  const dirty = price !== (item.pricePaid != null ? String(item.pricePaid) : "") || cur !== item.currency || date !== (item.acquiredAt ?? "") || notes !== (item.notes ?? "") || JSON.stringify(info) !== JSON.stringify(base);
  const key = item.catalogId ?? item.id;
  const current = gallery[Math.min(shown, gallery.length - 1)];

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-night/85 p-0 backdrop-blur-sm sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={item.title}>
      <div className="panel rise mx-auto max-w-4xl !rounded-none !bg-panel sm:!rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="grid md:grid-cols-2">
          <div>
            <div className="relative">
              <PlaneImage sources={[current?.url, model?.remoteImage]} alt={item.title} fit={current?.own ? "cover" : "contain"} className="aspect-[4/3] sm:rounded-tl-3xl" />
              {current && <span className="chip absolute left-3 top-3 !bg-night/85">{current.own ? "Your photo" : "Stock photo"}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2 p-3">
              {gallery.map((g, i) => (
                <button key={g.url} onClick={() => setShown(i)} className={`overflow-hidden rounded-lg border-2 ${i === shown ? "border-amber" : "border-transparent"}`} aria-label={g.own ? "Your photo" : "Stock photo"}>
                  <PlaneImage sources={[g.url]} alt="" fit="cover" className="h-12 w-16" />
                </button>
              ))}
              <label className="btn btn-ghost cursor-pointer !px-3 !py-2 text-xs">
                {busy === "photo" ? "Uploading…" : "+ Add my photo"}
                <input type="file" accept="image/*" className="sr-only" disabled={!!busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) run("photo", async () => { await uploadPhoto(key, await shrinkImage(file, 1600)); setShown(0); }); e.target.value = ""; }} />
              </label>
              {current?.own && (
                <button className="text-xs text-mute hover:text-bad" disabled={!!busy} onClick={() => run("photo", async () => { await api("/api/photos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, url: current.url }) }); setShown(0); })}>
                  Remove this photo
                </button>
              )}
            </div>
            {f && (
              <div className="border-t border-line p-5">
                <p className="label !text-amber">About the real {dim?.variant ?? f.variant}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs">
                  {[["Length", `${dim?.lengthM ?? f.lengthM} m`], ["Wingspan", `${dim?.wingspanM ?? f.wingspanM} m`], ["Range", f.rangeKm ? `${f.rangeKm.toLocaleString("en")} km` : null], ["Seats", f.seats], ["First flight", String(f.firstFlight)], ["Engines", f.engines], ["Model size", size ? `${size.lengthCm.toFixed(1)} × ${size.wingspanCm.toFixed(1)} cm` : null]].filter((r) => r[1]).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2 border-b border-line/60 pb-1.5">
                      <dt className="text-mute">{k}</dt>
                      <dd className="text-right">{v}</dd>
                    </div>
                  ))}
                </dl>
                <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm text-ink/85 marker:text-amber">
                  {f.facts.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-col border-t border-line p-5 sm:p-6 md:border-l md:border-t-0">
            <div className="flex items-start justify-between gap-3">
              <p className="label">{item.brand} · {item.modelNumber}</p>
              <button onClick={onClose} className="-mr-1 -mt-1 rounded-full p-1.5 text-mute hover:bg-raised hover:text-ink" aria-label="Close">✕</button>
            </div>
            <h2 className="mt-1.5 font-display text-2xl leading-tight">{item.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip">{item.scale}</span>
              {item.airline && <span className="chip">{item.airline}</span>}
              {item.aircraft && <span className="chip">{item.aircraft}</span>}
              {item.registration && <span className="chip">{item.registration}</span>}
              {!item.catalogId && <span className="chip chip-amber">Custom entry</span>}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line p-3">
                <p className="label">Market price</p>
                <p className="mt-1 font-display text-xl">{est ? money(est.amount, currency) : "—"}</p>
                <p className="mt-0.5 text-xs text-mute">{est ? `${est.source}${est.converted ? " (converted)" : ""}` : "No retailer lists it"}</p>
              </div>
              <div className="rounded-xl border border-line p-3">
                <p className="label">You paid</p>
                <p className="mt-1 font-display text-xl">{item.pricePaid != null ? showPrice(item.pricePaid, item.currency, currency, toSGD, false) : "—"}</p>
                {est && item.pricePaid != null && (() => { const paid = convert(item.pricePaid, item.currency, currency, toSGD); if (paid == null) return null; const diff = est.amount - paid; return <p className={`mt-0.5 text-xs ${diff >= 0 ? "text-good" : "text-bad"}`}>{diff >= 0 ? "▲" : "▼"} {money(Math.abs(Math.round(diff)), currency)} vs. market</p>; })()}
              </div>
            </div>
            {model?.prices && (
              <ul className="mt-3 space-y-1 text-sm">
                {model.prices.map((p) => (
                  <li key={p.source} className="flex justify-between gap-3">
                    <a href={p.url} target="_blank" rel="noreferrer" className="truncate text-sky hover:underline">{p.source}</a>
                    <span className="font-mono text-xs text-mute">{showPrice(p.amount, p.currency, currency, toSGD)}{p.inStock === false && " · sold out"}</span>
                  </li>
                ))}
              </ul>
            )}
            {history.length > 0 && (
              <div className="mt-3 rounded-xl border border-line p-3">
                <p className="label">Tracked price · {history.length} {history.length === 1 ? "reading" : "readings"} since {history[0].date}</p>
                <Sparkline points={history} />
              </div>
            )}

            <form className="mt-5 space-y-3 border-t border-line pt-5" onSubmit={(e) => { e.preventDefault(); const n = price.trim() === "" ? null : Number(price); if (n != null && Number.isNaN(n)) return setError("The price should be a number"); run("save", () => api(`/api/collection/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...info, pricePaid: n, currency: cur, acquiredAt: date || null, notes: notes || null }) })); }}>
              <div className="grid grid-cols-[1fr_6rem_9.5rem] gap-2">
                <label><span className="label">Price paid</span><input className="field mt-1" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" /></label>
                <label><span className="label">&nbsp;</span><select className="field mt-1" value={cur} onChange={(e) => setCur(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
                <label><span className="label">Date</span><input className="field mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
              </div>
              <label className="block"><span className="label">My notes (private)</span><textarea className="field mt-1 min-h-20" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Missing box, damaged wheel, where it came from…" /></label>
              <details className="rounded-xl border border-line p-3">
                <summary className="label cursor-pointer select-none">Edit plane details</summary>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {([["title", "Description", "col-span-2"], ["brand", "Manufacturer", ""], ["modelNumber", "Model number", ""], ["scale", "Scale", ""], ["registration", "Registration", ""], ["airline", "Airline", ""], ["aircraft", "Aircraft type", ""]] as const).map(([k, label, span]) => (
                    <label key={k} className={span}>
                      <span className="label">{label}</span>
                      <input className="field mt-1" value={info[k]} required={["title", "brand", "modelNumber", "scale"].includes(k)} pattern={k === "scale" ? "1:\\d{1,4}" : undefined} onChange={(e) => setInfo({ ...info, [k]: e.target.value })} />
                    </label>
                  ))}
                </div>
              </details>
              {error && <p className="text-sm text-bad">{error}</p>}
              <div className="flex items-center justify-between gap-2">
                {confirmDelete ? (
                  <span className="flex items-center gap-2 text-sm">
                    Remove from collection?
                    <button type="button" className="btn btn-danger !py-1.5" disabled={!!busy} onClick={() => run("delete", async () => { await api(`/api/collection/${item.id}`, { method: "DELETE" }); onClose(); })}>Yes, remove</button>
                    <button type="button" className="text-mute" onClick={() => setConfirmDelete(false)}>Keep</button>
                  </span>
                ) : (
                  <button type="button" className="text-sm text-mute hover:text-bad" onClick={() => setConfirmDelete(true)}>Remove plane</button>
                )}
                <button className="btn btn-primary" disabled={!dirty || !!busy}>{busy === "save" ? "Saving…" : "Save changes"}</button>
              </div>
            </form>
            <p className="mt-4 text-xs text-faint">Added {new Date(item.addedAt).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CollectionView({ items, models, photos, history, currency, toSGD, openId, pricesCheckedAt }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState<keyof typeof SORTS>("newest");
  const [open, setOpen] = useState<string | null>(openId ?? null);
  const [checking, setChecking] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [removing, setRemoving] = useState<string | null>(null);

  const valueOf = (i: CollectionItem) => estimatePrice(i.catalogId ? models[i.catalogId]?.prices : undefined, currency, toSGD)?.amount ?? (i.pricePaid != null ? convert(i.pricePaid, i.currency, currency, toSGD) : null);
  const brands = useMemo(() => [...new Set(items.map((i) => i.brand))].sort(), [items]);
  const shown = useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = items.filter((i) => {
      if (brand && i.brand !== brand) return false;
      const hay = [i.brand, i.modelNumber, i.title, i.airline, i.aircraft, i.registration, i.notes].join(" ").toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
    type Cmp = (a: CollectionItem, b: CollectionItem) => number;
    const text = (get: (i: CollectionItem) => string | undefined): Cmp => (a, b) => (get(a) ?? "~").localeCompare(get(b) ?? "~", "en", { numeric: true }) || a.title.localeCompare(b.title);
    const paid = (i: CollectionItem) => (i.pricePaid != null ? convert(i.pricePaid, i.currency, currency, toSGD) ?? 0 : -1);
    const by: Record<keyof typeof SORTS, Cmp> = {
      newest: (a, b) => b.addedAt.localeCompare(a.addedAt),
      name: text((i) => i.title),
      airline: text((i) => i.airline),
      type: text((i) => i.aircraft),
      scale: text((i) => i.scale),
      value: (a, b) => (valueOf(b) ?? -1) - (valueOf(a) ?? -1),
      paid: (a, b) => paid(b) - paid(a),
      brand: text((i) => i.brand),
      number: text((i) => i.modelNumber),
    };
    return list.sort(by[sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, brand, sort, models, currency]);

  const openItem = items.find((i) => i.id === open);
  const close = () => { setOpen(null); window.history.replaceState(null, "", "/collection"); };

  if (!items.length) {
    return (
      <div className="panel p-10 text-center">
        <h2 className="font-display text-2xl">The hangar is empty</h2>
        <p className="mt-2 text-mute">Add your first plane and it will show up here.</p>
        <Link href="/add" className="btn btn-primary mt-5">+ Add a plane</Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input className="field !w-auto min-w-0 flex-1 basis-56" placeholder="Search your planes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search your planes" />
        <select className="field !w-auto" value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Manufacturer">
          <option value="">All manufacturers</option>
          {brands.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select className="field !w-auto" value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} aria-label="Sort">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex rounded-full border border-line p-0.5 text-sm" role="group" aria-label="View">
          {(["grid", "list"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`rounded-full px-3 py-1.5 capitalize ${view === v ? "bg-raised text-ink" : "text-mute"}`}>{v}</button>
          ))}
        </div>
        <Link href="/museum" className="btn btn-ghost !py-2">Walk the museum →</Link>
      </div>

      {view === "list" && (
        <div className="panel mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                {([["name", "Plane"], ["airline", "Airline"], ["type", "Type"], ["scale", "Scale"], ["paid", "Paid"], ["value", "Value"]] as const).map(([k, label]) => (
                  <th key={k} className="px-3 py-2.5 font-normal">
                    <button onClick={() => setSort(k)} className={`label hover:text-ink ${sort === k ? "!text-amber" : ""}`}>{label}{sort === k ? " ↓" : ""}</button>
                  </th>
                ))}
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => {
                const m = i.catalogId ? models[i.catalogId] : undefined;
                const own = photos[i.catalogId ?? i.id] ?? [];
                const v = valueOf(i);
                return (
                  <tr key={i.id} className="border-b border-line/50 last:border-0 hover:bg-raised/40">
                    <td className="px-3 py-2">
                      <button onClick={() => setOpen(i.id)} className="flex items-center gap-3 text-left">
                        <PlaneImage sources={[own[own.length - 1], m?.image ?? i.image, m?.remoteImage]} alt="" fit={own.length ? "cover" : "contain"} className="h-10 w-14 shrink-0 rounded-md" />
                        <span>
                          <span className="line-clamp-1">{i.title}</span>
                          <span className="block font-mono text-xs text-mute">{i.brand} · {i.modelNumber}{i.registration ? ` · ${i.registration}` : ""}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-mute">{i.airline ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{i.aircraft ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{i.scale}</td>
                    <td className="px-3 py-2 font-mono text-xs">{i.pricePaid != null ? showPrice(i.pricePaid, i.currency, currency, toSGD, false) : "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-amber">{v != null ? money(Math.round(v), currency) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                      {removing === i.id ? (
                        <>
                          <button className="text-bad" onClick={async () => { try { await api(`/api/collection/${i.id}`, { method: "DELETE" }); router.refresh(); } catch (e) { setChecking((e as Error).message); } setRemoving(null); }}>Confirm delete</button>
                          <button className="ml-3 text-mute" onClick={() => setRemoving(null)}>Keep</button>
                        </>
                      ) : (
                        <>
                          <button className="text-sky hover:underline" onClick={() => setOpen(i.id)}>Edit</button>
                          <button className="ml-3 text-mute hover:text-bad" onClick={() => setRemoving(i.id)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={`mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 ${view === "list" ? "hidden" : ""}`}>
        {shown.map((i) => {
          const m = i.catalogId ? models[i.catalogId] : undefined;
          const own = photos[i.catalogId ?? i.id] ?? [];
          const v = valueOf(i);
          return (
            <button key={i.id} onClick={() => setOpen(i.id)} className="panel group overflow-hidden text-left transition hover:-translate-y-0.5 hover:border-sky/60">
              <PlaneImage sources={[own[own.length - 1], m?.image ?? i.image, m?.remoteImage]} alt={i.title} fit={own.length ? "cover" : "contain"} className="aspect-[4/3]" />
              <div className="p-3">
                <p className="label truncate">{i.brand} · {i.modelNumber}</p>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm leading-snug">{i.title}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="chip">{i.scale}</span>
                  <span className="font-mono text-xs text-amber">{v != null ? money(Math.round(v), currency) : ""}</span>
                </div>
                {i.notes && <p className="mt-2 truncate text-xs italic text-mute">“{i.notes}”</p>}
              </div>
            </button>
          );
        })}
      </div>
      {!shown.length && <p className="mt-8 text-center text-mute">No planes match that search.</p>}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs text-faint">
        <span>{pricesCheckedAt ? `Prices last checked ${new Date(pricesCheckedAt).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}.` : "Prices are checked automatically once a day."} {checking}</span>
        <button className="btn btn-ghost !py-1.5 text-xs" disabled={checking === "Checking…"} onClick={async () => { setChecking("Checking…"); try { const r = await api<{ tracked: number }>("/api/cron/prices"); setChecking(`Updated ${r.tracked} planes.`); router.refresh(); } catch (e) { setChecking((e as Error).message); } }}>↻ Check prices now</button>
      </div>

      {openItem && <Detail key={openItem.id} item={openItem} model={openItem.catalogId ? models[openItem.catalogId] : undefined} photos={photos[openItem.catalogId ?? openItem.id] ?? []} history={openItem.catalogId ? history[openItem.catalogId] ?? [] : []} currency={currency} toSGD={toSGD} onClose={close} />}
    </>
  );
}
