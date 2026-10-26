-- Owner observability: the owner-only issue log. Raw Postgres errors and
-- schema detail are useful to whoever runs the platform and noise (plus a
-- small information leak) to the client admin — hence is_owner, orthogonal
-- to role.

create table app_issues (
  id uuid primary key default gen_random_uuid(),

  -- Dedupe key: environment + source + route + code + normalized message.
  -- One row per distinct problem; repeats bump times_seen instead of
  -- inserting, so this table stays small no matter how loud a bug is.
  fingerprint text not null unique,

  environment text not null,          -- 'master' | 'develop' | 'local'
  source text not null,               -- 'server_action' | 'route' | 'client' | 'proxy'
  route text,                         -- action name or path
  message text not null,
  error_code text,                    -- Postgres/PostgREST code, e.g. 42501, PGRST301
  detail jsonb,
  release_sha text,                   -- which deploy introduced it
  user_id uuid references profiles(id) on delete set null on update cascade,

  times_seen int not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  resolved_at timestamptz,
  notified_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index app_issues_open_idx
  on app_issues (last_seen_at desc) where resolved_at is null;
create index app_issues_env_idx on app_issues (environment);

-- ============================================================ RLS

alter table app_issues enable row level security;

-- Owners read and triage. No insert/update policy for `authenticated` at all:
-- writes come from the service-role client only, so a broken RLS policy can
-- never block the log that would have explained it.
create policy "owner reads" on app_issues for select to authenticated
  using (is_owner(auth.uid()));
create policy "owner triages" on app_issues for update to authenticated
  using (is_owner(auth.uid())) with check (is_owner(auth.uid()));
create policy "owner deletes" on app_issues for delete to authenticated
  using (is_owner(auth.uid()));

-- Realtime: the Issues page live-tails this table. Postgres Changes respects
-- RLS, so only owners receive events.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table app_issues;
  end if;
end $$;

-- ============================================================ upsert + prune

-- Single round trip per report. Also the only place times_seen moves.
create or replace function report_issue(
  p_fingerprint text,
  p_environment text,
  p_source text,
  p_route text,
  p_message text,
  p_error_code text,
  p_detail jsonb,
  p_release_sha text,
  p_user_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into app_issues (
    fingerprint, environment, source, route, message,
    error_code, detail, release_sha, user_id
  ) values (
    p_fingerprint, p_environment, p_source, p_route, p_message,
    p_error_code, p_detail, p_release_sha, p_user_id
  )
  on conflict (fingerprint) do update set
    times_seen  = app_issues.times_seen + 1,
    last_seen_at = now(),
    updated_at  = now(),
    detail      = coalesce(excluded.detail, app_issues.detail),
    release_sha = coalesce(excluded.release_sha, app_issues.release_sha),
    -- a recurrence reopens something previously marked resolved
    resolved_at = case
                    when app_issues.resolved_at is not null then null
                    else app_issues.resolved_at
                  end;
end $$;

-- Bounded growth without a scheduler: drop resolved rows after 30 days and
-- untouched open rows after 180. The Issues page fires this on load.
create or replace function prune_app_issues() returns void
language sql security definer set search_path = public as $$
  delete from app_issues
   where (resolved_at is not null and resolved_at < now() - interval '30 days')
      or (resolved_at is null and last_seen_at < now() - interval '180 days');
$$;

-- Only the service-role client (the app server) writes or prunes. Without
-- this, any signed-in user could call the security-definer RPCs directly
-- and spam or empty the log.
revoke execute on function report_issue(text, text, text, text, text, text, jsonb, text, uuid)
  from public, anon, authenticated;
revoke execute on function prune_app_issues() from public, anon, authenticated;
