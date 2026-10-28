-- Posts follow-ups from review.
-- 1. The public-read policy is for visitors (anon) only. Signed-in members
--    read through "members read posts"; a signed-in non-member must not reach
--    reviewer_notes on a published post through the authenticated grant.
-- 2. A sermon with a post can't be deleted out from under it: set null would
--    trip posts_sermon_kind_has_sermon on a published post, so restrict and
--    let the app say "delete the blog post first".

drop policy "public reads published posts" on posts;
create policy "public reads published posts" on posts for select to anon
  using (status = 'published');

alter table posts drop constraint posts_sermon_id_fkey;
alter table posts add constraint posts_sermon_id_fkey
  foreign key (sermon_id) references sermons(id) on delete restrict on update cascade;
