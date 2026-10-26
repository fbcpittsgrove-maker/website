-- Owner bootstrap: Manny + Derek exist as owner-admins in BOTH databases the
-- moment migrations run. The auth side stays manual per project (dashboard
-- add-user, password + auto-confirm, no email); link_confirmed_user re-keys
-- these rows to the real auth id. The church admin keeps role 'admin' with
-- is_owner = false — everything except the owner surfaces.

insert into profiles (full_name, email, role, active, is_owner) values
  ('Manny', 'manny@thesoftwareeffect.com', 'admin', true, true),
  ('Derek', 'derek@thesoftwareeffect.com', 'admin', true, true)
on conflict (email) do update set
  role = 'admin', active = true, is_owner = true;
