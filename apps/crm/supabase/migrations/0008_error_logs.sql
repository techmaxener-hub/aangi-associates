-- Runtime error logging: React error boundaries report here so the Admin
-- has a real view into production errors without needing a third-party
-- account (Sentry etc.). Any authenticated user can log their own error;
-- only Admin can read the log.
create table public.app_errors (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  stack text,
  component_stack text,
  url text,
  user_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.app_errors enable row level security;

create policy "app_errors_insert_own"
  on public.app_errors for insert
  with check (auth.uid() is not null);

create policy "app_errors_select_admin"
  on public.app_errors for select
  using (public.current_role() = 'admin');
