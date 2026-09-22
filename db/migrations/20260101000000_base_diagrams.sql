-- Base schema for the diagrams table.
-- This CREATE originally lived in the Supabase migrations that were dropped in
-- the NextAuth migration; it is restored here so the database can be built from
-- scratch (fresh CI Postgres, local dev, or a new prod). The later migrations
-- in this directory ALTER this table to add settings, is_public, tags, tokens.
--
-- id is a UUID (matches the /d/[id] share links and the legacy OWNER_USER_ID
-- ownership model). gen_random_uuid() is built into PostgreSQL 13+.

CREATE TABLE IF NOT EXISTS diagrams (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  title        text NOT NULL,
  slug         text NOT NULL,
  code         text NOT NULL,
  diagram_type text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
