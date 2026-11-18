"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { CURRENCIES } from "@/lib/format";

const LINKS = [
  { href: "/", label: "Hangar" },
  { href: "/collection", label: "Collection" },
  { href: "/museum", label: "Museum" },
  { href: "/catalog", label: "Catalogue" },
];

export function PlaneMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 24" className={className} fill="currentColor" aria-hidden>
      <path d="M2 14.5c0-1.2 1-2.1 2.300-2.300l34-2.900L50.500 1.800c.6-.5 1.400-.8 2.200-.8h2.600l-5.300 8.900 7.800.700c2.300.2 4.200 1.700 4.200 3.400s-1.900 3.200-4.200 3.400L40 18.400l-9.500 5.100h-3.400l4.800-4.700-21.600.3C5.600 19.200 2 17.200 2 14.500z" />
    </svg>
  );
}

export default function Nav({ owner, currency }: { owner: string; currency: string }) {
  const path = usePathname();
  const router = useRouter();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-night/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <PlaneMark className="h-4 w-auto text-amber" />
          <span className="font-display text-lg leading-none tracking-tight">{owner}&rsquo;s Hangar</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={`hidden rounded-full px-3 py-1.5 transition sm:block ${active ? "bg-raised text-ink" : "text-mute hover:text-ink"}`}>
                {l.label}
              </Link>
            );
          })}
          <select
            className="field ml-1 !w-auto !rounded-full !py-1.5 !pl-3 !pr-7 font-mono !text-xs"
            aria-label="Display currency"
            title="Show all prices in this currency"
            value={currency}
            onChange={async (e) => {
              try {
                await api("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currency: e.target.value }) });
                router.refresh();
              } catch {
                /* passcode declined: leave as is */
              }
            }}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <Link href="/add" className="btn btn-primary ml-1 !py-2">
            <span aria-hidden>+</span> Add a plane
          </Link>
        </nav>
      </div>
      <nav className="flex border-t border-line/50 text-sm sm:hidden">
        {LINKS.map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={`flex-1 py-2 text-center ${active ? "text-amber" : "text-mute"}`}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
