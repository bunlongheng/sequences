import { ImageResponse } from "next/og";
import { Resvg } from "@resvg/resvg-js";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import db from "@/lib/db";
import { parse, buildSvg, DEFAULT_OPTS, DEFAULT_LAYOUT } from "@/lib/svg-renderer";
import type { Opts, Layout } from "@/lib/svg-renderer";
import { shareChrome } from "@/lib/share-chrome";
import type { ShareChrome } from "@/lib/share-chrome";

export const runtime = "nodejs";

// Roboto matches the diagram font; bundled (see outputFileTracingIncludes) so
// resvg renders text on serverless, where no system fonts exist.
const FONT_FILES = ["Roboto-Regular.ttf", "Roboto-Bold.ttf"].map((f) => join(process.cwd(), "lib/fonts", f));
// The wordmark and fallback text use the same bold as the page header.
const ogFonts = () => [{ name: "Roboto", data: readFileSync(FONT_FILES[1]), weight: 800 as const, style: "normal" as const }];
export const dynamic = "force-dynamic";
export const alt = "Diagram preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The same look as the public /s/[id] page the link opens: top bar with the
// icon and wordmark, the ground, the diagram (title and byline already drawn
// inside it) in a card - all in the diagram's own theme.
// Read per render, not at module load: a missing file on serverless must
// cost the icon, never the whole card.
const iconUri = () => {
  try { return `data:image/png;base64,${readFileSync(join(process.cwd(), "public/icon-512.png")).toString("base64")}`; }
  catch { return null; }
};

const TopBar = ({ icon, c }: { icon: string | null; c: ShareChrome }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, height: 72, padding: "0 32px", background: c.bar, borderBottom: `1px solid ${c.barBorder}`, flexShrink: 0 }}>
    {icon && <img src={icon} width={36} height={36} alt="" style={{ borderRadius: 9 }} />}
    <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.3, color: c.barText }}>Sequences</div>
  </div>
);

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const icon = iconUri();

  let svg: string | null = null;
  let c = shareChrome("light");
  // A passcode-locked sequence still previews, but says so: its title, a
  // "Locked" chip, and the drawing blurred past reading under a big lock.
  let locked = false;
  let lockedTitle = "";
  if (UUID.test(id)) {
    const { rows } = await db.query("SELECT code, settings, title, created_at, passcode_hash FROM sequences WHERE id = $1", [id]);
    if (rows.length && rows[0].code?.trim()) {
      const { code, settings, title: dbTitle, created_at } = rows[0];
      const opts: Opts = { ...DEFAULT_OPTS, ...(settings?.opts ?? {}), autoLayout: true };
      const layout: Layout = { ...DEFAULT_LAYOUT, ...(settings?.layout ?? {}) };
      const diagram = parse(code);
      if (!diagram.title && dbTitle) diagram.title = dbTitle;
      locked = Boolean(rows[0].passcode_hash);
      lockedTitle = diagram.title || dbTitle || "Diagram";
      // Locked: the title is printed above the card, so the drawing carries none.
      svg = buildSvg(diagram, opts, layout, created_at ?? undefined, locked ? { titleBlock: false } : undefined);
      c = shareChrome(opts.theme);
    }
  }

  if (!svg) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: c.ground }}>
          <TopBar icon={icon} c={c} />
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", fontSize: 38, color: "#6b7280" }}>Diagram not found</div>
        </div>
      ),
      { ...size, fonts: ogFonts() }
    );
  }

  const m = svg.match(/width="([\d.]+)"\s+height="([\d.]+)"/);
  const W = m ? parseFloat(m[1]) : 800;
  const H = m ? parseFloat(m[2]) : 450;
  // Fit the diagram into the white card's inner area, preserving aspect ratio.
  const boxW = 1072, boxH = locked ? 360 : 470;
  const scale = Math.min(boxW / W, boxH / H, 1.6);
  const dw = Math.round(W * scale), dh = Math.round(H * scale);
  // Blur 16 px at the size it is drawn, then a 35% white veil over it.
  if (locked) {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><filter id="lockblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${(16 / scale).toFixed(2)}"/></filter></defs><g filter="url(#lockblur)">${svg}</g><rect width="${W}" height="${H}" fill="#ffffff" fill-opacity="0.35"/></svg>`;
  }
  // resvg rasterizes the SVG to PNG with the bundled Roboto font so text labels
  // render on serverless; fall back to the raw SVG (shapes only) if resvg fails.
  let dataUri: string;
  try {
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: dw }, font: { fontFiles: FONT_FILES, defaultFontFamily: "Roboto", loadSystemFonts: false } });
    const png = resvg.render().asPng();
    dataUri = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
  } catch {
    dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: c.ground }}>
        <TopBar icon={icon} c={c} />
        {locked && (
          <div style={{ display: "flex", flexDirection: "column", padding: "28px 40px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: 34, fontWeight: 800, color: c.barText, maxWidth: 940, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{lockedTitle}</div>
              <div style={{ display: "flex", padding: "4px 14px", borderRadius: 999, background: "#16191d", color: "#ffffff", fontSize: 18 }}>Locked</div>
            </div>
            <div style={{ marginTop: 8, fontSize: 20, color: c.muted }}>Passcode protected. Type the passcode to open it.</div>
          </div>
        )}
        <div style={{ display: "flex", flex: 1, margin: locked ? "20px 40px 40px" : 40, position: "relative", alignItems: "center", justifyContent: "center", background: c.card, padding: 24, overflow: "hidden", border: `1px solid ${c.cardBorder}`, boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUri} width={dw} height={dh} alt="" />
          {locked && (
            <div style={{ position: "absolute", top: "50%", left: "50%", width: 192, height: 192, marginTop: -96, marginLeft: -96, borderRadius: 96, background: "#16191d", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="104" height="104" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, fonts: ogFonts() }
  );
}
