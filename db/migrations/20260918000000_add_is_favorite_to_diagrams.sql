-- Reconcile schema drift before the sequences rename.
--
-- Production's diagrams table has carried is_favorite since the Supabase era,
-- but no migration in this directory ever declared it, so a database built
-- from scratch (CI, a fresh local) was missing the column. The rename that
-- follows builds a fixed-column compatibility view, which needs every
-- environment to agree on the column list first.
--
-- No-op against production (the column already exists).

alter table public.diagrams add column if not exists is_favorite boolean not null default false;
