// Pure logic extracted from the two large client components (SequenceEditor,
// SequencesClient) so their branch behavior - title parsing, keyboard zoom
// stepping, undo capping, relative time, and deterministic tag colors - is
// unit-testable and counted in coverage (lib/** is in the coverage denominator).
import { detectSequenceType } from "@/lib/svg-renderer";

export type TagColor = { bg: string; text: string; border: string };

/** Editor: derive a human title from diagram code - an explicit title:/accTitle:
 *  wins, else a type-derived name, else "Untitled" for sequence/plain diagrams. */
export function extractTitle(code: string): string {
    const m = code.match(/^\s*(?:title|accTitle):?\s+(.+)$/im);
    if (m) return m[1].trim();
    const type = detectSequenceType(code);
    if (type === "diagram" || type === "sequence") return "Untitled";
    return type.charAt(0).toUpperCase() + type.slice(1) + " Diagram";
}

/** Editor: one keyboard zoom step, clamped to [0.1, 4] and rounded to 2 dp. */
export function zoomStep(z: number, dir: "in" | "out"): number {
    const raw = dir === "in" ? Math.min(4, z * 1.2) : Math.max(0.1, z / 1.2);
    return parseFloat(raw.toFixed(2));
}

/** Editor: push onto the undo stack, capping at `cap` entries (drops the oldest). */
export function pushUndo<T>(stack: T[], item: T, cap = 50): void {
    stack.push(item);
    if (stack.length > cap) stack.shift();
}

/** Index grid: compact relative time ("Just now", "5m ago", ...) else a short date.
 *  `now` is injectable so the formatting is deterministic in tests. */
export function relativeTime(d: string, now: number = Date.now()): string {
    const diff = now - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const day = Math.floor(h / 24);
    if (day < 7) return `${day}d ago`;
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const TAG_PALETTE: TagColor[] = [
  { bg: "#fef2f2", text: "#b91c1c", border: "#fca5a5" }, // red
  { bg: "#fff7ed", text: "#c2410c", border: "#fdba74" }, // orange
  { bg: "#fefce8", text: "#a16207", border: "#fde047" }, // yellow
  { bg: "#f0fdf4", text: "#15803d", border: "#86efac" }, // green
  { bg: "#ecfdf5", text: "#047857", border: "#6ee7b7" }, // emerald
  { bg: "#f0fdfa", text: "#0f766e", border: "#5eead4" }, // teal
  { bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd" }, // blue
  { bg: "#eef2ff", text: "#4338ca", border: "#a5b4fc" }, // indigo
  { bg: "#faf5ff", text: "#7e22ce", border: "#d8b4fe" }, // violet
  { bg: "#fdf4ff", text: "#a21caf", border: "#f0abfc" }, // fuchsia
  { bg: "#fff1f2", text: "#be123c", border: "#fda4af" }, // rose
  { bg: "#f0f9ff", text: "#0369a1", border: "#7dd3fc" }, // sky
];

// Tags pinned to a fixed color regardless of sort order (brand identity).
export const TAG_FIXED_COLORS: Record<string, TagColor> = {
  YouTube: { bg: "#fef2f2", text: "#cc0000", border: "#fca5a5" },
};

/** Index grid: deterministic tag -> color. Tags are sorted first so a given tag
 *  keeps its color across renders; pinned tags always win their fixed color. */
export function buildTagColorMap(tags: string[]): Map<string, TagColor> {
  const map = new Map<string, TagColor>();
  [...tags].sort().forEach((t, i) => map.set(t, TAG_FIXED_COLORS[t] ?? TAG_PALETTE[i % TAG_PALETTE.length]));
  return map;
}
