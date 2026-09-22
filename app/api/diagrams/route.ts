// Back-compat alias for /api/sequences (the app was renamed from Diagrams to
// Sequences on 2026-09-18). External agents, the MCP server and older scripts
// still POST here, so the old path forwards to the same handlers rather than
// 404ing. Do not add logic here - it must stay a pure re-export.
export { GET, POST } from "@/app/api/sequences/route";
