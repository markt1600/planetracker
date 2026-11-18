"use client";

/** Ask the passcode modal (mounted in the layout) to sign in. Resolves true once signed in. */
export function requestPasscode() {
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent("pt:passcode", { detail: resolve }));
  });
}

/** fetch wrapper: parses JSON, surfaces server error messages, and retries once after a passcode prompt. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data as T;
    if (res.status === 401 && data.needsPasscode && attempt === 0 && (await requestPasscode())) continue;
    throw new Error(data.error ?? `Something went wrong (${res.status})`);
  }
}

/** Shrink a photo in the browser so uploads stay small and fast. */
export async function shrinkImage(file: File, max = 1568, quality = 0.85) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read that photo"))), "image/jpeg", quality));
  return blob;
}

export async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function uploadPhoto(key: string, blob: Blob) {
  const form = new FormData();
  form.set("key", key);
  form.set("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
  return api<{ url: string; photos: string[] }>("/api/photos", { method: "POST", body: form });
}
