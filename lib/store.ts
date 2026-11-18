import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { del, get, list, put } from "@vercel/blob";
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

type Access = "public" | "private";
/** Blob stores are created as either public or private; this is worked out on first use. */
let accessMode: Access | null = (process.env.BLOB_ACCESS as Access | undefined) ?? null;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Read one stored file. The public address is tried first; if storage refuses it (it has answered 403 for
 * a minute or two at a time), the same file is read through the authenticated API instead, which does not
 * go through the public CDN. Returns the text, or a description of what went wrong.
 */
async function readBlob(blob: { url: string; pathname: string }): Promise<{ text: string } | { error: string }> {
  const errors: string[] = [];
  const viaApi = (access: Access) => async () => {
    const got = await get(blob.pathname, { access, useCache: false });
    if (!got || got.statusCode !== 200) throw new Error("not found");
    accessMode ??= access;
    return new Response(got.stream).text();
  };
  const viaUrl = async () => {
    const res = await fetch(blob.url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    accessMode ??= "public";
    return res.text();
  };
  const attempts: [string, () => Promise<string>][] =
    accessMode === "private"
      ? [["private api", viaApi("private")], ["public url", viaUrl], ["public api", viaApi("public")]]
      : [["public url", viaUrl], ["public api", viaApi("public")], ["public url retry", () => pause(400).then(viaUrl)], ["private api", viaApi("private")]];
  for (const [label, attempt] of attempts) {
    try {
      return { text: await attempt() };
    } catch (e) {
      errors.push(`${label}: ${(e as Error).message}`.replace(/https?:\/\/\S+/g, "<url>"));
    }
  }
  return { error: errors.join("; ") };
}

/** Upload, trying the other kind of access if the store rejects the first. */
async function putBlob(pathname: string, body: string | Buffer, contentType: string) {
  const order: Access[] = accessMode === "private" ? ["private", "public"] : ["public", "private"];
  let last: unknown;
  for (const access of order) {
    try {
      const blob = await put(pathname, body, { access, addRandomSuffix: true, contentType });
      accessMode = access;
      return { blob, access };
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

const newestFirst = <T extends { pathname: string }>(blobs: T[]) => [...blobs].sort((a, b) => (a.pathname < b.pathname ? 1 : -1));

async function loadStore(): Promise<StoreDoc> {
  if (blobEnabled()) {
    const { blobs } = await list({ prefix: PREFIX, limit: 100 });
    if (!blobs.length) return empty();
    // Newest save wins. If it can't be read (e.g. it was removed a moment ago), fall back to the one before.
    const problems: string[] = [];
    for (const blob of newestFirst(blobs).slice(0, 4)) {
      const got = await readBlob(blob);
      if ("text" in got) {
        try {
          return normalize(JSON.parse(got.text));
        } catch {
          problems.push("unreadable JSON");
        }
      } else problems.push(got.error);
    }
    // Never pretend the collection is empty when saved data exists but can't be read: that could overwrite it.
    throw new Error(`Could not load the collection from storage (${problems[0]})`);
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
    const { blob: saved } = await putBlob(name, body, "application/json");
    // Tidy up old versions, but never let that break a save, and never touch the one just written.
    try {
      const { blobs } = await list({ prefix: PREFIX, limit: 100 });
      const old = newestFirst(blobs).filter((b) => b.pathname < saved.pathname).slice(KEEP - 1);
      if (old.length) await del(old.map((b) => b.url));
    } catch (e) {
      console.error("could not prune old collection versions", e);
    }
    return;
  }
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, "collection.json"), body);
}

/** Plain-language status for the health check. */
export async function storeStatus() {
  if (!blobEnabled()) return { storage: "local files (no BLOB_READ_WRITE_TOKEN set)", ok: !process.env.VERCEL };
  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 100 });
    const versions = newestFirst(blobs);
    const checks = [];
    for (const blob of versions.slice(0, 3)) {
      const got = await readBlob(blob);
      checks.push({ saved: blob.uploadedAt, bytes: blob.size, readable: "text" in got, problem: "error" in got ? got.error : undefined });
    }
    return { storage: "vercel blob", access: accessMode, versions: versions.length, ok: !versions.length || Boolean(checks[0]?.readable), checks };
  } catch (e) {
    return { storage: "vercel blob", ok: false, problem: `${(e as Error).name}: ${(e as Error).message}`.replace(/https?:\/\/\S+/g, "<url>") };
  }
}

/**
 * The collection as saved. While a page is being rendered the result is shared, so the layout and the page
 * read storage once between them instead of twice.
 */
export const readStore = cache(loadStore);

/** Name of the most recent saved version, used to notice a save made by someone else in the meantime. */
async function newestVersion() {
  if (!blobEnabled()) return null;
  const { blobs } = await list({ prefix: PREFIX, limit: 100 });
  return newestFirst(blobs)[0]?.pathname ?? null;
}

/**
 * Read-modify-write helper. Always reads fresh. If two people save at nearly the same moment, the later one
 * notices the other's save and re-applies its change on top, instead of silently undoing it.
 */
export function updateStore<T>(fn: (doc: StoreDoc) => T | Promise<T>): Promise<T> {
  // Saves handled by the same server instance run strictly one after another.
  const run = queue.then(() => applyUpdate(fn));
  queue = run.catch(() => {});
  return run;
}

let queue: Promise<unknown> = Promise.resolve();

async function applyUpdate<T>(fn: (doc: StoreDoc) => T | Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    const before = await newestVersion();
    const doc = await loadStore();
    const result = await fn(doc);
    if (attempt < 3 && (await newestVersion()) !== before) continue; // someone else saved; start again from their version
    await writeStore(doc);
    return result;
  }
}

export async function savePhoto(data: Buffer, ext: "jpg" | "png" | "webp") {
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  if (blobEnabled()) {
    const { blob, access } = await putBlob(`planetracker/photos/${name}`, data, ext === "jpg" ? "image/jpeg" : `image/${ext}`);
    // Photos in a private store can't be linked directly, so they are served through this site.
    return access === "public" ? blob.url : `/api/photos?p=${encodeURIComponent(blob.pathname)}`;
  }
  await fs.mkdir(path.join(LOCAL_DIR, "photos"), { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, "photos", name), data);
  return `/api/photos?f=${name}`;
}

export async function readPrivatePhoto(pathname: string) {
  if (!blobEnabled() || !/^planetracker\/photos\/[\w.-]+$/.test(pathname)) return null;
  const got = await get(pathname, { access: "private" }).catch(() => null);
  return got && got.statusCode === 200 ? { stream: got.stream, contentType: got.blob.contentType } : null;
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
  if (!blobEnabled()) return;
  const target = url.startsWith("/api/photos?p=") ? decodeURIComponent(url.slice("/api/photos?p=".length)) : url.startsWith("https://") ? url : null;
  if (target) await del(target).catch(() => {});
}
