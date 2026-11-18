import { isAuthed, passcodeEnabled, signIn } from "@/lib/auth";

export async function GET() {
  return Response.json({ enabled: passcodeEnabled(), authed: await isAuthed(), ai: Boolean(process.env.ANTHROPIC_API_KEY) });
}

export async function POST(request: Request) {
  const { passcode } = (await request.json().catch(() => ({}))) as { passcode?: string };
  if (!passcode || !(await signIn(passcode))) {
    return Response.json({ error: "That passcode isn't right." }, { status: 401 });
  }
  return Response.json({ ok: true });
}
