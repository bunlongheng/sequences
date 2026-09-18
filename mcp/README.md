# sequences MCP server

Exposes the Sequences app (`sequences-bheng.vercel.app`) to any MCP-capable agent
(Claude Code, Claude Desktop, etc.) as structured tools, so a local agent can
create/read/update/delete sequence diagrams without hand-rolling `curl` + JSON
escaping.

It is a **thin wrapper over the app's HTTP API** - it does not touch the database.
All validation (the only-`sequenceDiagram` gate, title embedding, owner tagging)
stays in the route handlers, so the MCP path and the public API can never drift.

> Separate from the **system-design** MCP server - different app, different API,
> different store. This one is sequence diagrams ONLY; architecture / node-edge
> diagrams belong to the system-design MCP.

## Tools

| Tool | What it does |
|------|--------------|
| `create_sequence` | Create a Mermaid sequence diagram → returns `{ id, svg, canvas }` |
| `list_sequences` | List the owner's sequences (newest first) |
| `get_sequence` | Fetch one sequence's title + code + URLs by id |
| `update_sequence` | Replace title and/or code on an existing sequence |
| `delete_sequence` | Permanently delete a sequence by id |
| `get_sequence_schema` | The exact shape + rules + a complete example |

## Env

- `AI_API_SECRET` - **required**. Bearer token for every route. On the primary
  workstation it's exported from `~/.zshenv` (source of truth: `.env.local`), and
  the server inherits it. If missing from the process env, `load-env.mjs` reads it
  from this repo's `.env.local` as a fallback.
- `SEQUENCES_APP_URL` - optional. Defaults to `https://sequences-bheng.vercel.app`.
  Set to `http://localhost:3002` to target a local dev server.

## Register

```bash
claude mcp add sequences -s user -- node /Users/bheng/Sites/sequences/mcp/server.mjs
```

`-s user` makes it available to agents in any project. Drop `-s user` for
project-local scope. Verify with `claude mcp list` (should show `✔ Connected`).

## Cloud / headless note

This is a local stdio server - a remote cloud agent or scheduled routine has no
such process. There, use the HTTP API directly (`POST /api/ai/sequences` with the
Bearer). That's why the `/create-sequence` skill keeps the `curl` path as a
fallback: MCP for local, curl for cloud.
