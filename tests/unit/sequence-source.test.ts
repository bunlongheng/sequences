/**
 * Provenance rules: who a programmatic caller says it is, and whether that
 * answer means "render it" or "file it in the library".
 */
import { describe, it, expect } from "vitest";
import { AUDIT_TAG, isAuditSource, normalizeSource } from "@/lib/sequence-source";

describe("normalizeSource", () => {
  it("trims and keeps a real source name", () => {
    expect(normalizeSource("  repo-audit  ")).toBe("repo-audit");
  });

  it("returns null for anything unusable", () => {
    for (const v of ["", "   ", null, undefined, 7, {}, []]) {
      expect(normalizeSource(v)).toBeNull();
    }
  });

  it("caps the label at 64 chars so a log row cannot be stuffed", () => {
    expect(normalizeSource("x".repeat(500))).toHaveLength(64);
  });
});

describe("isAuditSource", () => {
  it("matches every audit skill, not just the literal repo-audit", () => {
    for (const s of ["repo-audit", "zeta-repo-audit", "project-audit", "security-audit", "Repo-Audit"]) {
      expect(isAuditSource(s)).toBe(true);
    }
  });

  it("leaves ordinary callers alone", () => {
    for (const s of ["create-sequence", "automations", "mcp", "YouTube", null]) {
      expect(isAuditSource(s)).toBe(false);
    }
  });
});

describe("AUDIT_TAG", () => {
  it("is the tag the library list filters on", () => {
    expect(AUDIT_TAG).toBe("repo-audit");
  });
});
