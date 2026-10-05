import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { after } from "next/server";
import Wordmark from "@/app/Wordmark";
import { notFound } from "next/navigation";
import db from "@/lib/db";
import { parse, buildSvg, DEFAULT_OPTS, DEFAULT_LAYOUT } from "@/lib/svg-renderer";
import type { Opts, Layout } from "@/lib/svg-renderer";
import { shareChrome } from "@/lib/share-chrome";
import { isBot, notifyShareView, readVisit } from "@/lib/share-alert";
import SocialFooter from "../../SocialFooter";

export const revalidate = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = { code: string; settings: { opts?: Partial<Opts>; layout?: Partial<Layout> } | null; title: string | null; created_at: Date | null };

const getDiagram = cache(async (id: string): Promise<Row | null> => {
  if (!UUID.test(id)) return null;
  const { rows } = await db.query("SELECT code, settings, title, created_at FROM sequences WHERE id = $1", [id]);
  if (!rows.length || !rows[0].code?.trim()) return null;
  return rows[0] as Row;
});

function render(row: Row) {
  // Compact, like /svg/<id> and the editor: Auto is forced on for the public
  // view so a stored hand-tuned layout never widens the row pitch for readers.
  const opts: Opts = { ...DEFAULT_OPTS, ...(row.settings?.opts ?? {}), autoLayout: true };
  const layout: Layout = { ...DEFAULT_LAYOUT, ...(row.settings?.layout ?? {}) };
  const diagram = parse(row.code);
  if (!diagram.title && row.title) diagram.title = row.title;
  // The paper draws the title and byline itself, top left, so the SVG carries
  // the drawing alone (titleBlock: false), its columns pulled in toward a
  // Letter page's proportions (fitLetter) so it fills the paper, not a strip.
  const when = row.created_at ? new Date(row.created_at) : new Date();
  const byline = `${when.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${when.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
  return { svg: buildSvg(diagram, opts, layout, when, { titleBlock: false, fitLetter: true }), title: diagram.title || row.title || "Diagram", byline, c: shareChrome(opts.theme) };
}

// The gutter between the ground's edge and the paper, on all 4 sides. 20 is the
// header's own gutter, so the paper's edges line up with the wordmark on the
// left and the action pill on the right.
const GUTTER = 20;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = await getDiagram(id);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "sequences-bheng.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${host}`;
  const title = row ? render(row).title : "Diagram not found";
  const description = row ? "View this diagram - copy the link, open it in the editor, or export it." : "This diagram does not exist.";
  return {
    metadataBase: new URL(base),
    title: `${title} · Sequences`,
    description,
    openGraph: { title, description, type: "article", url: `${base}/d/${id}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function DiagramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getDiagram(id);
  if (!row) notFound();
  const { svg, title, byline, c } = render(row);

  // Every real view tells the owner. Runs after the response is sent, so the
  // reader never waits on it, and after() keeps the Vercel function alive
  // until it finishes: a bare unawaited promise was frozen with the function
  // and the email and note never went out. Link-preview crawlers (iMessage,
  // Slack, WhatsApp) are ignored.
  const h = await headers();
  if (!isBot(h.get("user-agent"))) {
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "sequences-bheng.vercel.app";
    const visit = readVisit(h, { id, title, link: `${h.get("x-forwarded-proto") ?? "https"}://${host}/s/${id}` });
    after(() => notifyShareView(visit));
  }

  return (
    <main style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: c.ground, fontFamily: "system-ui,-apple-system,sans-serif" }}>
      {/* Slim top bar — logo + demo/sign-in, no editing chrome. */}
      <header style={{
        height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", background: c.bar, borderBottom: `1px solid ${c.barBorder}`,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <a href="/demo" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          {/* The app's own mark. This bar used to hand-draw 3 coloured
              rectangles, which is not the logo - the icon is 3 lifelines with
              messages crossing them. */}
          <Wordmark size={28} color={c.barText} />
        </a>
        {/* The reader's 1 action sits in the same floating pill Flows puts at the
            right of a shared diagram, and the pill's tiles are the squares the
            footer ends with: a shared link reads the same at the top and at the
            bottom, in every app in the family. */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, background: "#ffffff", border: "1px solid #e4e6e8", borderRadius: 14, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: "4px 6px" }}>
          <style>{`.sq-act{display:flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:8px;color:#64748b;font-size:13px;text-decoration:none;transition:background .1s}.sq-act:hover{background:#f1f5f9}`}</style>
          <a className="sq-act" href={`/svg/${id}`} title="Download this diagram as an SVG">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" />
            </svg>
            <span>Download SVG</span>
          </a>
        </div>
      </header>

      {/* The paper: 1 white sheet that fills the whole ground between the header
          and the footer, with the same GUTTER on all 4 sides, so nothing on the
          page scrolls. The bottom gutter is the footer's own 20px top margin.
          Title and byline sit top left on the paper, like a figure caption; only
          the drawing is centered in the space that remains, shrunk to fit when
          it is bigger and shown at its natural size when it is smaller, so a
          2-step diagram is not blown up to the size of the window. */}
      <div style={{ flex: 1, minHeight: 0, padding: `${GUTTER}px ${GUTTER}px 0` }}>
        <style>{`.dgview { display: flex; align-items: center; justify-content: center; } .dgview svg { max-width: 100%; max-height: 100%; width: auto; height: auto; display: block; }`}</style>
        <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 12, padding: 28, background: c.card, border: `1px solid ${c.cardBorder}`, boxShadow: "0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>
          <div style={{ fontFamily: "var(--font-roboto), system-ui, sans-serif", flexShrink: 0 }}>
            <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 700, color: c.barText }}>{title}</h1>
            <div style={{ marginTop: 6, fontSize: 11, color: c.muted }}>
              <span style={{ fontWeight: 700 }}>BH</span><span style={{ opacity: 0.5 }}> | </span>{byline}
            </div>
          </div>
          <div className="dgview" style={{ flex: 1, minHeight: 0 }} dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: `0 ${GUTTER}px 12px` }}>
        <SocialFooter />
      </div>
    </main>
  );
}
