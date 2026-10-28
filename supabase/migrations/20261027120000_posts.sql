-- Sermon blog: one post per preached sermon, plus question pages answered
-- from the sermons. Drafts are written off-site and imported; a member
-- (Steven) reviews, edits and publishes. Visitors read published posts only.
-- A question with status 'idea' is a question no sermon answers yet — a
-- sermon idea for the pastors, never shown publicly.

create table posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sermon', 'question')),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  question text not null default '',
  body_md text not null default '',
  reviewer_notes text not null default '',
  status text not null default 'draft' check (status in ('idea', 'draft', 'needs_changes', 'published')),
  sermon_id uuid references sermons(id) on delete set null on update cascade,
  published_at timestamptz,
  reviewed_by uuid references profiles(id) on delete set null on update cascade,
  created_by uuid references profiles(id) on delete set null on update cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_idea_is_question check (status <> 'idea' or kind = 'question'),
  constraint posts_sermon_kind_has_sermon check (kind <> 'sermon' or sermon_id is not null or status <> 'published'),
  constraint posts_published_complete check (
    status <> 'published' or (published_at is not null and length(trim(body_md)) > 0)
  )
);

create unique index posts_one_per_sermon on posts(sermon_id) where kind = 'sermon';
create index posts_status_idx on posts(status, published_at desc);
create index posts_sermon_id_idx on posts(sermon_id);
create index posts_reviewed_by_idx on posts(reviewed_by);
create index posts_created_by_idx on posts(created_by);

create trigger posts_updated_at before update on posts
  for each row execute function set_updated_at();

-- Which sermons a post draws from. start_seconds marks the moment in the
-- recording the post quotes.
create table post_sources (
  post_id uuid not null references posts(id) on delete cascade on update cascade,
  sermon_id uuid not null references sermons(id) on delete cascade on update cascade,
  start_seconds integer check (start_seconds is null or start_seconds >= 0),
  primary key (post_id, sermon_id)
);

create index post_sources_sermon_id_idx on post_sources(sermon_id);

-- Machine transcript of a sermon recording, kept for the reviewer to check
-- quotes against. Members only; never public.
create table sermon_transcripts (
  sermon_id uuid primary key references sermons(id) on delete cascade on update cascade,
  body text not null check (length(trim(body)) > 0),
  segments jsonb not null default '[]'::jsonb check (jsonb_typeof(segments) = 'array'),
  engine text not null default '',
  created_at timestamptz not null default now()
);

-- ============================================================ RLS

alter table posts enable row level security;
alter table post_sources enable row level security;
alter table sermon_transcripts enable row level security;

create policy "public reads published posts" on posts for select to anon, authenticated
  using (status = 'published');
create policy "members read posts" on posts for select to authenticated
  using (is_active_member(auth.uid()));
create policy "members insert posts" on posts for insert to authenticated
  with check (is_active_member(auth.uid()));
create policy "members update posts" on posts for update to authenticated
  using (is_active_member(auth.uid())) with check (is_active_member(auth.uid()));
create policy "members delete posts" on posts for delete to authenticated
  using (is_active_member(auth.uid()));

create policy "public reads sources of published posts" on post_sources for select to anon, authenticated
  using (exists (select 1 from posts p where p.id = post_id and p.status = 'published'));
create policy "members read post sources" on post_sources for select to authenticated
  using (is_active_member(auth.uid()));
create policy "members insert post sources" on post_sources for insert to authenticated
  with check (is_active_member(auth.uid()));
create policy "members delete post sources" on post_sources for delete to authenticated
  using (is_active_member(auth.uid()));

create policy "members read transcripts" on sermon_transcripts for select to authenticated
  using (is_active_member(auth.uid()));

create policy "mfa_aal2" on posts as restrictive to authenticated using (mfa_satisfied()) with check (mfa_satisfied());
create policy "mfa_aal2" on post_sources as restrictive to authenticated using (mfa_satisfied()) with check (mfa_satisfied());
create policy "mfa_aal2" on sermon_transcripts as restrictive to authenticated using (mfa_satisfied()) with check (mfa_satisfied());

-- ============================================================ grants

revoke all on table posts, post_sources, sermon_transcripts from anon, authenticated;

-- anon gets the public columns only: reviewer notes and who reviewed stay internal.
grant select (id, kind, slug, title, description, question, body_md, status, sermon_id, published_at, created_at, updated_at)
  on table posts to anon;
grant select on table post_sources to anon;
grant select, insert, update, delete on table posts to authenticated;
grant select, insert, delete on table post_sources to authenticated;
grant select on table sermon_transcripts to authenticated;

grant all on table posts, post_sources, sermon_transcripts to service_role;
