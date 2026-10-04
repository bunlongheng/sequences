/**
 * The library list hides diagrams an audit rendered for its own report. Both
 * surfaces that show the list go through listSequences, so the exclusion is
 * asserted once, here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ default: { query: vi.fn() } }));

import db from "@/lib/db";
import { listSequences } from "@/lib/sequence-list";
import { AUDIT_TAG } from "@/lib/sequence-source";

const q = db.query as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  q.mockResolvedValue({ rows: [{ id: "d1" }], rowCount: 1 });
});

describe("listSequences", () => {
  it("scopes to the owner and excludes the audit tag", async () => {
    await listSequences("owner-uuid");
    const [sql, params] = q.mock.calls[0];
    expect(sql).toContain("user_id = $1");
    expect(sql).toContain("NOT (COALESCE(tags, '{}'::text[]) @> ARRAY[$2]::text[])");
    expect(params).toEqual(["owner-uuid", AUDIT_TAG]);
  });

  it("treats a NULL tags column as untagged rather than dropping the row", async () => {
    // COALESCE matters: `NULL @> ARRAY[...]` is NULL, and `NOT NULL` is NULL,
    // so without it every row with no tags would silently vanish from the list.
    expect(q.mock.calls.length).toBe(0);
    await listSequences("owner-uuid");
    expect(q.mock.calls[0][0]).toContain("COALESCE(tags, '{}'::text[])");
  });

  it("returns the rows as-is", async () => {
    expect(await listSequences("owner-uuid")).toEqual([{ id: "d1" }]);
  });
});
