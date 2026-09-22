import { describe, it, expect } from "vitest";
import { embedTitleInCode } from "@/lib/sequence-code";

// ---------------------------------------------------------------------------
// embedTitleInCode
// ---------------------------------------------------------------------------
describe("embedTitleInCode", () => {
  it("embeds a title into code with no existing title line", () => {
    const code = "sequenceDiagram\n  participant U as User\n  U->>S: Hi";
    const result = embedTitleInCode(code, "My Diagram");
    expect(result).toBe(
      "sequenceDiagram\n    title: My Diagram\n  participant U as User\n  U->>S: Hi"
    );
  });

  it("trims the input code and the title before embedding", () => {
    const code = "  sequenceDiagram\n  A->>B: hi  ";
    const result = embedTitleInCode(code, "  Padded Title  ");
    // The whole code string is trimmed first (dropping the trailing
    // whitespace after "hi"), then the title line is inserted.
    expect(result).toBe("sequenceDiagram\n    title: Padded Title\n  A->>B: hi");
  });

  it("is a no-op when a frontmatter title is already present (does not replace it)", () => {
    const code = "---\ntitle: Existing Title\n---\nsequenceDiagram\nA->>B: hi";
    const result = embedTitleInCode(code, "New Title");
    // The function only checks for *presence* of a title line -- it never
    // replaces an existing one, so the original title survives untouched
    // even though a different title was passed in.
    expect(result).toBe(code);
    expect(result).toContain("title: Existing Title");
    expect(result).not.toContain("New Title");
  });

  it("is idempotent when the existing title line starts at column 0 (e.g. frontmatter)", () => {
    const code = "---\ntitle: Existing Title\n---\nsequenceDiagram\nA->>B: hi";
    const once = embedTitleInCode(code, "New Title");
    const twice = embedTitleInCode(once, "New Title");
    expect(twice).toBe(once);
  });

  it("is idempotent when called twice on code with no pre-existing title line", () => {
    // The title-detection regex tolerates leading whitespace so it recognizes
    // its own indented `    title: ...` insertion on a second call, instead of
    // embedding a duplicate title line.
    const code = "sequenceDiagram\n  A->>B: hi";
    const once = embedTitleInCode(code, "My Diagram");
    const twice = embedTitleInCode(once, "My Diagram");
    expect(twice).toBe(once);
    expect(twice).toBe("sequenceDiagram\n    title: My Diagram\n  A->>B: hi");
  });
});
