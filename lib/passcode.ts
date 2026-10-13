import { scrypt, randomBytes, createHmac, createHash, createCipheriv, createDecipheriv, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// The share passcode, same scheme as Stickies and Flows. scrypt runs async on
// the threadpool so a flood of guesses at the public gate cannot freeze the
// event loop.
const scryptAsync = promisify(scrypt) as (plain: string, salt: Buffer, len: number) => Promise<Buffer>;

/** `salt$scrypt(passcode, salt)`, both hex. */
export async function hashPasscode(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(plain, salt, 32);
  return `${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPasscode(plain: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored || !stored.includes("$")) return false;
  const [saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scryptAsync(plain, Buffer.from(saltHex, "hex"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
}

// The unlock cookie is an HMAC of the sequence id and the CURRENT hash, so
// changing or removing the passcode voids every cookie already handed out.
export function unlockToken(id: string, hash: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET || "sequences-passcode").update(`${id}::${hash}`).digest("hex");
}

export function unlockCookieName(id: string): string {
  return `sequences_unlock_${String(id).replace(/[^a-z0-9-]/gi, "")}`;
}

/** True when the cookie header holds a valid unlock for this sequence. */
export function isUnlocked(cookieHeader: string | null | undefined, id: string, hash: string): boolean {
  const name = unlockCookieName(id);
  const part = String(cookieHeader || "").split(/;\s*/).find((p) => p.startsWith(`${name}=`));
  if (!part) return false;
  try {
    const a = Buffer.from(unlockToken(id, hash), "hex");
    const b = Buffer.from(decodeURIComponent(part.slice(name.length + 1)), "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

// A readable copy for the owner's own Passcode box: AES-256-GCM under a key
// derived from AUTH_SECRET, stored as iv.tag.data (base64url). Only ever
// opened for the owner; a visitor's check still goes through the hash.
const sealKey = () => createHash("sha256").update(`sequences-passcode:${process.env.AUTH_SECRET || "sequences-passcode"}`).digest();

export function sealPasscode(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", sealKey(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

/** The plain passcode, or "" when there is none or it will not open. */
export function openPasscode(sealed: string | null | undefined): string {
  if (!sealed) return "";
  try {
    const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", sealKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString("utf8");
  } catch { return ""; }
}

/** The 401 every gated read answers, so the app knows to send the visitor to the lock screen. */
export const PASSCODE_REQUIRED = (id: string) => ({ error: "Passcode required", passcode_required: true, id });
