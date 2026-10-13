import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { authorizeOwner, resolveOwnerId } from "@/lib/auth-owner";
import { hashPasscode, isUnlocked, openPasscode, sealPasscode, PASSCODE_REQUIRED } from "@/lib/passcode";

// GET /api/sequences/[id] — public only if is_public=true, else owner-only
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { rows } = await db.query("SELECT * FROM sequences WHERE id = $1", [id]);
    const data = rows[0];
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Private diagrams require owner authorization (local bypass / Bearer / session).
    const owner = !data.is_public || data.passcode_hash ? await authorizeOwner(req) : false;
    if (!data.is_public && !owner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // A passcode-locked share serves nothing until the visitor has unlocked it
    // on the lock screen. The editor reads this 401 and sends them to
    // /api/sequences/:id/unlock.
    const locked = Boolean(data.passcode_hash);
    if (locked && !owner && !isUnlocked(req.headers.get("cookie"), data.id, data.passcode_hash)) {
      return NextResponse.json(PASSCODE_REQUIRED(data.id), { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    // The hash never leaves the server; only the owner gets the passcode back,
    // for their own Passcode box. A locked read must not sit in a shared cache.
    const { passcode_enc: enc, ...row } = data;
    delete row.passcode_hash;
    return NextResponse.json(
      { ...row, has_passcode: locked, ...(owner && locked ? { passcode: openPasscode(enc) } : {}) },
      locked ? { headers: { "Cache-Control": "private, no-store" } } : undefined,
    );
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

    // { passcode: string } - set the share passcode, or "" to remove it. Owner
    // UI only, like "locked". Setting one also publishes the sequence: a
    // passcode on a private sequence would gate a link nobody can open anyway.
    if (!isApiCall && typeof body.passcode === "string") {
      const plain = body.passcode.trim().toLowerCase();
      if (plain.length > 200) return NextResponse.json({ error: "passcode is 200 characters at most" }, { status: 400 });
      const hash = plain ? await hashPasscode(plain) : null;
      const { rows } = await db.query(
        "UPDATE sequences SET passcode_hash = $1::text, passcode_enc = $4::text, is_public = (is_public OR $1::text IS NOT NULL) WHERE id = $2 AND user_id = $3 RETURNING id, is_public, (passcode_hash IS NOT NULL) AS has_passcode",
        [hash, id, userId, plain ? sealPasscode(plain) : null],
      );
      if (rows.length === 0) return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
      return NextResponse.json({ ...rows[0], passcode: plain });
    }

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

    // A locked diagram is frozen, not just undeletable: it is embedded in a
    // README or a Confluence page that expects it to stay as it is. Any content
    // change is refused with 423 unless this same request is the owner unlocking.
    const touchesContent = allowed.some(k => k !== "locked" && body[k] !== undefined);
    if (touchesContent && body.locked !== false) {
      const { rows } = await db.query("SELECT locked FROM sequences WHERE id = $1 AND user_id = $2", [id, userId]);
      if (rows[0]?.locked) {
        return NextResponse.json({ error: "This sequence is locked. Unlock it before editing.", locked: true }, { status: 423 });
      }
    }

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
