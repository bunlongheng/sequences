import { NextRequest, NextResponse } from "next/server";
import { bearerOk } from "@/lib/auth-owner";
import db from "@/lib/db";

/**
 * GET /api/sequences/[id]/export
 *
 * Returns the diagram's Mermaid code + metadata for the owner. Rendering is done
 * by the caller (e.g. deck-gen.mjs renders it client-side via the mermaid CDN);
 * nothing is sent off-host. `svg` is always null here and kept only so existing
 * callers that read the field keep working.
 *
 * Headers:
 *   Authorization: Bearer <SEQUENCES_API_SECRET or SEQUENCES_API_SECRET_PARTNER (legacy: AI_API_SECRET)>
 *
 * Response 200:
 *   { "id": "…", "title": "…", "code": "…", "sequenceType": "…", "svg": null }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  // ── Auth ──────────────────────────────────────────────────────────────────
  if (!process.env.SEQUENCES_API_SECRET && !process.env.SEQUENCES_API_SECRET_PARTNER && !process.env.DIAGRAMS_API_SECRET && !process.env.DIAGRAMS_API_SECRET_PARTNER && !process.env.AI_API_SECRET && !process.env.AI_API_SECRET_PARTNER) {
    return NextResponse.json({ error: "SEQUENCES_API_SECRET not configured" }, { status: 500 });
  }
  if (!bearerOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // ── Fetch diagram ─────────────────────────────────────────────────────────
  const { rows } = await db.query("SELECT id, title, code, sequence_type FROM sequences WHERE id = $1", [id]);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Diagram not found" }, { status: 404 });
  }
  const diagram = rows[0];

  return NextResponse.json({
    id: diagram.id,
    title: diagram.title,
    code: diagram.code,
    sequenceType: diagram.sequence_type,
    svg: null,
  });
  } catch (outerErr: unknown) {
    const msg = outerErr instanceof Error ? outerErr.message : String(outerErr);
    console.error("[export] outer catch:", msg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
