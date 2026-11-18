import { getModel } from "@/lib/catalog";
import { readStore } from "@/lib/store";

export async function GET(_request: Request, ctx: RouteContext<"/api/catalog/[id]">) {
  const { id } = await ctx.params;
  const model = getModel(id);
  if (!model) return Response.json({ error: "Not found" }, { status: 404 });
  const store = await readStore().catch(() => null);
  return Response.json({ ...model, userPhotos: store?.modelPhotos[id] ?? [], priceHistory: store?.priceHistory[id] ?? [] });
}
