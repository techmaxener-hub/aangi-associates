-- Telephony & AI Calling Agents: call log + auto-dialer configuration.
-- Credential storage for Exotel/Sarvam/TeleCRM/SquadStack reuses the
-- existing public.integration_settings table (generic provider/category/
-- credentials shape from 0002) — no schema change needed for that part.

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  lead_name text not null,
  phone text not null,
  source_channel text,
  language_detected text,
  direction text not null default 'outbound' check (direction in ('inbound', 'outbound')),
  duration_seconds int,
  intent_score text check (intent_score in ('high', 'medium', 'low')),
  status text not null default 'logged' check (status in ('logged', 'completed', 'missed', 'voicemail')),
  recording_url text,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index calls_phone_idx on public.calls (phone);

alter table public.calls enable row level security;

create policy "calls_admin_staff_all"
  on public.calls for all
  using (public.current_role() in ('admin', 'staff'))
  with check (public.current_role() in ('admin', 'staff'));

-- Singleton row, same pattern as calculator_config (0004). Admin-only —
-- unlike calculator_config, nothing public needs to read this.
create table public.dialer_rules (
  id int primary key default 1 check (id = 1),
  delay_seconds int not null default 60,
  max_retries int not null default 3,
  post_call_whatsapp_template text not null default 'Hi {{name}}, thanks for speaking with our team at Aangi Associates. Here''s a quick summary: {{summary}}. Reply here anytime.',
  updated_at timestamptz not null default now()
);

insert into public.dialer_rules (id) values (1);

alter table public.dialer_rules enable row level security;

create policy "dialer_rules_admin_all"
  on public.dialer_rules for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');
