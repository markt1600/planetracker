import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { del, list, put } from "@vercel/blob";
import type { StoreDoc } from "./types";

/**
 * Everything personal (the collection, uploaded photos, price history) lives in one Vercel Blob store.
 * Each save writes a new timestamped JSON file and the newest one wins, which avoids CDN caching of
 * overwritten files and leaves a few previous versions behind as backups.
 * Without BLOB_READ_WRITE_TOKEN (local development) it falls back to files in ./.data.
 */
const PREFIX = "planetracker/collection-";
const KEEP = 8;
const LOCAL_DIR = path.join(process.cwd(), ".data");
const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const empty = (): StoreDoc => ({
  version: 1,
  updatedAt: new Date().toISOString(),
  settings: { owner: process.env.OWNER_NAME ?? "Ethan", currency: process.env.DEFAULT_CURRENCY ?? "SGD" },
  items: [],
  modelPhotos: {},
  customModels: [],
  priceHistory: {},
});

const normalize = (doc: Partial<StoreDoc>): StoreDoc => ({ ...empty(), ...doc, settings: { ...empty().settings, ...doc.settings } });

export async function readStore(): Promise<StoreDoc> {
  if (blobEnabled()) {
    const { blobs } = await list({ prefix: PREFIX, limit: 100 });
    if (!blobs.length) return empty();
    const latest = blobs.reduce((a, b) => (a.pathname > b.pathname ? a : b));
    const res = await fetch(latest.url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Could not load the collection (${res.status})`);
    return normalize(await res.json());
  }
  try {
    return normalize(JSON.parse(await fs.readFile(path.join(LOCAL_DIR, "collection.json"), "utf8")));
  } catch {
    return empty();
  }
}

export async function writeStore(doc: StoreDoc) {
  doc.updatedAt = new Date().toISOString();
  const body = JSON.stringify(doc);
  if (blobEnabled()) {
    // Zero-padded millisecond timestamp keeps pathnames sortable; the random suffix keeps the URL unguessable.
    const name = `${PREFIX}${String(Date.now()).padStart(15, "0")}.json`;
    await put(name, body, { access: "public", addRandomSuffix: true, contentType: "application/json" });
    const { blobs } = await list({ prefix: PREFIX, limit: 100 });
    const old = blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1)).slice(KEEP);
    if (old.length) await del(old.map((b) => b.url));
    return;
  }
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, "collection.json"), body);
}

/** Read-modify-write helper. */
export async function updateStore<T>(fn: (doc: StoreDoc) => T | Promise<T>) {
  const doc = await readStore();
  const result = await fn(doc);
  await writeStore(doc);
  return result;
}

export async function savePhoto(data: Buffer, ext: "jpg" | "png" | "webp") {
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  if (blobEnabled()) {
    const blob = await put(`planetracker/photos/${name}`, data, { access: "public", addRandomSuffix: true, contentType: ext === "jpg" ? "image/jpeg" : `image/${ext}` });
    return blob.url;
  }
  await fs.mkdir(path.join(LOCAL_DIR, "photos"), { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, "photos", name), data);
  return `/api/photos?f=${name}`;
}

export async function readLocalPhoto(name: string) {
  if (!/^[\w-]+\.(jpg|png|webp)$/.test(name)) return null;
  try {
    return await fs.readFile(path.join(LOCAL_DIR, "photos", name));
  } catch {
    return null;
  }
}

export async function deletePhoto(url: string) {
  if (blobEnabled() && url.startsWith("https://")) await del(url).catch(() => {});
}
