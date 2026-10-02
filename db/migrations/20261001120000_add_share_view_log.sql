-- Share view log: every real open of a public share link (/s/<id>) is recorded
-- here with the visitor's provenance, and the owner is alerted from it. The
-- database is shared with sibling apps, hence the sequence_ prefix.
--
-- Deliberately NOT a foreign key to sequences: deleting a diagram must not
-- erase the record of who looked at it.

create table if not exists public.sequence_share_view_log (
  id          uuid primary key default gen_random_uuid(),
  sequence_id uuid        not null,
  title       text,
  kind        text        not null default 'view',
  ip          text,
  city        text,
  country     text,
  user_agent  text,
  referer     text,
  emailed     boolean     not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_sequence_share_view_log_seq on public.sequence_share_view_log (sequence_id, created_at desc);

comment on table public.sequence_share_view_log is
  'One row per real view of a public share link (link-preview crawlers excluded). kind = view, or unlock once a passcode gate exists.';
