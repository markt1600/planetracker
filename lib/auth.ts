import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";

/**
 * Optional passcode. When SITE_PASSCODE is set, changing the collection, uploading photos and
 * using AI identification require signing in once per browser. Viewing is always open.
 */
const COOKIE = "pt_auth";

export const passcodeEnabled = () => Boolean(process.env.SITE_PASSCODE);

const token = () => crypto.createHmac("sha256", process.env.SITE_PASSCODE ?? "").update("planetracker-v1").digest("hex");

export async function isAuthed() {
  if (!passcodeEnabled()) return true;
  const value = (await cookies()).get(COOKIE)?.value ?? "";
  const expected = token();
  return value.length === expected.length && crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export async function signIn(passcode: string) {
  const a = Buffer.from(passcode);
  const b = Buffer.from(process.env.SITE_PASSCODE ?? "");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  (await cookies()).set(COOKIE, token(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  return true;
}

export async function requireAuth() {
  if (await isAuthed()) return null;
  return Response.json({ error: "Enter the passcode to make changes.", needsPasscode: true }, { status: 401 });
}
