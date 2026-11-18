"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, blobToBase64, shrinkImage, uploadPhoto } from "@/lib/client";
import { CURRENCIES, estimatePrice, money, PREFERRED_SOURCE, shown } from "@/lib/format";
import type { CatalogModel, CollectionItem } from "@/lib/types";
import PlaneImage from "./PlaneImage";

type Mode = "catalogue" | "photo" | "manual";
type Result = CatalogModel & { owned?: boolean; score?: number };
type Guess = {
  is_model_aircraft: boolean;
  airline: string | null;
  aircraft: string | null;
  family: string | null;
  registration: string | null;
  livery: string | null;
  brand: string | null;
  scale: string | null;
  confidence: "high" | "medium" | "low";
  summary: string;
};
type Draft = {
  catalogId?: string;
  brand: string;
  modelNumber: string;
  scale: string;
  title: string;
  airline: string;
  aircraft: string;
  family: string;
  registration: string;
  image?: string;
  pricePaid: string;
  currency: string;
  acquiredAt: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function draftFrom(m: CatalogModel, currency: string, toSGD: Record<string, number>): Draft {
  const est = estimatePrice(m.prices, currency, toSGD);
  return {
    catalogId: m.id,
    brand: m.brand,
    modelNumber: m.modelNumber,
    scale: m.scale,
    title: m.title,
    airline: m.airline ?? "",
    aircraft: m.aircraft ?? "",
    family: m.family ?? "",
    registration: m.registration ?? "",
    image: m.image,
    pricePaid: est ? String(est.amount) : "",
    currency,
    acquiredAt: today(),
    notes: "",
  };
}

function Labeled({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export function ResultRow({ model, onPick, active }: { model: Result; onPick: () => void; active?: boolean }) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onPick} className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${active ? "bg-raised" : "hover:bg-raised/70"}`}>
      <PlaneImage sources={[model.image, model.remoteImage]} alt="" className="h-12 w-16 shrink-0 rounded-lg" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{model.title}</span>
        <span className="mt-0.5 block truncate font-mono text-xs text-mute">
          {model.brand} · {model.modelNumber} · {model.scale}
        </span>
      </span>
      {model.owned && <span className="chip chip-amber">In hangar</span>}
    </button>
  );
}

export default function AddPlane({ brands, scales, currency, toSGD, initial, aiEnabled }: { brands: string[]; scales: string[]; currency: string; toSGD: Record<string, number>; initial?: CatalogModel | null; aiEnabled: boolean }) {
  const [mode, setMode] = useState<Mode>("catalogue");
  const [brand, setBrand] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [searching, setSearching] = useState(false);

  // A deep link from the catalogue (/add?model=<id>) starts straight on the details step.
  const [draft, setDraft] = useState<Draft | null>(() => (initial ? draftFrom(initial, currency, toSGD) : null));
  const [picked, setPicked] = useState<CatalogModel | null>(initial ?? null);
  const [ownPhoto, setOwnPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<CollectionItem | null>(null);

  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [guess, setGuess] = useState<Guess | null>(null);
  const [matches, setMatches] = useState<Result[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const blank = (over: Partial<Draft> = {}): Draft => ({ brand: brand || brands[0], modelNumber: "", scale: "1:400", title: "", airline: "", aircraft: "", family: "", registration: "", pricePaid: "", currency, acquiredAt: today(), notes: "", ...over });

  const choose = (m: CatalogModel) => {
    setPicked(m);
    setDraft(draftFrom(m, currency, toSGD));
    setOpen(false);
    setError("");
  };

  // Typeahead: search as he types, scoped to the chosen manufacturer.
  useEffect(() => {
    if (mode !== "catalogue" || (!brand && query.trim().length < 2)) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: query, limit: "8" });
        if (brand) params.set("brand", brand);
        const data = await api<{ results: Result[] }>(`/api/catalog/search?${params}`, { signal: ctrl.signal });
        setResults(data.results);
        setCursor(0);
      } catch {
        /* superseded or offline */
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, brand, mode]);

  const reset = () => {
    setDraft(null);
    setPicked(null);
    setOwnPhoto(null);
    setSaved(null);
    setQuery("");
    setShot(null);
    setGuess(null);
    setMatches([]);
    setError("");
  };

  const identify = async (file: File) => {
    setError("");
    setGuess(null);
    setMatches([]);
    setIdentifying(true);
    try {
      const blob = await shrinkImage(file);
      setShot({ blob, url: URL.createObjectURL(blob) });
      const data = await api<{ guess: Guess; matches: Result[] }>("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: await blobToBase64(blob), mediaType: "image/jpeg" }),
      });
      setGuess(data.guess);
      setMatches(data.matches);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIdentifying(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const { pricePaid, ...rest } = draft;
      const price = pricePaid.trim() === "" ? undefined : Number(pricePaid);
      if (price != null && Number.isNaN(price)) throw new Error("The price should be a number");
      const item = await api<CollectionItem>("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, pricePaid: price }),
      });
      if (ownPhoto) await uploadPhoto(item.catalogId ?? item.id, ownPhoto.blob).catch(() => setError("Saved, but the photo didn't upload — you can add it from the collection."));
      setSaved(item);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  if (saved) {
    return (
      <div className="panel rise mx-auto max-w-xl p-8 text-center">
        <p className="label !text-good">Cleared for landing</p>
        <h2 className="mt-2 font-display text-3xl">Added to the hangar</h2>
        <p className="mt-2 text-mute">{saved.title}</p>
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
        <div className="mt-6 flex justify-center gap-3">
          <button className="btn btn-primary" onClick={reset}>
            + Add another
          </button>
          <Link href={`/collection?plane=${saved.id}`} className="btn btn-ghost">
            View it
          </Link>
        </div>
      </div>
    );
  }

  if (draft) {
    const est = picked ? estimatePrice(picked.prices, draft.currency, toSGD) : null;
    return (
      <div className="rise grid gap-6 lg:grid-cols-[1fr_1.25fr]">
        <div className="space-y-3">
          <div className="panel overflow-hidden">
            <PlaneImage sources={[ownPhoto?.url, picked?.image, picked?.remoteImage]} alt={draft.title} className="aspect-[4/3]" />
            <div className="p-4">
              <p className="label">
                {draft.brand} · {draft.modelNumber || "no model number"} · {draft.scale}
              </p>
              <p className="mt-1.5 text-lg leading-snug">{draft.title || "New plane"}</p>
              {picked?.description && <p className="mt-2 text-sm text-mute">{picked.description}</p>}
            </div>
          </div>
          {picked?.prices && picked.prices.length > 0 && (
            <div className="panel p-4">
              <p className="label">Current prices</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {picked.prices.map((p) => (
                  <li key={p.source} className="flex items-baseline justify-between gap-3">
                    <a href={p.url} target="_blank" rel="noreferrer" className="truncate text-sky hover:underline">
                      {p.source}
                      {p.source === PREFERRED_SOURCE && " ★"}
                    </a>
                    <span className="font-mono text-xs text-mute">
                      {shown(p.amount, p.currency, currency, toSGD)}
                      {p.inStock === false && " · sold out"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button className="text-sm text-mute hover:text-ink" onClick={reset}>
            ← Choose a different plane
          </button>
        </div>

        <form
          className="panel space-y-5 p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div>
            <p className="label">Step 2</p>
            <h2 className="mt-1 font-display text-2xl">Your copy</h2>
          </div>

          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Labeled
              label="Price paid"
              hint={est ? `Suggested ${money(est.amount, draft.currency)} from ${est.source}${est.converted ? ` (converted from ${money(est.original.amount, est.original.currency)})` : ""}. Change it to what you actually paid.` : "No retailer price found — enter what you paid, or leave it blank."}
            >
              <input className="field" inputMode="decimal" placeholder="0.00" value={draft.pricePaid} onChange={(e) => set({ pricePaid: e.target.value })} />
            </Labeled>
            <Labeled label="Currency">
              <select className="field" value={draft.currency} onChange={(e) => set({ currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Labeled>
          </div>
          <Labeled label="Date you got it">
            <input className="field" type="date" value={draft.acquiredAt} max={today()} onChange={(e) => set({ acquiredAt: e.target.value })} />
          </Labeled>
          <Labeled label="Notes about your copy" hint="Private to your collection — e.g. missing box, damaged wheel, birthday present.">
            <textarea className="field min-h-24" value={draft.notes} maxLength={1000} onChange={(e) => set({ notes: e.target.value })} placeholder="Anything worth remembering about this one" />
          </Labeled>

          <div>
            <span className="label">Your own photo (optional)</span>
            <div className="mt-1.5 flex items-center gap-3">
              {ownPhoto && <PlaneImage sources={[ownPhoto.url]} alt="Your photo" fit="cover" className="h-16 w-20 rounded-lg" />}
              <label className="btn btn-ghost cursor-pointer">
                {ownPhoto ? "Change photo" : "Add a photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const blob = await shrinkImage(f, 1600);
                    setOwnPhoto({ blob, url: URL.createObjectURL(blob) });
                  }}
                />
              </label>
              {ownPhoto && (
                <button type="button" className="text-sm text-mute hover:text-ink" onClick={() => setOwnPhoto(null)}>
                  Remove
                </button>
              )}
            </div>
            <span className="mt-1 block text-xs text-faint">Shown next to the stock photo for this model.</span>
          </div>

          <details className="rounded-xl border border-line p-4" open={!draft.catalogId}>
            <summary className="label cursor-pointer select-none">Model details {draft.catalogId && "(from the catalogue)"}</summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Labeled label="Manufacturer">
                <input className="field" list="brand-list" required value={draft.brand} onChange={(e) => set({ brand: e.target.value })} />
              </Labeled>
              <Labeled label="Model number">
                <input className="field" required value={draft.modelNumber} onChange={(e) => set({ modelNumber: e.target.value })} placeholder="e.g. GJSIA2191" />
              </Labeled>
              <Labeled label="Scale">
                <input className="field" list="scale-list" required pattern="1:\d{1,4}" value={draft.scale} onChange={(e) => set({ scale: e.target.value })} />
              </Labeled>
              <Labeled label="Registration">
                <input className="field" value={draft.registration} onChange={(e) => set({ registration: e.target.value })} placeholder="e.g. 9V-SKA" />
              </Labeled>
              <Labeled label="Airline">
                <input className="field" value={draft.airline} onChange={(e) => set({ airline: e.target.value })} placeholder="e.g. Singapore Airlines" />
              </Labeled>
              <Labeled label="Aircraft type">
                <input className="field" value={draft.aircraft} onChange={(e) => set({ aircraft: e.target.value })} placeholder="e.g. A380-800" />
              </Labeled>
              <Labeled label="Description" className="sm:col-span-2">
                <input className="field" required value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Singapore Airlines A380-800 9V-SKA" />
              </Labeled>
            </div>
            <datalist id="brand-list">
              {brands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
            <datalist id="scale-list">
              {scales.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </details>

          {error && <p className="text-sm text-bad">{error}</p>}
          <button className="btn btn-primary w-full" disabled={saving}>
            {saving ? "Saving…" : "Add to my collection"}
          </button>
        </form>
      </div>
    );
  }

  const tabs: { id: Mode; label: string; sub: string }[] = [
    { id: "catalogue", label: "Find it", sub: "Search the catalogue" },
    { id: "photo", label: "Spot it", sub: "Identify from a photo" },
    { id: "manual", label: "Type it", sub: "Enter by hand" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="grid grid-cols-3 gap-2" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={mode === t.id} onClick={() => { setMode(t.id); setError(""); }} className={`rounded-2xl border px-3 py-3 text-left transition ${mode === t.id ? "border-amber/60 bg-raised" : "border-line hover:border-sky/50"}`}>
            <span className="block font-display text-lg leading-none">{t.label}</span>
            <span className="mt-1 block text-xs text-mute">{t.sub}</span>
          </button>
        ))}
      </div>

      {mode === "catalogue" && (
        <div className="panel rise space-y-4 p-5 sm:p-6">
          <Labeled label="1 · Manufacturer">
            <select className="field" value={brand} onChange={(e) => { setBrand(e.target.value); setOpen(true); }}>
              <option value="">Any manufacturer</option>
              {brands.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Labeled>
          <div className="relative">
            <Labeled label="2 · Model" hint="Type a model number, airline, aircraft type or registration.">
              <input
                className="field"
                role="combobox"
                aria-expanded={open}
                aria-controls="model-options"
                autoComplete="off"
                placeholder={brand ? `Search ${brand} models…` : "e.g. Singapore A380, GJSIA, 9V-SKA"}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
                  if (e.key === "Enter" && open && results[cursor]) { e.preventDefault(); choose(results[cursor]); }
                  if (e.key === "Escape") setOpen(false);
                }}
              />
            </Labeled>
            {open && (brand || query.trim().length >= 2) && (
              <div id="model-options" role="listbox" className="absolute inset-x-0 top-[4.4rem] z-20 max-h-[26rem] overflow-auto rounded-2xl border border-line bg-panel p-1.5 shadow-2xl shadow-black/60">
                {results.map((r, i) => (
                  <ResultRow key={r.id} model={r} active={i === cursor} onPick={() => choose(r)} />
                ))}
                {!results.length && <p className="p-3 text-sm text-mute">{searching ? "Searching…" : "No match in the catalogue."}</p>}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setDraft(blank({ modelNumber: /\d/.test(query) && !/\s/.test(query.trim()) ? query.trim().toUpperCase() : "", title: /\s/.test(query.trim()) ? query.trim() : "" })); setPicked(null); }} className="mt-1 w-full rounded-xl border border-dashed border-line p-2.5 text-left text-sm text-mute hover:border-sky/60 hover:text-ink">
                  Can&rsquo;t find it? Enter {query.trim() ? `“${query.trim()}”` : "it"} by hand →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {mode === "photo" && (
        <div className="panel rise space-y-4 p-5 sm:p-6">
          {!aiEnabled && <p className="rounded-xl border border-amber/40 bg-amber/10 p-3 text-sm text-amber">Photo identification needs an Anthropic API key. Add ANTHROPIC_API_KEY in the Vercel project settings to switch it on.</p>}
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            {shot ? <PlaneImage sources={[shot.url]} alt="Your photo" fit="cover" className="aspect-[4/3] w-full rounded-2xl sm:w-56" /> : <div className="studio grid aspect-[4/3] w-full place-items-center rounded-2xl text-5xl sm:w-56" aria-hidden>📷</div>}
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm text-mute">Take a side-on photo with the tail and the airline name in view. The AI spotter will say what it thinks it is, and you confirm.</p>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) identify(f); e.target.value = ""; }} />
              <button className="btn btn-primary mt-3" disabled={identifying} onClick={() => fileRef.current?.click()}>
                {identifying ? "Looking closely…" : shot ? "Try another photo" : "Take or choose a photo"}
              </button>
            </div>
          </div>

          {guess && (
            <div className="rise space-y-3 border-t border-line pt-4">
              <div>
                <p className="label !text-amber">I think this is…</p>
                <p className="mt-1 font-display text-2xl leading-tight">{guess.is_model_aircraft ? [guess.airline, guess.aircraft].filter(Boolean).join(" ") || "an aircraft I can't quite place" : "not an aircraft"}</p>
                <p className="mt-1.5 text-sm text-mute">{guess.summary}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="chip">{guess.confidence} confidence</span>
                  {guess.registration && <span className="chip">{guess.registration}</span>}
                  {guess.livery && <span className="chip">{guess.livery}</span>}
                </div>
              </div>
              {matches.length > 0 && (
                <div>
                  <p className="label">Is it one of these?</p>
                  <div className="mt-1.5 space-y-0.5">
                    {matches.map((m) => (
                      <ResultRow key={m.id} model={m} onPick={() => { choose(m); if (shot) setOwnPhoto(shot); }} />
                    ))}
                  </div>
                </div>
              )}
              {guess.is_model_aircraft && (
                <button
                  className="btn btn-ghost w-full"
                  onClick={() => {
                    setPicked(null);
                    setDraft(blank({ brand: guess.brand ?? brand ?? brands[0], scale: guess.scale ?? "1:400", airline: guess.airline ?? "", aircraft: guess.aircraft ?? "", family: guess.family ?? "", registration: guess.registration ?? "", title: [guess.airline, guess.aircraft, guess.livery, guess.registration].filter(Boolean).join(" ") }));
                    if (shot) setOwnPhoto(shot);
                  }}
                >
                  {matches.length ? "None of these — enter the details myself" : "It's not in the catalogue — add it with these details"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {mode === "manual" && (
        <div className="panel rise p-5 text-center sm:p-6">
          <p className="text-sm text-mute">For planes that aren&rsquo;t in the catalogue yet. You&rsquo;ll need the model number (on the box) and the scale.</p>
          <button className="btn btn-primary mt-4" onClick={() => { setPicked(null); setDraft(blank()); }}>
            Start a blank entry
          </button>
        </div>
      )}

      {error && <p className="text-center text-sm text-bad">{error}</p>}
    </div>
  );
}
