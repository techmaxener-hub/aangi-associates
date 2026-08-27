-- Staff need read access to all profiles to assign tasks (task allotment
-- engine) and see team members in pickers — read-only, matching
-- "Staff cannot create Staff/Admin accounts" (no insert/update grant here).
create policy "profiles_select_staff"
  on public.profiles for select
  using (public.current_role() = 'staff');
