import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { authorizeOwner, ownerId } from "@/lib/auth-owner";
import db from "@/lib/db";
import { uniqueSequenceSlug } from "@/lib/slugs";
import { embedTitleInCode } from "@/lib/sequence-code";

const SYSTEM = `You are an expert Mermaid sequence diagram generator.

Given a user prompt, return ONLY a valid JSON object — no markdown, no explanation — with:
{
  "title": "<concise diagram title>",
  "code": "<full mermaid sequenceDiagram code>",
  "sequenceType": "sequence"
}

CRITICAL rules:
- "title" is REQUIRED — always provide a short, descriptive title (3-6 words)
- "code" is REQUIRED — never return empty code
- code must always start with: ---\\ntitle: <title>\\n---\\nsequenceDiagram
- Use participant aliases with emoji icons, e.g.: participant U as 🧑 User
- Use ->> for requests, -->> for responses
- Max 20 messages, keep it clear and readable
- No markdown code fences in the code value
- Escape all newlines as \\n in the JSON string`;

export async function POST(req: NextRequest) {
  // ── Auth: ADMIN ONLY (local dev bypass or the logged-in owner session).
  //    The Bearer API secret is intentionally NOT accepted here: AI generation
  //    spends Anthropic credits and is an owner-only feature. The public API is
  //    render-only (POST /api/ai/sequences with a mermaid/JSON body) - it never
  //    calls Claude, so public callers cannot drain Anthropic dollars.
  if (!(await authorizeOwner(req, { allowBearer: false }))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { prompt?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { prompt } = body;
  if (!prompt?.trim()) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

  // ── Call Claude ───────────────────────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let title: string, code: string, tokensOut = 0;
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content.find(b => b.type === "text")?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]);
    title = parsed.title;
    code  = parsed.code;
    if (!title || !code) throw new Error("Missing title or code");
    tokensOut = msg.usage.output_tokens;
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[ai/generate] generation error:", detail);
    const lower = detail.toLowerCase();
    const isBilling = lower.includes("credit") || lower.includes("billing") || lower.includes("402");
    if (isBilling) {
      return NextResponse.json({ error: "AI generation is temporarily unavailable (billing)" }, { status: 402 });
    }
    return NextResponse.json({ error: "Diagram generation failed" }, { status: 500 });
  }

  // ── Save to DB ────────────────────────────────────────────────────────────
  const ownerUserId = ownerId();
  if (!ownerUserId) return NextResponse.json({ error: "OWNER_USER_ID not configured" }, { status: 500 });

  const slug = await uniqueSequenceSlug(ownerUserId, title);

  // Ensure title is embedded in the code
  const finalCode = embedTitleInCode(code, title);

  const settings = { opts: { boxOverlay: "gloss", iconMode: "icons" } };
  const { rows } = await db.query(
    "INSERT INTO sequences (user_id, title, slug, code, sequence_type, tags, settings, tokens_out) VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8) RETURNING *",
    [ownerUserId, title.trim(), slug, finalCode, "sequence", ["AI"], JSON.stringify(settings), tokensOut]
  );

  if (rows.length === 0) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  const diagram = rows[0];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sequences-bheng.vercel.app";
  return NextResponse.json({ ...diagram, url: `${baseUrl}/d/${diagram.id}`, svg: `${baseUrl}/svg/${diagram.id}`, editor: `${baseUrl}/?id=${diagram.id}` }, { status: 201 });
}
