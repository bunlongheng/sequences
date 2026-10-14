import db from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { verifyPasscode, unlockToken, unlockCookieName } from "@/lib/passcode";
import { gatePage } from "@/lib/passcode-pages";
import type { Scene } from "@/lib/passcode-pages";
import { shareChrome } from "@/lib/share-chrome";
import { parse, buildSvg, DEFAULT_OPTS, DEFAULT_LAYOUT } from "@/lib/svg-renderer";
import type { Opts, Layout } from "@/lib/svg-renderer";
import { Resvg } from "@resvg/resvg-js";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET  /api/sequences/:id/unlock -> the lock screen (the share page and the
//                                   editor send a visitor here when the
//                                   sequence is passcode-locked).
// POST /api/sequences/:id/unlock -> check the passcode; right sets a 30-day
//                                   unlock cookie and goes to /s/:id?reveal=1,
//                                   which plays the reveal; wrong redraws the
//                                   lock screen.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const html = (body: string, status = 200) => new Response(body, {
  status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
});

type Row = { id: string; title: string | null; is_public: boolean; passcode_hash: string | null; code: string | null; settings: { opts?: Partial<Opts>; layout?: Partial<Layout> } | null; created_at: Date | null };

async function load(id: string): Promise<Row | null> {
  if (!UUID.test(id || "")) return null;
  const { rows } = await db.query(
    "SELECT id, title, is_public, passcode_hash, code, settings, created_at FROM sequences WHERE id = $1", [id],
  ).catch(() => ({ rows: [] as Row[] }));
  return (rows[0] as Row) || null;
}

const back = (id: string) => `/s/${id}`;

// Roboto is bundled (see opengraph-image.tsx) so resvg draws text on serverless.
const FONT_FILES = ["Roboto-Regular.ttf", "Roboto-Bold.ttf"].map((f) => join(process.cwd(), "lib/fonts", f));

// The share page behind the glass: the diagram as a 360 px wide PNG, shown at
// its own size on the paper and blurred by the page. A label is 3 px tall in
// it, so nothing can be read, but the lifelines, boxes and arrows keep their
// shape. Only this thumbnail ever leaves the server; null (a plain wash) if
// it cannot render.
function scene(row: Row): Scene | null {
  try {
    if (!row.code?.trim()) return null;
    const opts: Opts = { ...DEFAULT_OPTS, ...(row.settings?.opts ?? {}), autoLayout: true };
    const layout: Layout = { ...DEFAULT_LAYOUT, ...(row.settings?.layout ?? {}) };
    const when = row.created_at ? new Date(row.created_at) : new Date();
    const svg = buildSvg(parse(row.code), opts, layout, when, { titleBlock: false, fitLetter: true });
    const m = svg.match(/width="([\d.]+)"\s+height="([\d.]+)"/);
    const width = m ? parseFloat(m[1]) : 800, height = m ? parseFloat(m[2]) : 450;
    const png = new Resvg(svg, { fitTo: { mode: "width", value: 360 }, font: { fontFiles: FONT_FILES, defaultFontFamily: "Roboto", loadSystemFonts: false } }).render().asPng();
    const byline = `${when.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${when.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
    return { png: `data:image/png;base64,${Buffer.from(png).toString("base64")}`, width, height, byline, c: shareChrome(opts.theme) };
  } catch {
    return null;
  }
}

const gate = (row: Row, bad?: boolean) =>
  gatePage({ action: `/api/sequences/${row.id}/unlock`, title: row.title || "Locked sequence", bad, scene: scene(row) });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await load(id);
  if (!row || row.is_public === false) return new Response("Not found", { status: 404 });
  if (!row.passcode_hash) return new Response(null, { status: 302, headers: { Location: back(id) } });
  return html(gate(row));
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
    return html(gate(row, true), 401);
  }
  // Straight on to the diagram, which plays the reveal (app/s/[id]/UnlockReveal.tsx).
  const res = new Response(null, { status: 303, headers: { Location: `${back(id)}?reveal=1`, "Cache-Control": "no-store" } });
  const secure = req.url.startsWith("https://") ? "; Secure" : "";
  res.headers.append("Set-Cookie",
    `${unlockCookieName(id)}=${unlockToken(id, row.passcode_hash)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secure}`);
  return res;
}
