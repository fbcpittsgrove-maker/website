-- Feature roadmap board — the in-app tracker (canonical vocabulary: `medium`
-- not `normal`, `requested_by_name` text, kind/status/priority spelled exactly
-- as the master contract expects). Prod owns the rows; other environments
-- proxy through prod's /api/roadmap. This base migration creates on both
-- projects; the dev DB drops the tables once the peer is wired.

create type roadmap_kind as enum ('feature', 'bug', 'change');
create type roadmap_status as enum ('requested', 'planned', 'building', 'on_dev', 'live', 'declined');
create type roadmap_priority as enum ('low', 'medium', 'high', 'critical');

create table if not exists roadmap_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  kind roadmap_kind not null default 'feature',
  area text not null default 'general',
  status roadmap_status not null default 'requested',
  priority roadmap_priority not null default 'medium',
  requested_by uuid references profiles(id) on delete set null,
  requested_by_name text,
  decision_note text,
  dev_update text,
  dev_update_at timestamptz,
  dev_update_needs_reply boolean not null default false,
  pinned_at timestamptz,
  pinned_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists roadmap_items_status_idx on roadmap_items(status);
create index if not exists roadmap_items_requested_by_idx on roadmap_items(requested_by);

alter table roadmap_items enable row level security;

create policy "admins and owners read" on roadmap_items for select to authenticated
  using (is_admin(auth.uid()) or is_owner(auth.uid()));

create policy "admins request, owners insert" on roadmap_items for insert to authenticated
  with check (
    requested_by = auth.uid()
    and (is_owner(auth.uid()) or (is_admin(auth.uid()) and status = 'requested'))
  );

create policy "owners update" on roadmap_items for update to authenticated
  using (is_owner(auth.uid())) with check (is_owner(auth.uid()));

create policy "owners delete" on roadmap_items for delete to authenticated
  using (is_owner(auth.uid()));

create table if not exists roadmap_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references roadmap_items(id) on delete cascade,
  body text not null,
  author_id uuid references profiles(id) on delete set null,
  author_name text,
  created_at timestamptz not null default now()
);
create index if not exists roadmap_comments_item_idx on roadmap_comments (item_id, created_at);

alter table roadmap_comments enable row level security;

create policy "admins and owners read comments" on roadmap_comments for select to authenticated
  using (is_admin(auth.uid()) or is_owner(auth.uid()));

-- Insert only, and only as yourself. No update/delete: a thread someone can
-- quietly rewrite is not a record of what was said.
create policy "admins and owners comment" on roadmap_comments for insert to authenticated
  with check (author_id = auth.uid() and (is_admin(auth.uid()) or is_owner(auth.uid())));

create table if not exists roadmap_attachments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references roadmap_items(id) on delete cascade,
  file_name text not null,
  file_path text not null unique,
  mime_type text,
  size_bytes bigint not null,
  uploaded_by uuid references profiles(id) on delete set null,
  uploaded_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists roadmap_attachments_item_idx on roadmap_attachments (item_id, created_at);

-- Server-side service-role only (ticket -> signed PUT -> register). RLS on,
-- no policy = the closed state.
alter table roadmap_attachments enable row level security;

create table if not exists roadmap_votes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references roadmap_items(id) on delete cascade,
  voter_key text not null,
  voter_name text not null default '',
  created_at timestamptz not null default now(),
  unique (item_id, voter_key)
);
create index if not exists roadmap_votes_item_idx on roadmap_votes (item_id);

alter table roadmap_votes enable row level security;

create policy "roadmap_votes_select" on roadmap_votes for select to authenticated
  using (is_admin(auth.uid()) or is_owner(auth.uid()));
create policy "roadmap_votes_insert" on roadmap_votes for insert to authenticated
  with check (voter_key = auth.uid()::text);
create policy "roadmap_votes_delete" on roadmap_votes for delete to authenticated
  using (voter_key = auth.uid()::text);
