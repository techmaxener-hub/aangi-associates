-- Leads Desk: assign a lead to an employee (Admin/Staff/Associate).
-- Additive-only: never edit an applied migration (see CLAUDE.md).

alter table public.leads add column assigned_to uuid references public.profiles (id);

create index leads_assigned_idx on public.leads (assigned_to);

-- Associates can see and update only leads assigned to them, mirroring the
-- public.tasks pattern (see 0004_crm_core.sql). Admin/Staff already have
-- full access via leads_admin_staff_all from 0009.
create policy "leads_associate_scoped"
  on public.leads
  for select
  using (public.current_role() = 'associate' and assigned_to = auth.uid());

create policy "leads_associate_update_own"
  on public.leads
  for update
  using (public.current_role() = 'associate' and assigned_to = auth.uid())
  with check (public.current_role() = 'associate' and assigned_to = auth.uid());
