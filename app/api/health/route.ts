import { storeStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Quick check that the site can reach its storage. Shows no collection data or addresses. */
export async function GET() {
  const status = await storeStatus();
  return Response.json(status, { status: status.ok ? 200 : 503 });
}
