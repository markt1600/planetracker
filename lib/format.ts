import type { Price } from "./types";

export const CURRENCIES = ["SGD", "USD", "GBP", "EUR", "AUD", "CAD", "MYR", "HKD"];

const SYMBOLS: Record<string, string> = { SGD: "S$", USD: "US$", GBP: "£", EUR: "€", AUD: "A$", CAD: "C$", MYR: "RM", HKD: "HK$" };

export function money(amount: number | undefined | null, currency: string) {
  if (amount == null || Number.isNaN(amount)) return "—";
  const digits = Number.isInteger(amount) ? 0 : 2;
  const n = amount.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${SYMBOLS[currency] ?? currency + " "}${n}`;
}

export function convert(amount: number, from: string, to: string, toSGD: Record<string, number>) {
  if (from === to) return amount;
  const a = toSGD[from];
  const b = toSGD[to];
  if (!a || !b) return null;
  return (amount * a) / b;
}

/** The wishlist is capped so it stays a real shortlist: to add another, one has to come off. */
export const WISHLIST_MAX = 3;

export const PREFERRED_SOURCE = "Airplane Model SG";

/** Best price guess in the target currency. Airplane Model SG wins when it lists the model. */
export function estimatePrice(prices: Price[] | undefined, target: string, toSGD: Record<string, number>) {
  if (!prices?.length) return null;
  // Offers for damaged or pre-owned copies only count when nothing else is listed.
  const rank = (p: Price) => (p.condition ? 2 : p.source === PREFERRED_SOURCE ? 0 : 1);
  const ordered = [...prices].sort((a, b) => rank(a) - rank(b));
  for (const p of ordered) {
    const amount = convert(p.amount, p.currency, target, toSGD);
    if (amount != null) {
      return { amount: Math.round(amount * 100) / 100, source: p.source, converted: p.currency !== target, original: p };
    }
  }
  return null;
}

export function scaleDenominator(scale: string) {
  const m = /1[:/](\d+)/.exec(scale);
  return m ? Number(m[1]) : null;
}

/** A price shown in the display currency; the original is appended when it was converted. */
export function shown(amount: number, from: string, to: string, toSGD: Record<string, number>, withOriginal = true) {
  const c = convert(amount, from, to, toSGD);
  if (c == null || from === to) return money(amount, from);
  return `${money(Math.round(c * 100) / 100, to)}${withOriginal ? ` (${money(amount, from)})` : ""}`;
}
