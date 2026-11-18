import { requireAuth } from "@/lib/auth";
import { getModel } from "@/lib/catalog";
import { readStore, updateStore } from "@/lib/store";
import type { CollectionItem } from "@/lib/types";
import { ItemInput } from "@/lib/validation";

const blankToUndefined = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v != null)) as T;

export async function GET() {
  const store = await readStore();
  return Response.json(store);
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const parsed = ItemInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid plane" }, { status: 400 });
  const input = blankToUndefined(parsed.data);
  if (input.catalogId && !getModel(input.catalogId, (await readStore()).customModels)) delete input.catalogId;
  const item: CollectionItem = { ...input, id: crypto.randomUUID(), addedAt: new Date().toISOString() };
  await updateStore((doc) => {
    doc.items.push(item);
  });
  return Response.json(item, { status: 201 });
}
