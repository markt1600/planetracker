import { money } from "@/lib/format";
import type { CollectionStats, Tally } from "@/lib/stats";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel px-4 py-4">
      <p className="label">{label}</p>
      <p className="mt-1.5 truncate font-display text-2xl leading-tight sm:text-[1.7rem]">{value}</p>
      {sub && <p className="mt-1 truncate text-xs text-mute">{sub}</p>}
    </div>
  );
}

function Bars({ title, data, max = 5 }: { title: string; data: Tally[]; max?: number }) {
  const top = data.slice(0, max);
  const peak = top[0]?.n ?? 1;
  return (
    <div className="panel p-5">
      <p className="label">{title}</p>
      {top.length === 0 && <p className="mt-3 text-sm text-faint">Nothing yet</p>}
      <ul className="mt-3 space-y-2.5">
        {top.map((t) => (
          <li key={t.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{t.label}</span>
              <span className="font-mono text-xs text-mute">{t.n}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-night">
              <div className="h-full rounded-full bg-sky" style={{ width: `${Math.max(6, (t.n / peak) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {data.length > max && <p className="mt-3 text-xs text-faint">+ {data.length - max} more</p>}
    </div>
  );
}

export default function Stats({ stats, currency, detailed = false }: { stats: CollectionStats; currency: string; detailed?: boolean }) {
  const gain = stats.paidCount ? stats.market - stats.paid : null;
  const topAirline = stats.airlines[0];
  const topFamily = stats.families[0];
  return (
    <section aria-label="Collection statistics" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Planes" value={String(stats.count)} sub={stats.scales.map((s) => `${s.n} × ${s.label}`).join(" · ") || undefined} />
        <Stat
          label="Market value"
          value={stats.marketCount ? money(Math.round(stats.market), currency) : "—"}
          sub={gain != null && stats.paid > 0 ? `${gain >= 0 ? "▲" : "▼"} ${money(Math.abs(Math.round(gain)), currency)} vs. paid ${money(Math.round(stats.paid), currency)}` : "Based on current retailer prices"}
        />
        <Stat label="Airlines" value={String(stats.airlines.length)} sub={topAirline ? `Most: ${topAirline.label} (${topAirline.n})` : undefined} />
        <Stat label="Aircraft types" value={String(stats.families.length || stats.types.length)} sub={topFamily ? `Most: ${topFamily.label} (${topFamily.n})` : undefined} />
      </div>
      {detailed && stats.count > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Manufacturers" value={String(stats.brands.length)} sub={stats.brands[0] ? `Most: ${stats.brands[0].label}` : undefined} />
            <Stat label="Variants" value={String(stats.types.length)} sub={stats.types[0] ? `Most: ${stats.types[0].label}` : undefined} />
            <Stat label="Registrations" value={String(stats.registrations)} sub="Unique real aircraft" />
            <Stat label="Most valuable" value={stats.topValue ? money(Math.round(stats.topValue.amount), currency) : "—"} sub={stats.topValue?.item.title} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Bars title="Top airlines" data={stats.airlines} />
            <Bars title="Aircraft families" data={stats.families} />
            <Bars title="Manufacturers" data={stats.brands} />
          </div>
        </>
      )}
    </section>
  );
}
