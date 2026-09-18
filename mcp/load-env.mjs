// Loaded FIRST so the MCP server sees SEQUENCES_API_SECRET no matter which working
// directory (or cloud shell) launched it. If the var is already in the process
// env (the primary workstation exports it from ~/.zshenv), we keep that; only
// when it's missing do we read the repo's .env.local as a fallback.
//
// Dependency-free on purpose: a standalone MCP server shouldn't need dotenv.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

if (!process.env.SEQUENCES_API_SECRET && !process.env.DIAGRAMS_API_SECRET && !process.env.AI_API_SECRET) {
  try {
    const envPath = fileURLToPath(new URL('../.env.local', import.meta.url))
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const key = m[1]
      if (process.env[key]) continue // never override a real env var
      // strip matching surrounding quotes, if any
      process.env[key] = m[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  } catch {
    // no .env.local (e.g. cloud) — rely on the inherited process env
  }
}
