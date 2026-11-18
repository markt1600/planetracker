"use client";

import Link from "next/link";
import { useState } from "react";
import { api, shrinkImage, uploadPhoto } from "@/lib/client";
import { CURRENCIES } from "@/lib/format";
import type { CatalogModel } from "@/lib/types";
import PlaneImage from "./PlaneImage";

const BLANK = { brand: "", modelNumber: "", scale: "1:400", title: "", airline: "", aircraft: "", family: "", registration: "", notes: "", description: "", price: "", priceSource: "" };

export default function NewModel({ brands, scales, families, currency }: { brands: string[]; scales: string[]; families: string[]; currency: string }) {
  const [f, setF] = useState({ ...BLANK, brand: brands[0] });
  const [cur, setCur] = useState(currency);
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<CatalogModel | null>(null);
  const set = (patch: Partial<typeof BLANK>) => setF((v) => ({ ...v, ...patch }));

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const price = f.price.trim() === "" ? undefined : Number(f.price);
      if (price != null && Number.isNaN(price)) throw new Error("The price should be a number");
      const model = await api<CatalogModel>("/api/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, price, currency: cur }) });
      for (const p of photos) await uploadPhoto(model.id, p.blob).catch(() => setError("Saved, but a photo didn't upload."));
      setSaved(model);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <div className="panel rise p-8 text-center">
        <p className="label !text-good">Catalogued</p>
        <h2 className="mt-2 font-display text-3xl">Added to the catalogue</h2>
        <p className="mt-2 text-mute">{saved.brand} · {saved.modelNumber} · {saved.title}</p>
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button className="btn btn-primary" onClick={() => { setSaved(null); setF({ ...BLANK, brand: f.brand, scale: f.scale }); setPhotos([]); }}>+ Add another model</button>
          <Link href={`/add?model=${saved.id}`} className="btn btn-ghost">Add it to my collection</Link>
          <Link href="/catalog" className="btn btn-ghost">Back to the catalogue</Link>
        </div>
      </div>
    );
  }

  const field = (key: keyof typeof BLANK, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, span = "") => (
    <label className={span}>
      <span className="label">{label}</span>
      <input className="field mt-1.5" value={f[key]} onChange={(e) => set({ [key]: e.target.value })} {...props} />
    </label>
  );

  return (
    <form className="panel rise grid gap-4 p-5 sm:grid-cols-2 sm:p-6" onSubmit={(e) => { e.preventDefault(); save(); }}>
      {field("brand", "Manufacturer", { required: true, list: "nm-brands" })}
      {field("modelNumber", "Model number", { required: true, placeholder: "e.g. KJ-CONCORDE-212" })}
      {field("scale", "Scale", { required: true, list: "nm-scales", pattern: "1:\\d{1,4}" })}
      {field("registration", "Registration", { placeholder: "e.g. G-BOAD" })}
      {field("airline", "Airline", { placeholder: "e.g. Singapore Airlines" })}
      {field("aircraft", "Aircraft type", { placeholder: "e.g. A350-900" })}
      <label>
        <span className="label">Aircraft family</span>
        <select className="field mt-1.5" value={f.family} onChange={(e) => set({ family: e.target.value })}>
          <option value="">Not sure / other</option>
          {families.map((x) => <option key={x}>{x}</option>)}
        </select>
        <span className="mt-1 block text-xs text-faint">Unlocks facts and the right 3D shape.</span>
      </label>
      {field("notes", "Livery or edition", { placeholder: "e.g. Star Alliance, flaps down" })}
      {field("title", "Description", { required: true, placeholder: "e.g. Concorde Singapore Airlines / British Airways G-BOAD" }, "sm:col-span-2")}
      <label className="sm:col-span-2">
        <span className="label">More about it (optional)</span>
        <textarea className="field mt-1.5 min-h-24" maxLength={1200} value={f.description} onChange={(e) => set({ description: e.target.value })} />
      </label>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        {field("price", "Typical price (optional)", { inputMode: "decimal", placeholder: "0.00" })}
        <label>
          <span className="label">Currency</span>
          <select className="field mt-1.5" value={cur} onChange={(e) => setCur(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
      </div>
      {field("priceSource", "Where that price is from", { placeholder: "e.g. Carousell, hobby shop" })}
      <div className="sm:col-span-2">
        <span className="label">Photos (optional)</span>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {photos.map((p) => (
            <button type="button" key={p.url} onClick={() => setPhotos((list) => list.filter((x) => x !== p))} title="Remove" aria-label="Remove photo">
              <PlaneImage sources={[p.url]} alt="" fit="cover" className="h-16 w-20 rounded-lg" />
            </button>
          ))}
          <label className="btn btn-ghost cursor-pointer">
            + Add photo
            <input type="file" accept="image/*" multiple className="sr-only" onChange={async (e) => { const added = await Promise.all([...(e.target.files ?? [])].slice(0, 4).map(async (file) => { const blob = await shrinkImage(file, 1600); return { blob, url: URL.createObjectURL(blob) }; })); setPhotos((list) => [...list, ...added].slice(0, 4)); e.target.value = ""; }} />
          </label>
        </div>
      </div>
      <datalist id="nm-brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
      <datalist id="nm-scales">{scales.map((s) => <option key={s} value={s} />)}</datalist>
      {error && <p className="text-sm text-bad sm:col-span-2">{error}</p>}
      <button className="btn btn-primary sm:col-span-2" disabled={busy}>{busy ? "Saving…" : "Add to the catalogue"}</button>
    </form>
  );
}
