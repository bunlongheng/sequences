// Fail-fast validation of the env vars the app needs to actually work in
// production. Imported by next.config.ts so a misconfigured PRODUCTION build
// throws and FAILS the deploy - instead of silently shipping a dead app.
//
// This is the guard for exactly how login broke: NextAuth deployed to prod
// with no AUTH_SECRET / Google creds set on Vercel, and sat broken for days
// because nothing refused the bad deploy. With this, that build never ships.

const REQUIRED_IN_PRODUCTION = [
  "AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "DATABASE_URL",
  "OWNER_USER_ID",
] as const;

// OWNER_EMAIL or ALLOWED_EMAIL (either one satisfies the single-owner gate).
function ownerEmailPresent(): boolean {
  return Boolean(process.env.OWNER_EMAIL?.trim() || process.env.ALLOWED_EMAIL?.trim());
}

export function validateEnv(): void {
  // Only enforce on real production builds/runtime. Local dev, CI, and Vercel
  // preview deploys are intentionally lenient (they use dummy/omitted values).
  if (process.env.VERCEL_ENV !== "production") return;

  const missing: string[] = REQUIRED_IN_PRODUCTION.filter((k) => !process.env[k]?.trim());
  if (!ownerEmailPresent()) missing.push("OWNER_EMAIL (or ALLOWED_EMAIL)");

  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required production env var(s): ${missing.join(", ")}. ` +
        `Set them in Vercel (Production) before deploying - login and data will not work without these.`,
    );
  }
}

validateEnv();
