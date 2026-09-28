import { ImageResponse } from "next/og";
import { Resvg } from "@resvg/resvg-js";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import db from "@/lib/db";
import { parse, buildSvg, DEFAULT_OPTS, DEFAULT_LAYOUT } from "@/lib/svg-renderer";
import type { Opts, Layout } from "@/lib/svg-renderer";

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
// The same look as the public /s/[id] page the link opens: white top bar
// with the icon and wordmark, the grey ground, the diagram (title and byline
// already drawn inside it) in a white card.
const BG = "#eceef2";
// Read per render, not at module load: a missing file on serverless must
// cost the icon, never the whole card.
const iconUri = () => {
  try { return `data:image/png;base64,${readFileSync(join(process.cwd(), "public/icon-512.png")).toString("base64")}`; }
  catch { return null; }
};

const TopBar = ({ icon }: { icon: string | null }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, height: 72, padding: "0 32px", background: "#ffffff", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
    {icon && <img src={icon} width={36} height={36} alt="" style={{ borderRadius: 9 }} />}
    <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.3, color: "#111827" }}>Sequences</div>
  </div>
);

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const icon = iconUri();

  let svg: string | null = null;
  if (UUID.test(id)) {
    const { rows } = await db.query("SELECT code, settings, title, created_at FROM sequences WHERE id = $1", [id]);
    if (rows.length && rows[0].code?.trim()) {
      const { code, settings, title: dbTitle, created_at } = rows[0];
      const opts: Opts = { ...DEFAULT_OPTS, ...(settings?.opts ?? {}), autoLayout: true };
      const layout: Layout = { ...DEFAULT_LAYOUT, ...(settings?.layout ?? {}) };
      const diagram = parse(code);
      if (!diagram.title && dbTitle) diagram.title = dbTitle;
      svg = buildSvg(diagram, opts, layout, created_at ?? undefined);
    }
  }

  if (!svg) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: BG }}>
          <TopBar icon={icon} />
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
  const boxW = 1072, boxH = 470;
  const scale = Math.min(boxW / W, boxH / H, 1.6);
  const dw = Math.round(W * scale), dh = Math.round(H * scale);
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
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: BG }}>
        <TopBar icon={icon} />
        <div style={{ display: "flex", flex: 1, margin: 40, alignItems: "center", justifyContent: "center", background: "#ffffff", padding: 24, overflow: "hidden", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUri} width={dw} height={dh} alt="" />
        </div>
      </div>
    ),
    { ...size, fonts: ogFonts() }
  );
}
