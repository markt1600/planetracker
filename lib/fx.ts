import "server-only";
import { catalogMeta } from "./catalog";
import { CURRENCIES } from "./format";

/**
 * Live exchange rates (European Central Bank reference rates via frankfurter.dev), refreshed every 12 hours.
 * Returned as "value of 1 unit in SGD" so any currency can be converted to any other.
 * Falls back to the rates captured when the catalogue was built if the service can't be reached.
 */
export async function getRates(): Promise<{ toSGD: Record<string, number>; asOf: string | null; live: boolean }> {
  const fallback = catalogMeta().fx;
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=SGD", { next: { revalidate: 43200 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { date: string; rates: Record<string, number> };
    const toSGD: Record<string, number> = { ...fallback.toSGD, SGD: 1 };
    for (const c of CURRENCIES) if (data.rates[c]) toSGD[c] = 1 / data.rates[c];
    return { toSGD, asOf: data.date, live: true };
  } catch {
    return { toSGD: fallback.toSGD, asOf: fallback.asOf, live: false };
  }
}
