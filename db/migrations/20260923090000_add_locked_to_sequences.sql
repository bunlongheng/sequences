-- Lock a sequence so it cannot be deleted by accident.
--
-- A diagram embedded in a README, a Confluence page or the public demo wall is
-- a dependency of something outside this app: deleting it breaks an image
-- somebody else is looking at. The flag is advisory in the UI and enforced in
-- the DELETE route, so a stray click or a stray curl both bounce.
--
-- Additive and idempotent: safe to re-run, and every existing row defaults to
-- unlocked so nothing changes behaviour until a diagram is explicitly locked.

alter table public.sequences
  add column if not exists locked boolean not null default false;

comment on column public.sequences.locked is
  'true = protected from deletion. Set for diagrams linked publicly (README embeds, the /demo lineup).';
