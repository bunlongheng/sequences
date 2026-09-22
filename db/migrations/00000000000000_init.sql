-- Base schema for the `diagrams` table. Every later migration in this
-- directory only ALTERs this table (add column if not exists), so a fresh
-- clone had no way to bootstrap a database until this file existed.
-- Column list reverse-engineered from app/api/diagrams/route.ts,
-- app/api/diagrams/[id]/route.ts, app/api/ai/diagrams/route.ts,
-- app/api/ai/generate/route.ts, and the later ALTER TABLE migrations.

-- gen_random_uuid() is built into Postgres core since PG13 (no pgcrypto
-- extension needed - some managed hosts restrict CREATE EXTENSION privileges).

CREATE TABLE IF NOT EXISTS diagrams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  code TEXT NOT NULL,
  diagram_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settings JSONB,
  is_public BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  tokens_in INTEGER DEFAULT NULL,
  tokens_out INTEGER DEFAULT NULL
);
