import { requireAuth } from "@/lib/auth";
import { updateStore } from "@/lib/store";
import { ItemInput } from "@/lib/validation";

export async function PATCH(request: Request, ctx: RouteContext<"/api/collection/[id]">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  // null (or an empty string) clears an optional field; everything else is validated and applied.
  const CLEARABLE = ["pricePaid", "notes", "acquiredAt", "airline", "aircraft", "registration", "family"] as const;
  const cleared = CLEARABLE.filter((k) => body[k] === null || body[k] === "");
  const rest = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== null && v !== ""));
  const parsed = ItemInput.omit({ catalogId: true }).partial().safeParse(rest);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid plane" }, { status: 400 });
  const updated = await updateStore((doc) => {
    const item = doc.items.find((i) => i.id === id);
    if (!item) return null;
    Object.assign(item, parsed.data);
    for (const k of cleared) delete item[k];
    return item;
  });
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(updated);
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/collection/[id]">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  await updateStore((doc) => {
    doc.items = doc.items.filter((i) => i.id !== id);
  });
  return Response.json({ ok: true });
}
