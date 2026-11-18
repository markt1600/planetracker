import { requireAuth } from "@/lib/auth";
import { getModel } from "@/lib/catalog";
import { FACTS } from "@/lib/facts";
import { updateStore } from "@/lib/store";
import type { CatalogModel } from "@/lib/types";
import { ModelInput } from "@/lib/validation";

/** Add a model to the catalogue without adding it to the collection. */
export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const parsed = ModelInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid model" }, { status: 400 });
  const { price, currency, priceSource, ...fields } = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== "" && v != null)) as typeof parsed.data;
  if (fields.family && !FACTS[fields.family]) delete fields.family;
  const id = `custom-${`${fields.brand}-${fields.modelNumber}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const model: CatalogModel = {
    id,
    ...fields,
    modelNumber: fields.modelNumber.toUpperCase(),
    prices: price != null && price > 0 ? [{ source: priceSource || "Added by hand", amount: price, currency: currency || "SGD" }] : undefined,
  };
  const result = await updateStore((doc) => {
    const clash = getModel(id, doc.customModels) ?? getModel(id.replace(/^custom-/, ""));
    if (clash) return { error: `${clash.brand} ${clash.modelNumber} is already in the catalogue.` };
    doc.customModels.push(model);
    return { model };
  });
  if ("error" in result) return Response.json(result, { status: 409 });
  return Response.json(result.model, { status: 201 });
}
