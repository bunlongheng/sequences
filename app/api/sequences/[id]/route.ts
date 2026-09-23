import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { authorizeOwner, resolveOwnerId } from "@/lib/auth-owner";

// GET /api/sequences/[id] — public only if is_public=true, else owner-only
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { rows } = await db.query("SELECT * FROM sequences WHERE id = $1", [id]);
    const data = rows[0];
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Private diagrams require owner authorization (local bypass / Bearer / session).
    if (!data.is_public && !(await authorizeOwner(req))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("[diagrams/id] GET error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH /api/sequences/[id] — update diagram fields (owner only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveOwnerId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Automation/API integrations may never touch tags — those stay owner-managed.
    const isApiCall = !!req.headers.get("authorization")?.trim();

    // Build dynamic SET clause from allowed fields
    // "locked" is owner-UI only: an automation holding the Bearer must not be
    // able to unlock a diagram and then delete it in the next call.
    const allowed = isApiCall
      ? ["title", "code", "settings", "is_public"]
      : ["title", "code", "tags", "settings", "is_public", "locked"];
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === "tags") {
          setClauses.push(`${key} = $${paramIdx}::text[]`);
        } else if (key === "settings") {
          setClauses.push(`${key} = $${paramIdx}::jsonb`);
        } else {
          setClauses.push(`${key} = $${paramIdx}`);
        }
        values.push(key === "settings" ? JSON.stringify(body[key]) : body[key]);
        paramIdx++;
      }
    }

    if (setClauses.length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 });

    setClauses.push("updated_at = now()");
    values.push(id, userId);

    const sql = `UPDATE sequences SET ${setClauses.join(", ")} WHERE id = $${paramIdx} AND user_id = $${paramIdx + 1}`;
    const { rowCount } = await db.query(sql, values);
    if (rowCount === 0) return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[diagrams/id] PATCH error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/sequences/[id] — delete diagram (owner only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveOwnerId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    // A locked diagram is a dependency of something outside this app - a README
    // image, a Confluence page, the public demo wall. The guard is in the SQL
    // rather than a read-then-delete so a concurrent unlock cannot slip past it.
    const { rowCount } = await db.query(
      "DELETE FROM sequences WHERE id = $1 AND user_id = $2 AND locked = false",
      [id, userId]
    );
    if (rowCount === 0) {
      const { rows } = await db.query("SELECT locked FROM sequences WHERE id = $1 AND user_id = $2", [id, userId]);
      if (rows[0]?.locked) {
        return NextResponse.json({ error: "This sequence is locked. Unlock it before deleting.", locked: true }, { status: 423 });
      }
      return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[diagrams/id] DELETE error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
