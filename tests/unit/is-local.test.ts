import { describe, it, expect, vi } from "vitest";
import { isLocal } from "@/lib/is-local";

// Helper: build a minimal fake Request with a given host header value.
const req = (host: string) =>
  ({
    headers: { get: (k: string) => (k === "host" ? host : null) },
  }) as unknown as Request;

// ---------------------------------------------------------------------------
// isLocal — TRUE cases
// ---------------------------------------------------------------------------
describe("isLocal returns true for local hosts", () => {
  it("bare localhost", () => {
    expect(isLocal(req("localhost"))).toBe(true);
  });

  it("localhost with port", () => {
    expect(isLocal(req("localhost:3002"))).toBe(true);
  });

  it("127.0.0.1 loopback", () => {
    expect(isLocal(req("127.0.0.1"))).toBe(true);
  });

  it("127.0.0.1 with port", () => {
    expect(isLocal(req("127.0.0.1:3000"))).toBe(true);
  });

  it("full 10.x LAN IP (10.0.0.5)", () => {
    expect(isLocal(req("10.0.0.5"))).toBe(true);
  });

  it("full 192.168.x LAN IP (192.168.1.20)", () => {
    expect(isLocal(req("192.168.1.20"))).toBe(true);
  });

  it("full 172.16-31.x LAN IP (172.16.0.1)", () => {
    expect(isLocal(req("172.16.0.1"))).toBe(true);
  });

  it("full 172.31.x LAN IP with port", () => {
    expect(isLocal(req("172.31.255.1:8080"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isLocal — FALSE cases
// ---------------------------------------------------------------------------
describe("isLocal returns false for public / non-local hosts", () => {
  it("public domain (example.com)", () => {
    expect(isLocal(req("example.com"))).toBe(false);
  });

  it("vercel production domain", () => {
    expect(isLocal(req("sequences-bheng.vercel.app"))).toBe(false);
  });

  it("subdomain of localhost is NOT local (evil.localhost) — no wildcard bypass", () => {
    expect(isLocal(req("evil.localhost"))).toBe(false);
  });

  it("subdomain of localhost with port is NOT local (app.localhost:3002)", () => {
    expect(isLocal(req("app.localhost:3002"))).toBe(false);
  });

  it("bare '10.' prefix string (no full octets) is false", () => {
    expect(isLocal(req("10."))).toBe(false);
  });

  it("bare '192.168.' prefix string (no full octets) is false", () => {
    expect(isLocal(req("192.168."))).toBe(false);
  });

  it("11.x address (does not start with '10.')", () => {
    expect(isLocal(req("11.0.0.1"))).toBe(false);
  });

  it("172.15.x is outside the 172.16-31 private range", () => {
    expect(isLocal(req("172.15.0.1"))).toBe(false);
  });

  it("172.32.x is outside the 172.16-31 private range", () => {
    expect(isLocal(req("172.32.0.1"))).toBe(false);
  });

  it("empty host string", () => {
    expect(isLocal(req(""))).toBe(false);
  });

  it("public DNS server (8.8.8.8)", () => {
    expect(isLocal(req("8.8.8.8"))).toBe(false);
  });

  it("null host header falls back to empty string via || ''", () => {
    const noHostReq = ({
      headers: { get: () => null },
    }) as unknown as Request;
    expect(isLocal(noHostReq)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isLocal — production gate
// ---------------------------------------------------------------------------
describe("isLocal respects NODE_ENV=production", () => {
  it("returns false in production even for a Host header claiming localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_DEV", "");
    try {
      expect(isLocal(req("localhost"))).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("allows the local check in production when LOCAL_DEV=true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_DEV", "true");
    try {
      expect(isLocal(req("localhost"))).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
