import db from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { verifyPasscode, unlockToken, unlockCookieName } from "@/lib/passcode";
import { gatePage, unlockedPage } from "@/lib/passcode-pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET  /api/sequences/:id/unlock -> the lock screen (the share page and the
//                                   editor send a visitor here when the
//                                   sequence is passcode-locked).
// POST /api/sequences/:id/unlock -> check the passcode; right sets a 30-day
//                                   unlock cookie and plays the access-granted
//                                   beat on the way back to /s/:id, wrong
//                                   redraws the safe.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const html = (body: string, status = 200) => new Response(body, {
  status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
});

type Row = { id: string; title: string | null; is_public: boolean; passcode_hash: string | null };

async function load(id: string): Promise<Row | null> {
  if (!UUID.test(id || "")) return null;
  const { rows } = await db.query(
    "SELECT id, title, is_public, passcode_hash FROM sequences WHERE id = $1", [id],
  ).catch(() => ({ rows: [] as Row[] }));
  return (rows[0] as Row) || null;
}

const back = (id: string) => `/s/${id}`;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await load(id);
  if (!row || row.is_public === false) return new Response("Not found", { status: 404 });
  if (!row.passcode_hash) return new Response(null, { status: 302, headers: { Location: back(id) } });
  return html(gatePage({ action: `/api/sequences/${id}/unlock`, title: row.title || "Locked sequence" }));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Before the DB hit and the deliberately slow scrypt: 10 guesses / 5 min.
  const limited = rateLimit(req, { key: "unlock", limit: 10, windowMs: 300000 });
  if (!limited.ok) {
    return new Response("Too many attempts. Wait a few minutes and try again.", {
      status: 429, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": String(limited.retryAfter) },
    });
  }
  const row = await load(id);
  if (!row || row.is_public === false) return new Response("Not found", { status: 404 });
  if (!row.passcode_hash) return new Response(null, { status: 303, headers: { Location: back(id) } });

  const form = await req.formData().catch(() => null);
  const passcode = String(form?.get("passcode") ?? "").trim().toLowerCase();
  if (!(await verifyPasscode(passcode, row.passcode_hash))) {
    return html(gatePage({ action: `/api/sequences/${id}/unlock`, title: row.title || "Locked sequence", bad: true }), 401);
  }
  const res = html(unlockedPage({ target: back(id) }));
  const secure = req.url.startsWith("https://") ? "; Secure" : "";
  res.headers.append("Set-Cookie",
    `${unlockCookieName(id)}=${unlockToken(id, row.passcode_hash)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secure}`);
  return res;
}
