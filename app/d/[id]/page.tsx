import { permanentRedirect } from "next/navigation";

// Back-compat alias for the /s/[id] share page. Every link shared before the
// 2026-09-18 rename points at /d/<id>, so this permanently redirects instead
// of breaking them. 308 keeps the old URLs' search-engine equity.
export default async function LegacyDiagramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  permanentRedirect(`/s/${id}`);
}
