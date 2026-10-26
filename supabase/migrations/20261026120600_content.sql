-- Church content the public site renders: events, sermons, announcements.
-- Visitors (anon) read published rows only; any active member (admin or
-- editor) reads and edits everything. Announcements also honour their
-- show window, in the church's own day (America/New_York), not UTC.

create function church_today() returns date
language sql stable set search_path = public as $$
  select (now() at time zone 'America/New_York')::date;
$$;

create function set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================ events

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  published boolean not null default false,
  created_by uuid references profiles(id) on delete set null on update cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_ends_after_start check (ends_at is null or ends_at >= starts_at)
);

create index events_starts_at_idx on events(starts_at);
create index events_created_by_idx on events(created_by);

create trigger events_updated_at before update on events
  for each row execute function set_updated_at();

-- ============================================================ sermons

create table sermons (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  preacher text not null default '',
  preached_on date not null,
  scripture text not null default '',
  summary text not null default '',
  video_url text check (video_url is null or video_url ~ '^https://'),
  audio_url text check (audio_url is null or audio_url ~ '^https://'),
  published boolean not null default false,
  created_by uuid references profiles(id) on delete set null on update cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sermons_preached_on_idx on sermons(preached_on desc);
create index sermons_created_by_idx on sermons(created_by);

create trigger sermons_updated_at before update on sermons
  for each row execute function set_updated_at();

-- ============================================================ announcements

create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  body text not null default '',
  starts_on date,
  ends_on date,
  published boolean not null default false,
  created_by uuid references profiles(id) on delete set null on update cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_ends_after_start check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index announcements_window_idx on announcements(starts_on, ends_on);
create index announcements_created_by_idx on announcements(created_by);

create trigger announcements_updated_at before update on announcements
  for each row execute function set_updated_at();

-- ============================================================ RLS

alter table events enable row level security;
alter table sermons enable row level security;
alter table announcements enable row level security;

create policy "public reads published events" on events for select to anon, authenticated
  using (published);
create policy "members read events" on events for select to authenticated
  using (is_active_member(auth.uid()));
create policy "members insert events" on events for insert to authenticated
  with check (is_active_member(auth.uid()));
create policy "members update events" on events for update to authenticated
  using (is_active_member(auth.uid())) with check (is_active_member(auth.uid()));
create policy "members delete events" on events for delete to authenticated
  using (is_active_member(auth.uid()));

create policy "public reads published sermons" on sermons for select to anon, authenticated
  using (published);
create policy "members read sermons" on sermons for select to authenticated
  using (is_active_member(auth.uid()));
create policy "members insert sermons" on sermons for insert to authenticated
  with check (is_active_member(auth.uid()));
create policy "members update sermons" on sermons for update to authenticated
  using (is_active_member(auth.uid())) with check (is_active_member(auth.uid()));
create policy "members delete sermons" on sermons for delete to authenticated
  using (is_active_member(auth.uid()));

create policy "public reads current announcements" on announcements for select to anon, authenticated
  using (
    published
    and (starts_on is null or starts_on <= church_today())
    and (ends_on is null or ends_on >= church_today())
  );
create policy "members read announcements" on announcements for select to authenticated
  using (is_active_member(auth.uid()));
create policy "members insert announcements" on announcements for insert to authenticated
  with check (is_active_member(auth.uid()));
create policy "members update announcements" on announcements for update to authenticated
  using (is_active_member(auth.uid())) with check (is_active_member(auth.uid()));
create policy "members delete announcements" on announcements for delete to authenticated
  using (is_active_member(auth.uid()));
