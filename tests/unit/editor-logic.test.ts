/**
 * Unit tests for lib/editor-logic.ts - the pure branch logic extracted from the
 * two large client components (SequenceEditor, SequencesClient): title parsing,
 * keyboard zoom stepping, undo capping, relative time, and tag color assignment.
 * These paths were previously exercised only by Playwright smoke.
 */
import { describe, it, expect } from "vitest";
import {
  extractTitle,
  zoomStep,
  pushUndo,
  relativeTime,
  buildTagColorMap,
  TAG_PALETTE,
  TAG_FIXED_COLORS,
} from "@/lib/editor-logic";

describe("extractTitle", () => {
  it("uses an explicit title: line, trimmed", () => {
    expect(extractTitle("sequenceDiagram\ntitle: My Flow\nA->>B: hi")).toBe("My Flow");
    expect(extractTitle("title:   Padded Title   \nA->>B: x")).toBe("Padded Title");
  });

  it("uses accTitle: when present", () => {
    expect(extractTitle("accTitle: Accessible Name\nA->>B: x")).toBe("Accessible Name");
  });

  it("returns Untitled for a sequence diagram with no title", () => {
    expect(extractTitle("sequenceDiagram\nA->>B: hi")).toBe("Untitled");
  });

  it("returns Untitled for unknown/plain diagram code", () => {
    expect(extractTitle("something random with no keyword")).toBe("Untitled");
  });

  it("derives a capitalized type name for typed diagrams", () => {
    expect(extractTitle("flowchart TD\nA-->B")).toBe("Flowchart Diagram");
    expect(extractTitle("classDiagram\nClassA")).toBe("Class Diagram");
  });
});

describe("zoomStep", () => {
  it("zooms in by 1.2x, rounded to 2dp", () => {
    expect(zoomStep(1, "in")).toBe(1.2);
    expect(zoomStep(1.5, "in")).toBe(1.8);
  });

  it("zooms out by /1.2, rounded to 2dp", () => {
    expect(zoomStep(1.2, "out")).toBe(1);
    expect(zoomStep(1, "out")).toBe(0.83);
  });

  it("clamps to the [0.1, 4] bounds", () => {
    expect(zoomStep(3.9, "in")).toBe(4); // 3.9*1.2=4.68 -> capped
    expect(zoomStep(4, "in")).toBe(4);
    expect(zoomStep(0.1, "out")).toBe(0.1); // 0.1/1.2 < 0.1 -> floored
    expect(zoomStep(0.11, "out")).toBe(0.1);
  });
});

describe("pushUndo", () => {
  it("pushes onto the stack", () => {
    const s: number[] = [];
    pushUndo(s, 1);
    pushUndo(s, 2);
    expect(s).toEqual([1, 2]);
  });

  it("caps at 50 by default, dropping the oldest", () => {
    const s: number[] = [];
    for (let i = 0; i < 60; i++) pushUndo(s, i);
    expect(s.length).toBe(50);
    expect(s[0]).toBe(10); // 0..9 dropped
    expect(s[49]).toBe(59);
  });

  it("respects a custom cap", () => {
    const s: number[] = [];
    for (let i = 0; i < 5; i++) pushUndo(s, i, 3);
    expect(s).toEqual([2, 3, 4]);
  });
});

describe("relativeTime", () => {
  const base = new Date("2026-07-15T12:00:00Z").getTime();
  const at = (iso: string) => relativeTime(iso, base);

  it("returns 'Just now' under a minute", () => {
    expect(at("2026-07-15T11:59:30Z")).toBe("Just now");
  });

  it("returns minutes then hours", () => {
    expect(at("2026-07-15T11:45:00Z")).toBe("15m ago");
    expect(at("2026-07-15T09:00:00Z")).toBe("3h ago");
  });

  it("returns days under a week", () => {
    expect(at("2026-07-13T12:00:00Z")).toBe("2d ago");
  });

  it("falls back to a short date at a week or older", () => {
    // 8 days earlier -> formatted date, not "Nd ago"
    expect(at("2026-07-07T12:00:00Z")).toMatch(/^Jul \d+$/);
  });
});

describe("buildTagColorMap", () => {
  it("assigns palette colors deterministically by sorted order", () => {
    const a = buildTagColorMap(["beta", "alpha"]);
    const b = buildTagColorMap(["alpha", "beta"]);
    // Order-independent: same tag -> same color regardless of input order.
    expect(a.get("alpha")).toEqual(b.get("alpha"));
    expect(a.get("alpha")).toEqual(TAG_PALETTE[0]);
    expect(a.get("beta")).toEqual(TAG_PALETTE[1]);
  });

  it("pins fixed-color tags regardless of position", () => {
    const map = buildTagColorMap(["AAA", "YouTube", "ZZZ"]);
    expect(map.get("YouTube")).toEqual(TAG_FIXED_COLORS.YouTube);
  });

  it("wraps around the palette past its length", () => {
    const tags = Array.from({ length: TAG_PALETTE.length + 2 }, (_, i) =>
      String(i).padStart(2, "0"),
    );
    const map = buildTagColorMap(tags);
    // index 12 wraps to palette[0], index 13 to palette[1]
    expect(map.get(tags[TAG_PALETTE.length])).toEqual(TAG_PALETTE[0]);
    expect(map.get(tags[TAG_PALETTE.length + 1])).toEqual(TAG_PALETTE[1]);
  });
});
