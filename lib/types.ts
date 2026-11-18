export type Price = {
  source: string;
  amount: number;
  currency: string;
  url?: string;
  inStock?: boolean;
};

/** A model in the shared catalogue (data/catalog.json). */
export type CatalogModel = {
  id: string;
  brand: string;
  modelNumber: string;
  scale: string;
  line?: string;
  title: string;
  airline?: string;
  aircraft?: string;
  family?: string;
  registration?: string;
  notes?: string;
  image?: string;
  remoteImage?: string;
  /** Extra stock photos beyond the main one. */
  gallery?: string[];
  description?: string;
  prices?: Price[];
  /** Photos uploaded by the collector for this model (kept with the model, not the collection entry). */
  userPhotos?: string[];
};

/** One plane Ethan owns. Notes, price paid etc. are private to the collection. */
export type CollectionItem = {
  id: string;
  catalogId?: string;
  brand: string;
  modelNumber: string;
  scale: string;
  title: string;
  airline?: string;
  aircraft?: string;
  family?: string;
  registration?: string;
  image?: string;
  pricePaid?: number;
  currency: string;
  acquiredAt?: string;
  notes?: string;
  addedAt: string;
};

export type PricePoint = { date: string; amount: number; currency: string; inStock?: boolean };

export type StoreDoc = {
  version: 1;
  updatedAt: string;
  settings: { owner: string; currency: string };
  items: CollectionItem[];
  /** catalogId (or collection item id for custom planes) -> photo URLs uploaded by the collector. */
  modelPhotos: Record<string, string[]>;
  /** catalogId -> price history recorded by the price tracker. */
  priceHistory: Record<string, PricePoint[]>;
  pricesCheckedAt?: string;
};

export type CatalogMeta = {
  builtAt: string;
  count: number;
  brands: string[];
  fx: { base: string; asOf: string | null; toSGD: Record<string, number> };
  sources: string[];
};
