// Shared helpers for the AI diagram routes (ai/generate, ai/diagrams) so the
// title-embedding logic lives in one place instead of being copy-pasted.

// Ensures the diagram title is embedded in the Mermaid source, so the renderer
// shows it even when the caller did not include a `title:` line. No-op if a
// title line is already present.
export function embedTitleInCode(code: string, title: string): string {
  const finalCode = code.trim();
  if (/^\s*title:?\s+.+$/im.test(finalCode)) return finalCode;
  return finalCode.replace(
    /^(sequenceDiagram[^\n]*\n?)/im,
    `$1    title: ${title.trim()}\n`
  );
}
