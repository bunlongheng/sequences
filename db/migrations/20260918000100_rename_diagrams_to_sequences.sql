-- Rename the app's table from "diagrams" to "sequences".
--
-- The database is SHARED with several sibling apps, and two things still write
-- to the old name: the automations app (server/pipeline.js) and, for the length
-- of a deploy, the previously-deployed build of this app. So the rename ends by
-- leaving an auto-updatable view behind at the old name. The view qualifies for
-- automatic INSERT/UPDATE/DELETE rewriting because it selects from exactly one
-- table and every column is a plain column reference (a rename via AS is still
-- a plain reference), so old writers keep working unchanged.
--
-- Guarded so a re-run is a no-op: after this has run, "diagrams" is a VIEW and
-- "sequences" is the table, and ALTER TABLE ... RENAME would happily rename the
-- view and collide. The guard makes that impossible.

do $$
begin
  if to_regclass('public.sequences') is not null then
    raise notice 'public.sequences already exists - skipping rename';
    return;
  end if;

  execute 'alter table public.diagrams rename to sequences';
  execute 'alter table public.sequences rename column diagram_type to sequence_type';

  -- Production and a fresh database carry DIFFERENT index names: production
  -- predates db/migrations (diagrams_pkey, idx_diagrams_user_id,
  -- idx_diagrams_slug) while a fresh build gets the names declared in this
  -- directory. Rename whatever is actually there instead of assuming either
  -- set. Renaming a constraint's backing index renames the constraint with it.
  declare r record;
  begin
    for r in
      select indexname from pg_indexes
      where schemaname = 'public' and tablename = 'sequences' and indexname like '%diagrams%'
    loop
      execute format('alter index public.%I rename to %I',
                     r.indexname, replace(r.indexname, 'diagrams', 'sequences'));
    end loop;
  end;

  execute $v$
    create or replace view public.diagrams as
      select id, user_id, title, slug, code,
             sequence_type as diagram_type,
             is_favorite, settings, created_at, updated_at,
             is_public, tags, tokens_in, tokens_out
      from public.sequences
  $v$;

  execute $c$
    comment on view public.diagrams is
      'Back-compat alias for public.sequences (renamed 2026-09-18). Auto-updatable. Kept for the automations app and any old deployment; drop once every writer uses sequences.'
  $c$;
end $$;
