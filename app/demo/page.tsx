import db from "@/lib/db";
import LandingDemo from "../LandingDemo";

// Public /demo gallery: a hand-picked, hard-coded set of polished demo sequences
// (each 5+ participants, modern topics). Pinned by id so the gallery NEVER shows
// the owner's own working sequences or low-quality ones — only this curated set,
// in this order. To change the lineup, edit DEMO_IDS.
export const revalidate = 300;

type Demo = { id: string; title: string; sequence_type: string };

const DEMO_IDS = [
  "c59940a0-0f79-4d50-a95e-65a11585a285", // Claude Code Agent Loop
  "6a2ab8a2-66f6-49ed-a79a-7dc6517c0234", // Deep Research Harness
  "bfb49a40-afa8-43af-85b3-556a8eb3782e", // Rust Async Task (Tokio)
  "70ccb869-b242-4241-99ff-f3d1dd794f38", // Kubernetes Pod Scheduling
  "2a63fec3-c3be-46ba-9f46-a2c664d50fb2", // gRPC Bidirectional Streaming
  "bdb6782c-ccd2-4b36-ac90-c7c6acb4e668", // LLM RAG Pipeline
  "da945272-2901-4cfd-8332-f296becbf298", // Event-Driven Checkout
  "1bb559c1-73a7-4eab-a292-93f57402dde0", // OAuth 2.0 PKCE Flow
];

export default async function DemoPage() {
  const { rows } = await db.query(
    `SELECT id, title, sequence_type FROM sequences WHERE id = ANY($1::uuid[])`,
    [DEMO_IDS]
  );
  const byId = new Map(rows.map(r => [r.id, r]));
  // Preserve the curated order (SQL doesn't guarantee it).
  const sequences = DEMO_IDS.map(id => byId.get(id)).filter(Boolean);
  return <LandingDemo sequences={JSON.parse(JSON.stringify(sequences)) as Demo[]} />;
}
