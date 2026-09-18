/**
 * API Route Handler Tests
 *
 * Tests all route handlers without hitting real DB or Anthropic.
 * Auth is via @/lib/auth-owner mocks.
 * The ai/sequences and [id]/export routes read the API secret at module scope,
 * so they require dynamic import after vi.stubEnv + vi.resetModules.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Every env name bearerOk accepts: the primary pair plus the two generations of
// legacy aliases kept for backward compatibility after the Sequences rename.
const SECRET_ENV_NAMES = [
  "SEQUENCES_API_SECRET", "SEQUENCES_API_SECRET_PARTNER",
  "DIAGRAMS_API_SECRET", "DIAGRAMS_API_SECRET_PARTNER",
  "AI_API_SECRET", "AI_API_SECRET_PARTNER",
] as const;

// ── Module-level mocks (hoisted before imports) ──────────────────────────────
vi.mock("@/lib/auth-owner", () => ({
  authorizeOwner: vi.fn(),
  resolveOwnerId: vi.fn(),
  ownerId: vi.fn(),
  // Mirrors the real bearerOk: compares the header against every accepted
  // secret name at call time, so vi.stubEnv drives it per-test.
  bearerOk: (reqOrHeader: Request | string | null) => {
    const header = typeof reqOrHeader === "string"
      ? reqOrHeader
      : reqOrHeader?.headers.get("authorization") ?? "";
    const secrets = SECRET_ENV_NAMES.map((k) => process.env[k]).filter(Boolean);
    return secrets.some(s => header === `Bearer ${s}`);
  },
}));

vi.mock("@/lib/db", () => ({ default: { query: vi.fn() } }));

vi.mock("@/lib/slugs", () => ({
  uniqueSequenceSlug: vi.fn().mockResolvedValue("slug-1"),
}));

// Anthropic SDK mock — `new Anthropic(...)` returns an object exposing a
// controllable `messages.create` so tests can drive the ai/generate success,
// billing-error, and malformed-response branches without hitting the real API.
const { mockAnthropicCreate } = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockAnthropicCreate };
  },
}));

// ── Imports after mocks ──────────────────────────────────────────────────────
import db from "@/lib/db";
import { authorizeOwner, resolveOwnerId, ownerId } from "@/lib/auth-owner";

const q = db.query as unknown as ReturnType<typeof vi.fn>;
const mockAuthorizeOwner = authorizeOwner as unknown as ReturnType<typeof vi.fn>;
const mockResolveOwnerId = resolveOwnerId as unknown as ReturnType<typeof vi.fn>;
const mockOwnerId = ownerId as unknown as ReturnType<typeof vi.fn>;

// ── Default beforeEach ────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockResolveOwnerId.mockResolvedValue(null);
  mockAuthorizeOwner.mockResolvedValue(false);
  mockOwnerId.mockReturnValue("owner-uuid");
  q.mockResolvedValue({ rows: [], rowCount: 0 });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/sequences
// ════════════════════════════════════════════════════════════════════════════
describe("GET /api/sequences", () => {
  it("returns 401 when resolveOwnerId returns null", async () => {
    const { GET } = await import("@/app/api/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/sequences");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with rows when resolveOwnerId returns a user id", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    q.mockResolvedValue({ rows: [{ id: 1, title: "Test" }], rowCount: 1 });

    const { GET } = await import("@/app/api/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/sequences");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].id).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/sequences
// ════════════════════════════════════════════════════════════════════════════
describe("POST /api/sequences", () => {
  it("returns 401 when resolveOwnerId returns null", async () => {
    const { POST } = await import("@/app/api/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/sequences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "T", code: "C" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when title is missing", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    const { POST } = await import("@/app/api/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/sequences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "sequenceDiagram\nA->>B: hi" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when code is missing", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    const { POST } = await import("@/app/api/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/sequences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "My Diagram" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with the inserted row on valid request", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    q.mockResolvedValue({ rows: [{ id: "d1", title: "My Diagram" }], rowCount: 1 });

    const { POST } = await import("@/app/api/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/sequences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "My Diagram", code: "sequenceDiagram\nA->>B: hi" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("d1");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/sequences/[id]
// ════════════════════════════════════════════════════════════════════════════
describe("GET /api/sequences/[id]", () => {
  it("returns 404 when diagram not found", async () => {
    const { GET } = await import("@/app/api/sequences/[id]/route");
    q.mockResolvedValue({ rows: [], rowCount: 0 });
    const req = new NextRequest("http://localhost:3002/api/sequences/some-id");
    const res = await GET(req, { params: Promise.resolve({ id: "some-id" }) });
    expect(res.status).toBe(404);
  });

  it("returns 200 for a public diagram (no auth needed)", async () => {
    const { GET } = await import("@/app/api/sequences/[id]/route");
    q.mockResolvedValue({ rows: [{ id: "d1", title: "T", is_public: true }], rowCount: 1 });
    const req = new NextRequest("http://example.com/api/sequences/d1");
    const res = await GET(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("d1");
  });

  it("returns 403 for private diagram when authorizeOwner returns false", async () => {
    const { GET } = await import("@/app/api/sequences/[id]/route");
    mockAuthorizeOwner.mockResolvedValue(false);
    q.mockResolvedValue({ rows: [{ id: "d1", title: "T", is_public: false }], rowCount: 1 });
    const req = new NextRequest("http://example.com/api/sequences/d1");
    const res = await GET(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 200 for private diagram when authorizeOwner returns true", async () => {
    const { GET } = await import("@/app/api/sequences/[id]/route");
    mockAuthorizeOwner.mockResolvedValue(true);
    q.mockResolvedValue({ rows: [{ id: "d1", title: "T", is_public: false }], rowCount: 1 });
    const req = new NextRequest("http://example.com/api/sequences/d1");
    const res = await GET(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(200);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/sequences/[id]
// ════════════════════════════════════════════════════════════════════════════
describe("PATCH /api/sequences/[id]", () => {
  it("returns 401 when resolveOwnerId returns null", async () => {
    const { PATCH } = await import("@/app/api/sequences/[id]/route");
    const req = new NextRequest("http://localhost:3002/api/sequences/d1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "new" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 when body has no allowed fields", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    const { PATCH } = await import("@/app/api/sequences/[id]/route");
    const req = new NextRequest("http://localhost:3002/api/sequences/d1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 200 {ok:true} when update succeeds (rowCount 1)", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    q.mockResolvedValue({ rows: [], rowCount: 1 });
    const { PATCH } = await import("@/app/api/sequences/[id]/route");
    const req = new NextRequest("http://localhost:3002/api/sequences/d1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 404 when rowCount is 0 (not found or not owner)", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    q.mockResolvedValue({ rows: [], rowCount: 0 });
    const { PATCH } = await import("@/app/api/sequences/[id]/route");
    const req = new NextRequest("http://localhost:3002/api/sequences/d1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// DELETE /api/sequences/[id]
// ════════════════════════════════════════════════════════════════════════════
describe("DELETE /api/sequences/[id]", () => {
  it("returns 401 when resolveOwnerId returns null", async () => {
    const { DELETE } = await import("@/app/api/sequences/[id]/route");
    const req = new NextRequest("http://localhost:3002/api/sequences/d1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when diagram not found or not owned (rowCount 0)", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    q.mockResolvedValue({ rows: [], rowCount: 0 });
    const { DELETE } = await import("@/app/api/sequences/[id]/route");
    const req = new NextRequest("http://localhost:3002/api/sequences/d1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 200 {ok:true} when delete succeeds (rowCount 1)", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    q.mockResolvedValue({ rows: [], rowCount: 1 });
    const { DELETE } = await import("@/app/api/sequences/[id]/route");
    const req = new NextRequest("http://localhost:3002/api/sequences/d1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/ai/generate
// ════════════════════════════════════════════════════════════════════════════
describe("POST /api/ai/generate", () => {
  it("returns 401 when authorizeOwner returns false", async () => {
    mockAuthorizeOwner.mockResolvedValue(false);
    const { POST } = await import("@/app/api/ai/generate/route");
    const req = new NextRequest("http://example.com/api/ai/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "draw me a diagram" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when prompt is missing", async () => {
    mockAuthorizeOwner.mockResolvedValue(true);
    const { POST } = await import("@/app/api/ai/generate/route");
    const req = new NextRequest("http://localhost:3002/api/ai/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is invalid JSON", async () => {
    mockAuthorizeOwner.mockResolvedValue(true);
    const { POST } = await import("@/app/api/ai/generate/route");
    const req = new NextRequest("http://localhost:3002/api/ai/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 201 with url/svg/editor links on a successful generation", async () => {
    mockAuthorizeOwner.mockResolvedValue(true);
    mockOwnerId.mockReturnValue("owner-uuid");
    mockAnthropicCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            title: "My Diagram",
            code: "---\ntitle: My Diagram\n---\nsequenceDiagram\nA->>B: hi",
            sequenceType: "sequence",
          }),
        },
      ],
      usage: { output_tokens: 42 },
    });
    q.mockResolvedValue({
      rows: [{ id: "d-gen-1", title: "My Diagram", slug: "slug-1" }],
      rowCount: 1,
    });

    const { POST } = await import("@/app/api/ai/generate/route");
    const req = new NextRequest("http://localhost:3002/api/ai/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "draw me a login flow" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("d-gen-1");
    expect(body.url).toBe("https://sequences-bheng.vercel.app/d/d-gen-1");
    expect(body.svg).toBe("https://sequences-bheng.vercel.app/svg/d-gen-1");
    expect(body.editor).toBe("https://sequences-bheng.vercel.app/?id=d-gen-1");
  });

  it("returns 402 when the Anthropic SDK reports a billing error", async () => {
    mockAuthorizeOwner.mockResolvedValue(true);
    mockAnthropicCreate.mockRejectedValue(new Error("Your credit balance is too low"));

    const { POST } = await import("@/app/api/ai/generate/route");
    const req = new NextRequest("http://localhost:3002/api/ai/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "draw me a diagram" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toMatch(/billing/i);
  });

  it("returns 500 when the model response contains no JSON", async () => {
    mockAuthorizeOwner.mockResolvedValue(true);
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "Sorry, I can't help with that." }],
      usage: { output_tokens: 5 },
    });

    const { POST } = await import("@/app/api/ai/generate/route");
    const req = new NextRequest("http://localhost:3002/api/ai/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "draw me a diagram" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Diagram generation failed");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/auth/me
// ════════════════════════════════════════════════════════════════════════════
describe("GET /api/auth/me", () => {
  it("returns 200 with {authorized:true} when authorizeOwner is true", async () => {
    mockAuthorizeOwner.mockResolvedValue(true);
    const { GET } = await import("@/app/api/auth/me/route");
    const req = new NextRequest("http://localhost:3002/api/auth/me");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(true);
  });

  it("returns 200 with {authorized:false} when authorizeOwner is false", async () => {
    mockAuthorizeOwner.mockResolvedValue(false);
    const { GET } = await import("@/app/api/auth/me/route");
    const req = new NextRequest("http://example.com/api/auth/me");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/ai/sequences  (module reads AI_SECRET at import time)
// ════════════════════════════════════════════════════════════════════════════
describe("POST /api/ai/sequences", () => {
  const SECRET = "topsecret";

  it("returns 500 when no API secret is configured", async () => {
    // The route accepts SEQUENCES_* plus the DIAGRAMS_*/AI_* legacy aliases, so
    // "not configured" means every one of them is empty. Clearing only one left
    // CI green-lit by whichever name the workflow happened to export.
    for (const k of SECRET_ENV_NAMES) vi.stubEnv(k, "");
    vi.resetModules();
    const { POST } = await import("@/app/api/ai/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/ai/sequences", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ title: "T", code: "sequenceDiagram\nA->>B: hi", sequenceType: "sequence" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    vi.unstubAllEnvs();
  });

  it("returns 401 when bearer token is wrong", async () => {
    vi.stubEnv("SEQUENCES_API_SECRET", SECRET);
    vi.resetModules();
    const { POST } = await import("@/app/api/ai/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/ai/sequences", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer wrongsecret" },
      body: JSON.stringify({ title: "T", code: "sequenceDiagram\nA->>B: hi", sequenceType: "sequence" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("returns 400 when body is invalid JSON", async () => {
    vi.stubEnv("SEQUENCES_API_SECRET", SECRET);
    vi.resetModules();
    const { POST } = await import("@/app/api/ai/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/ai/sequences", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: "{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 400 for unsupported sequenceType (flowchart)", async () => {
    vi.stubEnv("SEQUENCES_API_SECRET", SECRET);
    vi.resetModules();
    const { POST } = await import("@/app/api/ai/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/ai/sequences", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ title: "T", code: "sequenceDiagram\nA->>B: hi", sequenceType: "flowchart" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 400 when code does not contain sequenceDiagram", async () => {
    vi.stubEnv("SEQUENCES_API_SECRET", SECRET);
    vi.resetModules();
    const { POST } = await import("@/app/api/ai/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/ai/sequences", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ title: "T", code: "graph LR\nA-->B", sequenceType: "sequence" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 400 when title is missing", async () => {
    vi.stubEnv("SEQUENCES_API_SECRET", SECRET);
    vi.resetModules();
    const { POST } = await import("@/app/api/ai/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/ai/sequences", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ code: "sequenceDiagram\nA->>B: hi", sequenceType: "sequence" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 400 when code is missing", async () => {
    vi.stubEnv("SEQUENCES_API_SECRET", SECRET);
    vi.resetModules();
    const { POST } = await import("@/app/api/ai/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/ai/sequences", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ title: "My Flow", sequenceType: "sequence" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 201 with id/url/svg_url on a successful insert", async () => {
    vi.stubEnv("SEQUENCES_API_SECRET", SECRET);
    vi.resetModules();
    mockOwnerId.mockReturnValue("owner-uuid");
    q.mockResolvedValue({ rows: [{ id: "d-api-1" }], rowCount: 1 });

    const { POST } = await import("@/app/api/ai/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/ai/sequences", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ title: "My Flow", code: "sequenceDiagram\nA->>B: hi", sequenceType: "sequence" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      id: "d-api-1",
      url: "https://sequences-bheng.vercel.app/d/d-api-1",
      svg_url: "https://sequences-bheng.vercel.app/svg/d-api-1",
    });
    vi.unstubAllEnvs();
  });

  it("returns 201 with inline script-free svg when ?format=svg is requested", async () => {
    vi.stubEnv("SEQUENCES_API_SECRET", SECRET);
    vi.resetModules();
    mockOwnerId.mockReturnValue("owner-uuid");
    q.mockResolvedValue({ rows: [{ id: "d-api-3" }], rowCount: 1 });

    const { POST } = await import("@/app/api/ai/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/ai/sequences?format=svg", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ title: "My Flow", code: "sequenceDiagram\nA->>B: hi", sequenceType: "sequence" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("d-api-3");
    expect(body.svg).toContain("<svg");
    // Docs-safe: the API-inline SVG must NOT carry the interactivity script
    expect(body.svg).not.toContain("<script");
    expect(body.svg_error).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it("accepts the revocable partner key SEQUENCES_API_SECRET_PARTNER", async () => {
    vi.stubEnv("SEQUENCES_API_SECRET", SECRET);
    vi.stubEnv("SEQUENCES_API_SECRET_PARTNER", "partnerkey");
    vi.resetModules();
    mockOwnerId.mockReturnValue("owner-uuid");
    q.mockResolvedValue({ rows: [{ id: "d-api-4" }], rowCount: 1 });

    const { POST } = await import("@/app/api/ai/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/ai/sequences", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer partnerkey" },
      body: JSON.stringify({ title: "My Flow", code: "sequenceDiagram\nA->>B: hi", sequenceType: "sequence" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    vi.unstubAllEnvs();
  });

  it("forces tags to [\"API\"] regardless of any tags field the caller sends", async () => {
    vi.stubEnv("SEQUENCES_API_SECRET", SECRET);
    vi.resetModules();
    mockOwnerId.mockReturnValue("owner-uuid");
    q.mockResolvedValue({ rows: [{ id: "d-api-2" }], rowCount: 1 });

    const { POST } = await import("@/app/api/ai/sequences/route");
    const req = new NextRequest("http://localhost:3002/api/ai/sequences", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({
        title: "My Flow",
        code: "sequenceDiagram\nA->>B: hi",
        sequenceType: "sequence",
        tags: ["totally-arbitrary", "owner-controlled"],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    // The route never reads `tags` off the request body -- every automation
    // insert is hard-forced to ["API"], so a caller-supplied tags array is
    // silently ignored rather than merged or honored.
    expect(q).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO sequences"),
      expect.arrayContaining([["API"]]),
    );
    vi.unstubAllEnvs();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/export
// ════════════════════════════════════════════════════════════════════════════
describe("GET /api/export", () => {
  it("returns 400 when id is missing", async () => {
    const { GET } = await import("@/app/api/export/route");
    const req = new NextRequest("http://localhost:3002/api/export");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when id is not a valid UUID", async () => {
    const { GET } = await import("@/app/api/export/route");
    const req = new NextRequest("http://localhost:3002/api/export?id=abc");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when diagram not found", async () => {
    const { GET } = await import("@/app/api/export/route");
    q.mockResolvedValue({ rows: [], rowCount: 0 });
    const req = new NextRequest("http://localhost:3002/api/export?id=00000000-0000-0000-0000-000000000000");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns 200 with code when diagram exists", async () => {
    const { GET } = await import("@/app/api/export/route");
    q.mockResolvedValue({
      rows: [{ code: "sequenceDiagram\nA->>B: hi", settings: {}, title: "Test", is_public: true }],
      rowCount: 1,
    });
    const req = new NextRequest("http://localhost:3002/api/export?id=00000000-0000-0000-0000-000000000000");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBeDefined();
  });

  it("OPTIONS returns 204", async () => {
    const { OPTIONS } = await import("@/app/api/export/route");
    const res = await OPTIONS();
    expect(res.status).toBe(204);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/lan-ip
// ════════════════════════════════════════════════════════════════════════════
describe("GET /api/lan-ip", () => {
  it("returns 200 with ip property when authorized", async () => {
    mockAuthorizeOwner.mockResolvedValue(true);
    const { GET } = await import("@/app/api/lan-ip/route");
    const req = new NextRequest("http://localhost:3002/api/lan-ip");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect("ip" in body).toBe(true);
    expect(body.ip === null || typeof body.ip === "string").toBe(true);
  });

  it("returns 401 when not authorized", async () => {
    const { GET } = await import("@/app/api/lan-ip/route");
    const req = new NextRequest("https://sequences-bheng.vercel.app/api/lan-ip");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /svg/[id]
// ════════════════════════════════════════════════════════════════════════════
describe("GET /svg/[id]", () => {
  it("returns 400 for invalid UUID", async () => {
    const { GET } = await import("@/app/svg/[id]/route");
    const req = new Request("http://localhost:3002/svg/invalid-id");
    const res = await GET(req, { params: Promise.resolve({ id: "invalid-id" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when diagram not found", async () => {
    const { GET } = await import("@/app/svg/[id]/route");
    q.mockResolvedValue({ rows: [], rowCount: 0 });
    const req = new Request("http://localhost:3002/svg/00000000-0000-0000-0000-000000000000");
    const res = await GET(req, { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) });
    expect(res.status).toBe(404);
  });

  it("returns 200 with image/svg+xml content-type for valid diagram", async () => {
    const { GET } = await import("@/app/svg/[id]/route");
    q.mockResolvedValue({
      rows: [{
        code: "sequenceDiagram\nA->>B: hi",
        settings: null,
        title: "Test",
        created_at: new Date().toISOString(),
        is_public: true,
      }],
      rowCount: 1,
    });
    const req = new Request("http://localhost:3002/svg/00000000-0000-0000-0000-000000000000");
    const res = await GET(req, { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/sequences/[id]/export  (module reads AI_SECRET at import time)
// ════════════════════════════════════════════════════════════════════════════
describe("GET /api/sequences/[id]/export", () => {
  const SECRET = "exportsecret";

  it("returns 500 when no API secret is configured", async () => {
    // The route accepts SEQUENCES_* plus the DIAGRAMS_*/AI_* legacy aliases, so
    // "not configured" means every one of them is empty. Clearing only one left
    // CI green-lit by whichever name the workflow happened to export.
    for (const k of SECRET_ENV_NAMES) vi.stubEnv(k, "");
    vi.resetModules();
    const { GET } = await import("@/app/api/sequences/[id]/export/route");
    const req = new NextRequest("http://localhost:3002/api/sequences/d1/export", {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(500);
    vi.unstubAllEnvs();
  });

  it("returns 401 when bearer token is wrong", async () => {
    vi.stubEnv("SEQUENCES_API_SECRET", SECRET);
    vi.resetModules();
    const { GET } = await import("@/app/api/sequences/[id]/export/route");
    const req = new NextRequest("http://localhost:3002/api/sequences/d1/export", {
      headers: { authorization: "Bearer wrongtoken" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("returns 404 when diagram not found", async () => {
    vi.stubEnv("SEQUENCES_API_SECRET", SECRET);
    vi.resetModules();
    q.mockResolvedValue({ rows: [], rowCount: 0 });
    const { GET } = await import("@/app/api/sequences/[id]/export/route");
    const req = new NextRequest("http://localhost:3002/api/sequences/d1/export", {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(404);
    vi.unstubAllEnvs();
  });

  it("returns 200 with id/title/code when diagram exists (svg may be null)", async () => {
    vi.stubEnv("SEQUENCES_API_SECRET", SECRET);
    vi.resetModules();
    q.mockResolvedValue({
      rows: [{
        id: "d1",
        code: "sequenceDiagram\nA->>B: hi",
        title: "Test Export",
        sequence_type: "sequence",
      }],
      rowCount: 1,
    });
    const { GET } = await import("@/app/api/sequences/[id]/export/route");
    const req = new NextRequest("http://localhost:3002/api/sequences/d1/export", {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("d1");
    expect(body.title).toBe("Test Export");
    expect(body.code).toBe("sequenceDiagram\nA->>B: hi");
    // svg may be null since mermaid.ink is unreachable in tests
    vi.unstubAllEnvs();
  });
});
