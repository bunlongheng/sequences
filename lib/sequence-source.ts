// Where a programmatic diagram came from.
//
// Callers name themselves with `source` on the create payload ("repo-audit",
// "create-sequence", "automations", ...). It is recorded on the row and in
// sequence_api_requests, so a row's origin is a fact instead of a guess at its
// title. Before this existed the only tell was a "<repo> - File Layers" title
// suffix, which is why 30 audit renders sat in the library looking like real
// sequences.

// Tag carried by every stored diagram that an audit rendered for its own
// report. The library list filters on this tag, so a tagged row keeps its
// provenance without showing up as one of the owner's diagrams.
export const AUDIT_TAG = "repo-audit";

// Trim to a short, loggable label. Anything unusable becomes null.
export function normalizeSource(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().slice(0, 64);
  return s || null;
}

// An audit/report run: it wants SVG markup to embed, never a library row.
// Rule, not a list, so /repo-audit, /zeta-repo-audit, /project-audit and any
// future *-audit skill are all covered without touching this file.
export function isAuditSource(source: string | null): boolean {
  return !!source && /audit/i.test(source);
}
