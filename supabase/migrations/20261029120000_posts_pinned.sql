-- Pinned posts: a published sermon post or question page the church wants
-- more people to read, shown first on its list page (sermons also on the
-- home page). pinned_at orders them, newest pin first; null = not pinned.
-- The app holds the three-per-kind cap.

alter table posts add column pinned_at timestamptz;
alter table posts add constraint posts_pinned_is_published check (pinned_at is null or status = 'published');

create index posts_pinned_idx on posts(kind, pinned_at desc) where pinned_at is not null;

grant select (pinned_at) on table posts to anon;
