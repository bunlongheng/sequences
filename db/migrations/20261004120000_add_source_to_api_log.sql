-- Provenance for programmatic creates.
--
-- `source` is the calling skill's own name ("repo-audit", "create-sequence",
-- "automations"). Before this column the log recorded route, IP, user-agent and
-- the key that matched, none of which say which skill ran - so the 30 audit
-- renders filed on 2026-09-30 were only identifiable by their
-- "<repo> - File Layers" title suffix, which is a guess, not a marker.
ALTER TABLE sequence_api_requests ADD COLUMN IF NOT EXISTS source TEXT;

-- Backfill: tag any audit render still sitting in the library so it drops out
-- of the list, which filters on this tag. Idempotent, and already a no-op on
-- prod - the 30 rows were removed from the sequences table before this ran, and
-- their rows in sequence_api_requests (no FK) still hold the history. Kept for
-- local and preview copies of the DB that still carry them.
UPDATE sequences
   SET tags = (SELECT array_agg(DISTINCT t) FROM unnest(COALESCE(tags, '{}'::text[]) || ARRAY['repo-audit']) AS t)
 WHERE title ~ ' - File Layers$'
   AND NOT (COALESCE(tags, '{}'::text[]) @> ARRAY['repo-audit']::text[]);
