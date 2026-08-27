-- Aangi Associates CRM — lead ingestion integrations + inbound leads.
-- Additive-only: never edit this file after it has been applied against a
-- real project; add a new migration instead (see CLAUDE.md).

create table public.integration_settings (
  provider text primary key,
  category text not null,
  display_name text not null,
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'pending')),
  credentials jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

alter table public.integration_settings enable row level security;

-- Admin-only. Note: this keeps credentials behind RLS — never shipped in the
-- client bundle, never in localStorage — but it is NOT Supabase Vault-grade
-- encryption at rest. If these become live, high-value production secrets,
-- migrate to Vault + a service-role Edge Function instead.
create policy "integration_settings_admin_all"
  on public.integration_settings
  for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  city text,
  lead_type text,
  source text not null default 'manual',
  owner text,
  notes text,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'converted', 'dropped')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

create index leads_phone_idx on public.leads (phone);
create index leads_email_idx on public.leads (email);

alter table public.leads enable row level security;

-- Admin-only for now. Staff/Associate access lands with the full Client CRM
-- pipeline (docs/BLUEPRINT.md §05A/B) in a later migration.
create policy "leads_admin_all"
  on public.leads
  for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');
