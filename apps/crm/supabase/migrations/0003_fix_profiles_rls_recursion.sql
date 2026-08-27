-- Fix: profiles_select_admin / profiles_insert_admin / profiles_update_admin
-- (from 0001) queried public.profiles directly inside their own USING/WITH
-- CHECK clause. RLS applies to that subquery too, which re-evaluates the
-- same policies, causing infinite recursion (Postgres error 42P17) on every
-- profiles read. Rewritten to use public.current_role(), which is
-- SECURITY DEFINER and so bypasses RLS internally — no recursion.

drop policy "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles for select
  using (public.current_role() = 'admin');

drop policy "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
  on public.profiles for insert
  with check (public.current_role() = 'admin');

drop policy "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.current_role() = 'admin');
