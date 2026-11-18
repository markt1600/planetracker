import { requireAuth } from "@/lib/auth";
import { getModel } from "@/lib/catalog";
import { WISHLIST_MAX } from "@/lib/format";
import { readStore, updateStore } from "@/lib/store";
import type { StoreDoc } from "@/lib/types";
import { enrich } from "@/lib/view";

/** The wishlist with each plane's catalogue details; entries whose model no longer exists are dropped. */
function expand(doc: StoreDoc) {
  return doc.wishlist.flatMap((w) => {
    const model = getModel(w.catalogId, doc.customModels);
    return model ? [{ ...w, model: enrich(model, doc) }] : [];
  });
}

export async function GET() {
  return Response.json({ max: WISHLIST_MAX, wishlist: expand(await readStore()) });
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { catalogId } = (await request.json().catch(() => ({}))) as { catalogId?: string };
  const result = await updateStore((doc) => {
    if (!catalogId || !getModel(catalogId, doc.customModels)) return { status: 404, error: "That plane isn't in the catalogue." };
    if (!doc.wishlist.some((w) => w.catalogId === catalogId)) {
      // Count only entries that still resolve, so a vanished model can't block the list.
      doc.wishlist = doc.wishlist.filter((w) => getModel(w.catalogId, doc.customModels));
      if (doc.wishlist.length >= WISHLIST_MAX) {
        return { status: 409, error: `Your wishlist is full (${WISHLIST_MAX} planes). Remove one first.`, wishlist: expand(doc) };
      }
      doc.wishlist.push({ catalogId, addedAt: new Date().toISOString() });
    }
    return { status: 200, wishlist: expand(doc) };
  });
  const { status, ...body } = result;
  return Response.json({ max: WISHLIST_MAX, ...body }, { status });
}

export async function DELETE(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { catalogId } = (await request.json().catch(() => ({}))) as { catalogId?: string };
  const wishlist = await updateStore((doc) => {
    doc.wishlist = doc.wishlist.filter((w) => w.catalogId !== catalogId);
    return expand(doc);
  });
  return Response.json({ max: WISHLIST_MAX, wishlist });
}
