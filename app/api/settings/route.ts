import { requireAuth } from "@/lib/auth";
import { CURRENCIES } from "@/lib/format";
import { updateStore } from "@/lib/store";

export async function PATCH(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { currency } = (await request.json().catch(() => ({}))) as { currency?: string };
  if (!currency || !CURRENCIES.includes(currency)) return Response.json({ error: "Unknown currency" }, { status: 400 });
  const settings = await updateStore((doc) => {
    doc.settings.currency = currency;
    return doc.settings;
  });
  return Response.json(settings);
}
