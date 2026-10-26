# Migrations

The file IS the migration. Supabase Free has no branching, so the two
projects (`fbc-pittsgrove-dev`, then `fbc-pittsgrove` prod) are migrated with
`yarn supabase db push --db-url <that project's session pooler URL>` — dev
first, prod after the code reaches `master`. Never the dashboard SQL editor,
never MCP apply tools: a hand-applied migration stamps a version into
`supabase_migrations` that no repo file matches.

- Filenames: `YYYYMMDDHHMMSS_name.sql`, timestamped only, UTC.
- Roadmap-table migrations after the base one wrap their whole body in one
  `do $$ … end $$` that returns early when
  `to_regclass('public.roadmap_items') is null` — the roadmap tables live in
  the PRODUCTION database only.
- Every new table: RLS on, plus the restrictive `mfa_aal2` policy
  (see `_TEMPLATE.sql`).
- Reference-data inserts are idempotent (`on conflict … do nothing/update`).
