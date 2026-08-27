-- Auto-link a newly authenticated user to an existing clients row by phone
-- number, so a client's first phone+OTP login automatically gets portal
-- access — no Admin action, and critically no use of the service_role key
-- in the browser (creating/linking auth users client-side would require
-- shipping that key, which is exactly what CLAUDE.md's guardrail forbids).
--
-- Matches on the last 10 digits so it tolerates +91/leading-zero
-- formatting differences between how Staff typed the client's phone and
-- how Supabase stores the authenticated phone (E.164).
--
-- Replaces handle_new_user() from 0001 — additive migration, not an edit
-- to the applied 0001 file, per CLAUDE.md's migration convention.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'client'),
    new.raw_user_meta_data ->> 'full_name',
    new.phone
  );

  if new.phone is not null then
    update public.clients
    set portal_user_id = new.id
    where portal_user_id is null
      and right(regexp_replace(phone, '\D', '', 'g'), 10) = right(regexp_replace(new.phone, '\D', '', 'g'), 10);
  end if;

  return new;
end;
$$;
