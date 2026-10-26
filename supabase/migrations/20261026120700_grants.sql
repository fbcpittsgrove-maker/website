-- API-role grants, stated explicitly so both projects land identical no matter
-- what each project's default privileges did. RLS still scopes rows; these
-- grants only decide whether a role can reach a table at all.

grant usage on schema public to anon, authenticated, service_role;

-- Start from nothing for the client roles, then grant exactly what the RLS
-- policies are written against.
revoke all on table profiles, invites, activity_log, email_settings, auth_throttle, app_issues,
  roadmap_items, roadmap_comments, roadmap_attachments, roadmap_votes,
  events, sermons, announcements
  from anon, authenticated;

-- anon: the public site reads published content, nothing else.
grant select on table events, sermons, announcements to anon;

-- authenticated
grant select on table profiles to authenticated;
grant update (full_name, ui_prefs) on table profiles to authenticated;
grant select, insert, update, delete on table invites to authenticated;
grant select on table activity_log to authenticated;
grant select, update on table email_settings to authenticated;
grant select, update, delete on table app_issues to authenticated;
grant select, insert, update, delete on table roadmap_items to authenticated;
grant select, insert on table roadmap_comments to authenticated;
grant select, insert, delete on table roadmap_votes to authenticated;
grant select, insert, update, delete on table events, sermons, announcements to authenticated;

-- service_role: full access — the app server's admin client. Bypasses RLS.
grant all on table profiles, invites, activity_log, email_settings, auth_throttle, app_issues,
  roadmap_items, roadmap_comments, roadmap_attachments, roadmap_votes,
  events, sermons, announcements
  to service_role;

-- Functions whose PUBLIC execute grant was revoked in earlier migrations.
grant execute on function schema_snapshot() to service_role;
grant execute on function migration_ledger() to service_role;
grant execute on function migration_ledger_full() to service_role;
grant execute on function report_issue(text, text, text, text, text, text, jsonb, text, uuid) to service_role;
grant execute on function prune_app_issues() to service_role;
grant execute on function throttle_hit(text, integer, integer) to service_role;
grant execute on function is_admin(uuid), is_owner(uuid), is_active_member(uuid) to authenticated, service_role;
grant execute on function church_today() to anon, authenticated, service_role;
