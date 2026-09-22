import crypto from "crypto";
import { auth } from "@/auth";
import { isLocal } from "@/lib/is-local";

// Mirrors Stickies' authorizeOwner: local/LAN bypass, then a static Bearer
// secret for scripts/AI agents, then the NextAuth owner-email session.
const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? process.env.ALLOWED_EMAIL)?.trim().toLowerCase();

// Bearer check shared by every API route: accepts the primary SEQUENCES_API_SECRET
// or the revocable partner key SEQUENCES_API_SECRET_PARTNER. Two generations of
// legacy names are still honored so nothing has to be rotated in lockstep with a
// deploy: DIAGRAMS_* (pre-rename) and AI_* (original). Constant-time compare per
// secret, length-checked. Takes a Request or a raw Authorization header value.
export function bearerOk(reqOrHeader: Request | string | null): boolean {
  const header = typeof reqOrHeader === "string"
    ? reqOrHeader
    : reqOrHeader?.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const secrets = [
    process.env.SEQUENCES_API_SECRET,
    process.env.SEQUENCES_API_SECRET_PARTNER,
    process.env.DIAGRAMS_API_SECRET,          // legacy alias (pre-rename)
    process.env.DIAGRAMS_API_SECRET_PARTNER,  // legacy alias (pre-rename)
    process.env.AI_API_SECRET,                // legacy alias (original)
    process.env.AI_API_SECRET_PARTNER,        // legacy alias (original)
  ].filter(Boolean) as string[];
  for (const secret of secrets) {
    const expected = `Bearer ${secret}`;
    if (header.length === expected.length) {
      try {
        if (crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected))) return true;
      } catch { /* length mismatch - ignore */ }
    }
  }
  return false;
}

export async function authorizeOwner(req: Request, opts: { allowBearer?: boolean } = {}): Promise<boolean> {
  const { allowBearer = true } = opts;

  // 1. Local/LAN — no login needed in dev
  if (isLocal(req)) return true;

  // 2. Static API secret (external scripts / AI agents). Skipped when the caller
  //    MUST be the logged-in owner — e.g. the AI-generate route, which spends
  //    Anthropic credits and is admin-only, never a public/Bearer option.
  if (allowBearer && bearerOk(req)) return true;

  // 3. NextAuth session cookie → only OWNER_EMAIL passes
  if (!OWNER_EMAIL) return false;
  const session = await auth();
  return session?.user?.email?.toLowerCase() === OWNER_EMAIL;
}

// The DB user_id used for the owner's rows. The legacy owner UUID is
// preserved via OWNER_USER_ID so existing diagrams keep resolving.
export function ownerId(): string | null {
  return process.env.OWNER_USER_ID?.trim() || null;
}

// Owner DB id if (and only if) the request is authorized, else null.
export async function resolveOwnerId(req: Request): Promise<string | null> {
  return (await authorizeOwner(req)) ? ownerId() : null;
}

// Server-component authorization: no Request is available, so authorize on the
// dev bypass or the NextAuth owner-email session (auth() reads cookies itself).
// The bypass only fires under a real local `next dev` (NODE_ENV=development) -
// production always requires the owner session, and no stray env var can flip it.
// Used by the server-rendered index page.
export async function resolveOwnerIdServer(): Promise<string | null> {
  const devBypass = process.env.NODE_ENV === "development";
  if (devBypass) return ownerId();
  if (!OWNER_EMAIL) return null;
  const session = await auth();
  return session?.user?.email?.toLowerCase() === OWNER_EMAIL ? ownerId() : null;
}
