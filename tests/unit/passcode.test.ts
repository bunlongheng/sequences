/**
 * The share passcode: a passcode-locked sequence serves nothing to a visitor
 * until the lock screen has set the unlock cookie; the owner always gets in.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth-owner", () => ({
  authorizeOwner: vi.fn(),
  resolveOwnerId: vi.fn(),
  resolveOwnerIdServer: vi.fn(),
  ownerId: vi.fn(),
  bearerOk: vi.fn(() => false),
}));
vi.mock("@/lib/db", () => ({ default: { query: vi.fn() } }));
vi.mock("@/app/LandingDemo", () => ({ default: () => null }));
const { hdrs } = vi.hoisted(() => ({ hdrs: { cookie: "" } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(hdrs.cookie ? { cookie: hdrs.cookie, "user-agent": "bot" } : { "user-agent": "bot" }) }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND"); },
  redirect: (to: string) => { throw new Error(`REDIRECT ${to}`); },
}));

import db from "@/lib/db";
import { authorizeOwner, resolveOwnerId, resolveOwnerIdServer } from "@/lib/auth-owner";
import { hashPasscode, verifyPasscode, sealPasscode, openPasscode, unlockToken, unlockCookieName, isUnlocked } from "@/lib/passcode";

const q = db.query as unknown as ReturnType<typeof vi.fn>;
const mockAuthorizeOwner = authorizeOwner as unknown as ReturnType<typeof vi.fn>;
const mockResolveOwnerId = resolveOwnerId as unknown as ReturnType<typeof vi.fn>;
const mockResolveOwnerIdServer = resolveOwnerIdServer as unknown as ReturnType<typeof vi.fn>;

const ID = "11111111-2222-3333-4444-555555555555";
let HASH = "";
const cookieFor = (hash: string) => `${unlockCookieName(ID)}=${unlockToken(ID, hash)}`;
const lockedRow = () => ({ id: ID, title: "Secret", code: "sequenceDiagram\nA->>B: hi", settings: null, created_at: new Date().toISOString(), is_public: true, passcode_hash: HASH, passcode_enc: sealPasscode("open sesame") });
const ctx = { params: Promise.resolve({ id: ID }) };

beforeEach(async () => {
  vi.clearAllMocks();
  mockAuthorizeOwner.mockResolvedValue(false);
  mockResolveOwnerId.mockResolvedValue(null);
  mockResolveOwnerIdServer.mockResolvedValue(null);
  hdrs.cookie = "";
  q.mockResolvedValue({ rows: [], rowCount: 0 });
  if (!HASH) HASH = await hashPasscode("open sesame");
});

describe("lib/passcode", () => {
  it("verifies the right passcode and rejects a wrong one", async () => {
    expect(await verifyPasscode("open sesame", HASH)).toBe(true);
    expect(await verifyPasscode("nope", HASH)).toBe(false);
    expect(await verifyPasscode("open sesame", null)).toBe(false);
  });

  it("seals a readable copy only the server key opens", () => {
    expect(openPasscode(sealPasscode("abc"))).toBe("abc");
    expect(openPasscode("garbage")).toBe("");
  });

  it("accepts only the cookie signed for the current hash", async () => {
    expect(isUnlocked(cookieFor(HASH), ID, HASH)).toBe(true);
    const other = await hashPasscode("open sesame");
    expect(isUnlocked(cookieFor(other), ID, HASH)).toBe(false);
    expect(isUnlocked(`${unlockCookieName(ID)}=zz`, ID, HASH)).toBe(false);
    expect(isUnlocked(null, ID, HASH)).toBe(false);
  });
});

describe("GET /api/sequences/[id] with a passcode", () => {
  it("answers 401 passcode_required to a visitor with no unlock cookie", async () => {
    const { GET } = await import("@/app/api/sequences/[id]/route");
    q.mockResolvedValue({ rows: [lockedRow()], rowCount: 1 });
    const res = await GET(new NextRequest(`http://example.com/api/sequences/${ID}`), ctx);
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "Passcode required", passcode_required: true, id: ID });
  });

  it("serves the row to a visitor holding the unlock cookie, without hash or passcode", async () => {
    const { GET } = await import("@/app/api/sequences/[id]/route");
    q.mockResolvedValue({ rows: [lockedRow()], rowCount: 1 });
    const res = await GET(new NextRequest(`http://example.com/api/sequences/${ID}`, { headers: { cookie: cookieFor(HASH) } }), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const body = await res.json();
    expect(body.has_passcode).toBe(true);
    expect(body.passcode_hash).toBeUndefined();
    expect(body.passcode_enc).toBeUndefined();
    expect(body.passcode).toBeUndefined();
  });

  it("lets the owner straight in and hands back the plain passcode", async () => {
    const { GET } = await import("@/app/api/sequences/[id]/route");
    mockAuthorizeOwner.mockResolvedValue(true);
    q.mockResolvedValue({ rows: [lockedRow()], rowCount: 1 });
    const res = await GET(new NextRequest(`http://example.com/api/sequences/${ID}`), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).passcode).toBe("open sesame");
  });

  it("leaves an unlocked public sequence open to everyone", async () => {
    const { GET } = await import("@/app/api/sequences/[id]/route");
    q.mockResolvedValue({ rows: [{ id: ID, is_public: true, passcode_hash: null }], rowCount: 1 });
    const res = await GET(new NextRequest(`http://example.com/api/sequences/${ID}`), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).has_passcode).toBe(false);
    expect(mockAuthorizeOwner).not.toHaveBeenCalled();
  });
});

describe("POST /api/sequences/[id]/unlock", () => {
  const post = (passcode: string, ip: string) => new Request(`https://example.com/api/sequences/${ID}/unlock`, {
    method: "POST", body: new URLSearchParams({ passcode }), headers: { "x-forwarded-for": ip, "content-type": "application/x-www-form-urlencoded" },
  });

  it("redraws the lock screen with 401 and \"Wrong passcode\" on a wrong passcode and sets no cookie", async () => {
    const { POST } = await import("@/app/api/sequences/[id]/unlock/route");
    q.mockResolvedValue({ rows: [lockedRow()], rowCount: 1 });
    const res = await POST(post("wrong", "1.1.1.1"), ctx);
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.text()).toContain("Wrong passcode");
  });

  it("takes the passcode in any case, sets a 30-day HttpOnly cookie that opens the GET, and goes to the page with the reveal", async () => {
    const { POST } = await import("@/app/api/sequences/[id]/unlock/route");
    q.mockResolvedValue({ rows: [lockedRow()], rowCount: 1 });
    const res = await POST(post("  OPEN Sesame ", "2.2.2.2"), ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/s/${ID}?reveal=1`);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");

    const { GET } = await import("@/app/api/sequences/[id]/route");
    const read = await GET(new NextRequest(`http://example.com/api/sequences/${ID}`, { headers: { cookie: cookie.split(";")[0] } }), ctx);
    expect(read.status).toBe(200);
  });

  it("stops guessing after 10 tries in 5 minutes", async () => {
    const { POST } = await import("@/app/api/sequences/[id]/unlock/route");
    q.mockResolvedValue({ rows: [lockedRow()], rowCount: 1 });
    for (let i = 0; i < 10; i++) await POST(post("wrong", "3.3.3.3"), ctx);
    expect((await POST(post("wrong", "3.3.3.3"), ctx)).status).toBe(429);
  });
});

describe("PATCH /api/sequences/[id] { passcode }", () => {
  const patch = (passcode: string, headers: Record<string, string> = {}) =>
    new NextRequest(`http://example.com/api/sequences/${ID}`, { method: "PATCH", body: JSON.stringify({ passcode }), headers: { "content-type": "application/json", ...headers } });

  it("lowercases and trims, stores only a hash and a sealed copy, and returns the plain passcode", async () => {
    const { PATCH } = await import("@/app/api/sequences/[id]/route");
    mockResolveOwnerId.mockResolvedValue("owner-uuid");
    q.mockResolvedValue({ rows: [{ id: ID, is_public: true, has_passcode: true }], rowCount: 1 });
    const res = await PATCH(patch("  MiXeD Case "), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).passcode).toBe("mixed case");
    const [sql, params] = q.mock.calls[0];
    expect(sql).toContain("passcode_hash = $1::text");
    expect(params[0]).not.toContain("mixed");
    expect(await verifyPasscode("mixed case", params[0])).toBe(true);
    expect(openPasscode(params[3])).toBe("mixed case");
  });

  it('clears the passcode on ""', async () => {
    const { PATCH } = await import("@/app/api/sequences/[id]/route");
    mockResolveOwnerId.mockResolvedValue("owner-uuid");
    q.mockResolvedValue({ rows: [{ id: ID, is_public: true, has_passcode: false }], rowCount: 1 });
    await PATCH(patch(""), ctx);
    const params = q.mock.calls[0][1];
    expect(params[0]).toBeNull();
    expect(params[3]).toBeNull();
  });

  it("refuses a passcode over 200 characters", async () => {
    const { PATCH } = await import("@/app/api/sequences/[id]/route");
    mockResolveOwnerId.mockResolvedValue("owner-uuid");
    expect((await PATCH(patch("x".repeat(201)), ctx)).status).toBe(400);
  });

  it("is ignored for an automation holding the Bearer", async () => {
    const { PATCH } = await import("@/app/api/sequences/[id]/route");
    mockResolveOwnerId.mockResolvedValue("owner-uuid");
    const res = await PATCH(patch("x", { authorization: "Bearer k" }), ctx);
    expect(res.status).toBe(400);
    expect(q).not.toHaveBeenCalled();
  });
});

describe("the /s/[id] share page", () => {
  it("sends a visitor with no unlock cookie to the lock screen", async () => {
    const { default: Page } = await import("@/app/s/[id]/page");
    q.mockResolvedValue({ rows: [lockedRow()], rowCount: 1 });
    await expect(Page(ctx)).rejects.toThrow(`REDIRECT /api/sequences/${ID}/unlock`);
  });

  it("renders for the unlock cookie and for the owner", async () => {
    const { default: Page } = await import("@/app/s/[id]/page");
    q.mockResolvedValue({ rows: [lockedRow()], rowCount: 1 });
    hdrs.cookie = cookieFor(HASH);
    await expect(Page({ params: Promise.resolve({ id: ID }) })).resolves.toBeTruthy();
    hdrs.cookie = "";
    mockResolveOwnerIdServer.mockResolvedValue("owner-uuid");
    await expect(Page({ params: Promise.resolve({ id: ID }) })).resolves.toBeTruthy();
  });

  it("previews a locked sequence by title only", async () => {
    const { generateMetadata } = await import("@/app/s/[id]/page");
    q.mockResolvedValue({ rows: [lockedRow()], rowCount: 1 });
    const meta = await generateMetadata({ params: Promise.resolve({ id: ID }) });
    expect(meta.description).toBe("Passcode protected. Type the passcode to open it.");
  });
});

describe("other public doors", () => {
  it("/svg/[id] answers 401 for a locked sequence and private no-store once unlocked", async () => {
    const { GET } = await import("@/app/svg/[id]/route");
    q.mockResolvedValue({ rows: [lockedRow()], rowCount: 1 });
    expect((await GET(new Request(`http://example.com/svg/${ID}`), ctx)).status).toBe(401);
    const ok = await GET(new Request(`http://example.com/svg/${ID}`, { headers: { cookie: cookieFor(HASH) } }), ctx);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("private, no-store");
  });

  it("/api/export answers 401 for a locked sequence", async () => {
    const { GET } = await import("@/app/api/export/route");
    q.mockResolvedValue({ rows: [lockedRow()], rowCount: 1 });
    const res = await GET(new NextRequest(`http://example.com/api/export?id=${ID}`));
    expect(res.status).toBe(401);
  });

  it("the public /demo gallery leaves locked sequences out", async () => {
    const { default: DemoPage } = await import("@/app/demo/page");
    q.mockResolvedValue({ rows: [], rowCount: 0 });
    await DemoPage();
    expect(q.mock.calls[0][0]).toContain("passcode_hash IS NULL");
  });
});
