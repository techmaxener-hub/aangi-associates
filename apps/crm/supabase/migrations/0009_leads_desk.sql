-- Leads Desk: status management + one-click convert-to-client.
-- Additive-only: never edit an applied migration (see CLAUDE.md).

alter table public.leads add column converted_client_id uuid references public.clients (id);
alter table public.leads add column updated_at timestamptz not null default now();

-- Leads were admin-only in 0002 (before the Client CRM pipeline existed).
-- Staff run back-office work day to day, so the Leads Desk needs the same
-- admin+staff access as public.clients.
drop policy "leads_admin_all" on public.leads;

create policy "leads_admin_staff_all"
  on public.leads
  for all
  using (public.current_role() in ('admin', 'staff'))
  with check (public.current_role() in ('admin', 'staff'));
