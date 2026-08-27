-- Aangi Associates CRM — core data modules (Build Order step 6):
-- Client CRM, Associate/Staff onboarding, shared task allotment engine,
-- and calculator defaults (read by the public website). Additive-only.

-- ── Clients (household & policy roster) ────────────────────────────────
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  city text,
  household_name text,
  owner_id uuid references public.profiles (id),
  portal_user_id uuid unique references auth.users (id),
  created_at timestamptz not null default now()
);

create index clients_owner_idx on public.clients (owner_id);
create index clients_portal_user_idx on public.clients (portal_user_id);

alter table public.clients enable row level security;

create policy "clients_admin_staff_all"
  on public.clients for all
  using (public.current_role() in ('admin', 'staff'))
  with check (public.current_role() in ('admin', 'staff'));

create policy "clients_associate_select_own"
  on public.clients for select
  using (public.current_role() = 'associate' and owner_id = auth.uid());

create policy "clients_associate_update_own"
  on public.clients for update
  using (public.current_role() = 'associate' and owner_id = auth.uid());

create policy "clients_self_select"
  on public.clients for select
  using (public.current_role() = 'client' and portal_user_id = auth.uid());

-- ── Client policies (bound/issued policies) ─────────────────────────────
create table public.client_policies (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  policy_number text,
  insurer text not null default 'TATA AIA',
  product_type text not null,
  sum_assured numeric,
  premium numeric,
  start_date date,
  renewal_date date,
  status text not null default 'active' check (status in ('active', 'lapsed', 'matured')),
  created_at timestamptz not null default now()
);

create index client_policies_client_idx on public.client_policies (client_id);
create index client_policies_renewal_idx on public.client_policies (renewal_date);

alter table public.client_policies enable row level security;

create policy "client_policies_admin_staff_all"
  on public.client_policies for all
  using (public.current_role() in ('admin', 'staff'))
  with check (public.current_role() in ('admin', 'staff'));

create policy "client_policies_associate_select_own"
  on public.client_policies for select
  using (
    public.current_role() = 'associate'
    and exists (select 1 from public.clients c where c.id = client_id and c.owner_id = auth.uid())
  );

create policy "client_policies_self_select"
  on public.client_policies for select
  using (
    public.current_role() = 'client'
    and exists (select 1 from public.clients c where c.id = client_id and c.portal_user_id = auth.uid())
  );

-- ── Opportunities (sales pipeline: Inquiry → Quote → Application → Underwriting → Bind/Issue) ──
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  product_type text not null,
  stage text not null default 'inquiry' check (stage in ('inquiry', 'quote', 'application', 'underwriting', 'bind_issue')),
  owner_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index opportunities_client_idx on public.opportunities (client_id);

alter table public.opportunities enable row level security;

create policy "opportunities_admin_staff_all"
  on public.opportunities for all
  using (public.current_role() in ('admin', 'staff'))
  with check (public.current_role() in ('admin', 'staff'));

create policy "opportunities_associate_own"
  on public.opportunities for all
  using (public.current_role() = 'associate' and owner_id = auth.uid())
  with check (public.current_role() = 'associate' and owner_id = auth.uid());

-- ── Claims (mirrors the public 4-step claim assistance system) ─────────
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  policy_id uuid references public.client_policies (id),
  stage text not null default 'notified' check (stage in ('notified', 'documentation', 'insurer_liaison', 'settled')),
  notified_at timestamptz not null default now(),
  settled_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index claims_client_idx on public.claims (client_id);

alter table public.claims enable row level security;

create policy "claims_admin_staff_all"
  on public.claims for all
  using (public.current_role() in ('admin', 'staff'))
  with check (public.current_role() in ('admin', 'staff'));

create policy "claims_associate_select_own"
  on public.claims for select
  using (
    public.current_role() = 'associate'
    and exists (select 1 from public.clients c where c.id = client_id and c.owner_id = auth.uid())
  );

create policy "claims_self_select"
  on public.claims for select
  using (
    public.current_role() = 'client'
    and exists (select 1 from public.clients c where c.id = client_id and c.portal_user_id = auth.uid())
  );

-- ── Communications (every WhatsApp/call/email touchpoint) ──────────────
create table public.communications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'call', 'email', 'other')),
  notes text,
  occurred_at timestamptz not null default now(),
  logged_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index communications_client_idx on public.communications (client_id);

alter table public.communications enable row level security;

create policy "communications_admin_staff_all"
  on public.communications for all
  using (public.current_role() in ('admin', 'staff'))
  with check (public.current_role() in ('admin', 'staff'));

create policy "communications_associate_own"
  on public.communications for all
  using (
    public.current_role() = 'associate'
    and exists (select 1 from public.clients c where c.id = client_id and c.owner_id = auth.uid())
  )
  with check (
    public.current_role() = 'associate'
    and exists (select 1 from public.clients c where c.id = client_id and c.owner_id = auth.uid())
  );

-- ── Candidates (Associate/Staff onboarding tracks) ──────────────────────
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  city text,
  occupation text,
  track text not null check (track in ('associate', 'staff')),
  stage text not null default 'application',
  source text not null default 'manual',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.candidates enable row level security;

create policy "candidates_admin_staff_all"
  on public.candidates for all
  using (public.current_role() in ('admin', 'staff'))
  with check (public.current_role() in ('admin', 'staff'));

-- ── Tasks (shared task allotment engine) ────────────────────────────────
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references public.profiles (id),
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  linked_client_id uuid references public.clients (id),
  linked_candidate_id uuid references public.candidates (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index tasks_assigned_idx on public.tasks (assigned_to);

alter table public.tasks enable row level security;

create policy "tasks_admin_staff_all"
  on public.tasks for all
  using (public.current_role() in ('admin', 'staff'))
  with check (public.current_role() in ('admin', 'staff'));

create policy "tasks_associate_own"
  on public.tasks for select
  using (public.current_role() = 'associate' and assigned_to = auth.uid());

create policy "tasks_associate_update_own"
  on public.tasks for update
  using (public.current_role() = 'associate' and assigned_to = auth.uid())
  with check (public.current_role() = 'associate' and assigned_to = auth.uid());

-- ── Calculator defaults (public read — fetched by the static website) ──
create table public.calculator_config (
  id int primary key default 1 check (id = 1), -- singleton row
  self_consumption_pct numeric not null default 20,
  income_growth_pct numeric not null default 5,
  discount_rate_pct numeric not null default 8,
  edu_inflation_pct numeric not null default 9,
  edu_return_pct numeric not null default 12,
  sip_return_pct numeric not null default 12,
  retirement_inflation_pct numeric not null default 6,
  pre_retirement_return_pct numeric not null default 12,
  post_retirement_return_pct numeric not null default 7,
  default_retirement_age int not null default 60,
  default_life_expectancy int not null default 85,
  updated_at timestamptz not null default now()
);

insert into public.calculator_config (id) values (1);

alter table public.calculator_config enable row level security;

create policy "calculator_config_public_read"
  on public.calculator_config for select
  using (true);

create policy "calculator_config_admin_write"
  on public.calculator_config for update
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');
