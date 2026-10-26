-- MFA at the database. The proxy sends a password-only session on an
-- authenticator account back to the code step, but PostgREST and Storage
-- answer the same JWT directly with the publishable key — so the second
-- factor is enforced where the data lives too. mfa_satisfied() is true for an
-- aal2 session, or for a user with no verified factor (MFA is opt-in). One
-- RESTRICTIVE policy per RLS table ANDs it onto every permissive policy for
-- `authenticated`; anon (the public site) and the service role are
-- unaffected. New tables need the same policy — see _TEMPLATE.sql.

create or replace function mfa_satisfied() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
      or not exists (
        select 1 from auth.mfa_factors f
         where f.user_id = auth.uid() and f.status = 'verified'
      );
$$;
revoke all on function mfa_satisfied() from public, anon;
grant execute on function mfa_satisfied() to authenticated;

do $$
declare t record;
begin
  for t in
    select tablename from pg_tables
     where schemaname = 'public' and rowsecurity
  loop
    execute format('drop policy if exists "mfa_aal2" on public.%I', t.tablename);
    execute format(
      'create policy "mfa_aal2" on public.%I as restrictive to authenticated using (mfa_satisfied()) with check (mfa_satisfied())',
      t.tablename
    );
  end loop;
end $$;
