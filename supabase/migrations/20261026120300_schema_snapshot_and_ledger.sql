-- Owner diagnostics plumbing: structural snapshot + migration ledger.
-- Both return catalog metadata only (table names, RLS state, policy counts,
-- column grants, function names, ledger versions) — never row data — so one
-- environment can hand its shape to the peer over an authenticated endpoint
-- instead of copying database credentials across environments.

create or replace function schema_snapshot() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'tables', coalesce((
      select json_agg(t order by t->>'table') from (
        select json_build_object(
          'table', c.relname,
          'rls_enabled', c.relrowsecurity,
          'policies', (select count(*) from pg_policy p where p.polrelid = c.oid),
          'columns', (select count(*) from information_schema.columns col
                       where col.table_schema = 'public' and col.table_name = c.relname)
        ) as t
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
      ) s
    ), '[]'::json),
    'grants', coalesce((
      select json_agg(g order by g->>'table', g->>'privilege') from (
        select json_build_object(
          'table', table_name,
          'privilege', privilege_type,
          'columns', string_agg(column_name, ',' order by column_name)
        ) as g
        from information_schema.column_privileges
        where table_schema = 'public' and grantee = 'authenticated'
        group by table_name, privilege_type
      ) s
    ), '[]'::json),
    'functions', coalesce((
      select json_agg(p.proname order by p.proname)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
    ), '[]'::json)
  );
$$;

revoke execute on function schema_snapshot() from public, anon, authenticated;

-- Expose the migration ledger: a schema_migrations version with no matching
-- repo file silently halts every later migration, and PostgREST can't reach
-- supabase_migrations. Service-role only — the ledger names internal schema
-- history, not secret, but no browser-facing role has business reading it.
create or replace function migration_ledger()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('version', t.version, 'name', t.name) order by t.version desc),
    '[]'::jsonb
  )
  from (
    select version, name
    from supabase_migrations.schema_migrations
    order by version desc
    limit 20
  ) t
$$;

revoke all on function migration_ledger() from public;
revoke all on function migration_ledger() from anon;
revoke all on function migration_ledger() from authenticated;
grant execute on function migration_ledger() to service_role;

create function public.migration_ledger_full()
returns jsonb
language sql stable security definer set search_path = '' as $$
  with total as (
    select count(*) as n from supabase_migrations.schema_migrations
  ), entries as (
    select version, name,
      case when statements is null or cardinality(statements) = 0 then null
        else encode(sha256(convert_to(to_jsonb(statements)::text, 'UTF8')), 'hex')
      end as statements_sha256
    from supabase_migrations.schema_migrations
    order by version desc
    limit 10000
  )
  select jsonb_build_object(
    'version', 1,
    'total', total.n,
    'complete', total.n <= 10000,
    'digestAlgorithm', 'sha256-jsonb-statements-v1',
    'entries', coalesce((select jsonb_agg(to_jsonb(e) order by e.version desc) from entries e), '[]'::jsonb)
  ) from total;
$$;

revoke all on function public.migration_ledger_full() from public, anon, authenticated;
grant execute on function public.migration_ledger_full() to service_role;
