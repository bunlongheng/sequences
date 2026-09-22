import { NextResponse } from "next/server";
import pool from "@/lib/db";

// Liveness + readiness probe for the prod monitor and post-deploy smoke test.
// Verifies the two things that actually break login/data: auth config presence
// and DB reachability. Returns 503 if anything is wrong so a monitor goes RED.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean> = {
    auth_secret: Boolean(process.env.AUTH_SECRET?.trim()),
    google_oauth: Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()),
    owner_email: Boolean(process.env.OWNER_EMAIL?.trim() || process.env.ALLOWED_EMAIL?.trim()),
    database: false,
  };

  try {
    await pool.query("SELECT 1");
    checks.database = true;
  } catch {
    checks.database = false;
  }

  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
