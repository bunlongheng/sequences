CREATE INDEX IF NOT EXISTS diagrams_user_updated_idx ON diagrams (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS diagrams_user_slug_idx ON diagrams (user_id, slug);
