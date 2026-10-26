-- Roadmap attachments bucket, declared in the repo instead of the dashboard.
-- Private: every read and write goes through service-role signed URLs
-- (lib/roadmap.ts), so no storage.objects policy exists for any client role.
-- Attachments live in the canonical project; creating the bucket on develop
-- is harmless and keeps the two projects' storage shape identical.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do update set public = false;
