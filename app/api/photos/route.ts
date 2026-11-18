import { requireAuth } from "@/lib/auth";
import { deletePhoto, readLocalPhoto, readPrivatePhoto, savePhoto, updateStore } from "@/lib/store";

const TYPES: Record<string, "jpg" | "png" | "webp"> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Attach one of the collector's own photos to a plane model (key = catalogue id, or the item id for custom planes). */
export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const form = await request.formData();
  const file = form.get("file");
  const key = String(form.get("key") ?? "");
  if (!(file instanceof File) || !key || key.length > 120) return Response.json({ error: "Missing photo" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ error: "Photos must be JPEG, PNG or WebP" }, { status: 400 });
  if (file.size > 4_000_000) return Response.json({ error: "Photo is too large" }, { status: 400 });
  const url = await savePhoto(Buffer.from(await file.arrayBuffer()), ext);
  const photos = await updateStore((doc) => {
    doc.modelPhotos[key] = [...(doc.modelPhotos[key] ?? []), url].slice(-8);
    return doc.modelPhotos[key];
  });
  return Response.json({ url, photos }, { status: 201 });
}

export async function DELETE(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { key, url } = (await request.json().catch(() => ({}))) as { key?: string; url?: string };
  if (!key || !url) return Response.json({ error: "Missing photo" }, { status: 400 });
  const photos = await updateStore((doc) => {
    if (!doc.modelPhotos[key]?.includes(url)) return null;
    doc.modelPhotos[key] = doc.modelPhotos[key].filter((u) => u !== url);
    if (!doc.modelPhotos[key].length) delete doc.modelPhotos[key];
    return doc.modelPhotos[key] ?? [];
  });
  if (!photos) return Response.json({ error: "Not found" }, { status: 404 });
  await deletePhoto(url);
  return Response.json({ photos });
}

/** Serves photos that have no public address: ones in a private Blob store, and local-development files. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const pathname = params.get("p");
  if (pathname) {
    const photo = await readPrivatePhoto(pathname);
    if (!photo) return new Response("Not found", { status: 404 });
    return new Response(photo.stream, { headers: { "Content-Type": photo.contentType, "Cache-Control": "public, max-age=31536000, immutable" } });
  }
  const name = params.get("f") ?? "";
  const data = await readLocalPhoto(name);
  if (!data) return new Response("Not found", { status: 404 });
  const ext = name.split(".").pop();
  return new Response(new Uint8Array(data), { headers: { "Content-Type": ext === "jpg" ? "image/jpeg" : `image/${ext}`, "Cache-Control": "public, max-age=31536000, immutable" } });
}
