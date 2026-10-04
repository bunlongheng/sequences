import db from "@/lib/db";
import { AUDIT_TAG } from "@/lib/sequence-source";

// The owner's library list, used by both surfaces that render it: the
// server-rendered index and GET /api/sequences. One query so the AUDIT_TAG
// exclusion cannot drift between them.
const LIST_SQL = `
  SELECT id, title, slug, sequence_type, created_at, updated_at, code, tags, locked,
         settings, settings->>'youtubeId' AS youtube_id
    FROM sequences
   WHERE user_id = $1
     AND NOT (COALESCE(tags, '{}'::text[]) @> ARRAY[$2]::text[])
   ORDER BY updated_at DESC`;

export async function listSequences(userId: string) {
  const { rows } = await db.query(LIST_SQL, [userId, AUDIT_TAG]);
  return rows;
}
