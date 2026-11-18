import Link from "next/link";
import { dimensions, factsFor, modelSize, scaleFact } from "@/lib/facts";
import PlaneImage from "./PlaneImage";
import RefreshButton from "./RefreshButton";

export type FeaturedPlane = {
  title: string;
  brand: string;
  modelNumber: string;
  scale: string;
  airline?: string;
  aircraft?: string;
  family?: string;
  registration?: string;
  images: (string | undefined)[];
  note?: string;
  href: string;
};

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-line pl-3">
      <p className="label">{label}</p>
      <p className="mt-0.5 font-mono text-sm text-ink">{value}</p>
    </div>
  );
}

const km = (n: number) => `${n.toLocaleString("en")} km`;

export default function Featured({ plane, eyebrow, seed }: { plane: FeaturedPlane; eyebrow: string; seed: number }) {
  const f = factsFor(plane.family);
  const size = modelSize(plane.family, plane.scale, plane.aircraft);
  const dim = dimensions(plane.family, plane.aircraft);
  const pool = f ? [...f.facts] : [];
  // Pick two different facts using the per-request seed so they rotate with the plane.
  const picks: string[] = [];
  for (let i = 0; i < 2 && pool.length; i++) picks.push(pool.splice((seed + i * 7) % pool.length, 1)[0]);
  const sized = scaleFact(plane.family, plane.scale, plane.aircraft);

  return (
    <section className="panel rise overflow-hidden">
      <div className="grid lg:grid-cols-[1.15fr_1fr]">
        <div className="relative">
          <PlaneImage sources={plane.images} alt={plane.title} className="aspect-[4/3] h-full w-full lg:aspect-auto lg:min-h-[26rem]" />
          <span className="chip chip-amber absolute left-4 top-4 !bg-night/85 backdrop-blur">★ {eyebrow}</span>
        </div>
        <div className="flex flex-col p-6 sm:p-8">
          <p className="label">
            {plane.brand} · {plane.modelNumber}
          </p>
          <h1 className="mt-2 font-display text-3xl leading-[1.08] tracking-tight sm:text-4xl">{plane.airline && plane.aircraft ? `${plane.airline} ${plane.aircraft}` : plane.title}</h1>
          {plane.airline && plane.aircraft && <p className="mt-2 text-sm text-mute">{plane.title}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="chip">{plane.scale}</span>
            {plane.registration && <span className="chip">{plane.registration}</span>}
            {f?.nickname && <span className="chip chip-amber">“{f.nickname}”</span>}
          </div>

          {f && (
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <Spec label="Real length" value={`${dim?.lengthM ?? f.lengthM} m`} />
              <Spec label="Wingspan" value={`${dim?.wingspanM ?? f.wingspanM} m`} />
              {size && <Spec label="Model size" value={`${size.lengthCm.toFixed(1)} × ${size.wingspanCm.toFixed(1)} cm`} />}
              {f.rangeKm && <Spec label="Range" value={km(f.rangeKm)} />}
              {f.cruiseKmh && <Spec label="Cruise" value={`${f.cruiseKmh} km/h`} />}
              {f.seats && <Spec label="Seats" value={f.seats} />}
              <Spec label="First flight" value={String(f.firstFlight)} />
              <Spec label="Engines" value={f.engines} />
              <Spec label="Built by" value={f.maker} />
            </div>
          )}

          {(picks.length > 0 || sized) && (
            <div className="mt-6 rounded-2xl border border-line bg-night/50 p-4">
              <p className="label !text-amber">Did you know?</p>
              <ul className="mt-2 space-y-2 text-sm leading-relaxed text-ink/90">
                {picks.map((t) => (
                  <li key={t}>{t}</li>
                ))}
                {sized && <li className="text-mute">{sized}</li>}
              </ul>
              {f && dim && dim.variant !== f.variant && <p className="mt-2 text-xs text-faint">Size is for the {dim.variant}; range, speed and seats are for the {f.variant}.</p>}
            </div>
          )}
          {plane.note && <p className="mt-4 text-sm italic text-mute">“{plane.note}”</p>}

          <div className="mt-auto flex flex-wrap gap-2 pt-6">
            <Link href={plane.href} className="btn btn-ghost">
              View details
            </Link>
            <RefreshButton>Show me another</RefreshButton>
          </div>
        </div>
      </div>
    </section>
  );
}
