-- Faith Baptist Church of Pittsgrove — core: profiles, invites, activity log,
-- email settings, auth throttle. Single-org app: roles are admin (church
-- admin) and editor (keeps events, sermons and announcements current).
-- is_owner is orthogonal — The Software Effect tier.

create extension if not exists citext;

create type user_role as enum ('admin', 'editor');

-- ============================================================ profiles

-- id is deliberately NOT a foreign key to auth.users: the owner bootstrap
-- inserts owner rows before any auth sign-in exists, and handle_new_user /
-- link_confirmed_user re-key the row to the real auth id once confirmed.
create table profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email citext not null unique,
  role user_role not null default 'editor',
  active boolean not null default true,
  is_owner boolean not null default false,
  ui_prefs jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Role helpers answer for the caller only: any uid other than the session's
-- own is simply false, so a signed-in user cannot probe other profiles.
create function is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid = auth.uid()
     and exists (select 1 from profiles p where p.id = uid and p.active and p.role = 'admin');
$$;

create function is_owner(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid = auth.uid()
     and exists (select 1 from profiles p where p.id = uid and p.active and p.is_owner);
$$;

create function is_active_member(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid = auth.uid()
     and exists (select 1 from profiles p where p.id = uid and p.active);
$$;

revoke execute on function is_admin(uuid) from public, anon;
revoke execute on function is_owner(uuid) from public, anon;
revoke execute on function is_active_member(uuid) from public, anon;

-- ============================================================ invites

create table invites (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  role user_role not null,
  invited_by uuid references profiles(id) on delete set null on update cascade,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz default now()
);

create index invites_invited_by_idx on invites(invited_by);

-- Sign-ups are invitation-only: a new auth user with no pending invite and no
-- existing profile row is refused. Re-keying an existing row to the new auth
-- id requires a CONFIRMED email, so an unconfirmed stranger can never claim
-- another person's row.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv invites%rowtype;
begin
  select * into inv from invites
   where email = new.email and accepted_at is null and expires_at > now()
   order by created_at desc limit 1;

  if inv.id is null and not exists (select 1 from profiles where email = new.email) then
    raise exception 'Sign-ups are by invitation only.' using errcode = 'P0001';
  end if;

  insert into profiles (id, full_name, email, role)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.email),
          new.email,
          coalesce(inv.role, 'editor'))
  on conflict (email) do update set id = excluded.id
    where new.email_confirmed_at is not null;

  if inv.id is not null then
    update invites set accepted_at = now() where id = inv.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- A user confirmed after creation (manual add that confirms later, or an
-- accepted invite) is linked to their pre-existing row on confirmation.
create function link_confirmed_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles p set id = new.id, updated_at = now()
   where p.email = new.email and p.id <> new.id;
  return new;
end $$;

create trigger on_auth_user_confirmed after update on auth.users
  for each row
  when (old.email_confirmed_at is distinct from new.email_confirmed_at
        and new.email_confirmed_at is not null)
  execute function link_confirmed_user();

-- ============================================================ activity log

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null on update cascade,
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz default now()
);

create index activity_log_created_idx on activity_log(created_at desc);
create index activity_log_actor_idx on activity_log(actor_id);

-- ============================================================ email settings

create table email_settings (
  key text primary key,
  value jsonb not null default '{}'
);

insert into email_settings (key, value) values ('gates', '{"master":true,"triggers":{}}')
on conflict (key) do nothing;

-- ============================================================ auth throttle

-- Fixed-window counter the public forgot-password action and
-- /api/report-issue call through the service role. No client reads it.
create table auth_throttle (
  key text primary key,
  hits integer not null default 0,
  window_start timestamptz not null default now()
);

create or replace function throttle_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare cur auth_throttle%rowtype;
begin
  delete from auth_throttle where window_start < now() - interval '1 day';

  insert into auth_throttle (key, hits, window_start) values (p_key, 1, now())
  on conflict (key) do update set
    hits = case
      when auth_throttle.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else auth_throttle.hits + 1 end,
    window_start = case
      when auth_throttle.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else auth_throttle.window_start end
  returning * into cur;

  return cur.hits <= p_limit;
end $$;
revoke all on function throttle_hit(text, integer, integer) from public, anon, authenticated;

-- ============================================================ RLS

alter table profiles enable row level security;
alter table invites enable row level security;
alter table activity_log enable row level security;
alter table email_settings enable row level security;
alter table auth_throttle enable row level security;

-- profiles: own row, or an active admin reads everyone. NEVER `using (true)`
-- — that lets any authenticated JWT read every name/email/role.
create policy "profiles_select_own_or_admin" on profiles for select to authenticated
  using (id = auth.uid() or is_admin(auth.uid()));

-- Column grants (grants migration) narrow what a session may change:
-- full_name and ui_prefs only. Role, active and is_owner move through the
-- service-role client (admin actions, bootstrap).
create policy "profiles_update_own_or_admin" on profiles for update to authenticated
  using (id = auth.uid() or is_admin(auth.uid()))
  with check (id = auth.uid() or is_admin(auth.uid()));

create policy "admin reads invites" on invites for select to authenticated
  using (is_admin(auth.uid()));
create policy "admin writes invites" on invites for insert to authenticated
  with check (is_admin(auth.uid()));
create policy "admin updates invites" on invites for update to authenticated
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy "admin deletes invites" on invites for delete to authenticated
  using (is_admin(auth.uid()));

-- activity_log: append-only via the service role; admins and owners read.
create policy "admin reads activity" on activity_log for select to authenticated
  using (is_admin(auth.uid()) or is_owner(auth.uid()));

create policy "admin reads email settings" on email_settings for select to authenticated
  using (is_admin(auth.uid()));
create policy "admin updates email settings" on email_settings for update to authenticated
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
