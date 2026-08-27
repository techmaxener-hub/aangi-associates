-- Aangi Associates CRM — profiles table and 4-tier role model.
-- Additive-only: never edit this file after it has been applied against a
-- real project; add a new migration instead (see CLAUDE.md).

create type public.app_role as enum ('admin', 'staff', 'associate', 'client');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Everyone can read their own profile.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Admins can read every profile (full visibility, per CLAUDE.md roles).
create policy "profiles_select_admin"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Accounts are provisioned by Admin/Staff, not self-registered — but this
-- policy still lets an authenticated Admin insert/update profile rows
-- directly from the app, once at least one Admin profile exists.
create policy "profiles_insert_admin"
  on public.profiles for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "profiles_update_admin"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Bootstraps the very first profile row (and every one after it): whenever
-- a new auth.users row is created, auto-insert a matching profiles row.
-- The role comes from user_metadata.role, set when the account is created
-- via the Supabase Admin API / dashboard (e.g. { "role": "admin" }) — this
-- is how the very first Admin account gets a role without tripping the
-- insert policy above, since the trigger runs as SECURITY DEFINER.
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
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper for RLS policies on future client-owned tables (policies, claims,
-- tasks, etc. — see docs/BLUEPRINT.md §05), so they don't repeat the
-- profiles subquery. Usage: `using (public.current_role() = 'admin')`.
create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;
