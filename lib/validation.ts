import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);

export const ItemInput = z.object({
  catalogId: text(120).optional(),
  brand: text(60).min(1, "Choose a manufacturer"),
  modelNumber: text(60).min(1, "Add the model number"),
  scale: text(12).regex(/^1:\d{1,4}$/, "Scale should look like 1:400"),
  title: text(200).min(1, "Add a description"),
  airline: text(100).optional(),
  aircraft: text(60).optional(),
  family: text(60).optional(),
  registration: text(20).optional(),
  image: text(500).optional(),
  pricePaid: z.number().min(0).max(1_000_000).optional(),
  currency: text(3).min(3),
  acquiredAt: text(10).optional(),
  notes: text(1000).optional(),
});
