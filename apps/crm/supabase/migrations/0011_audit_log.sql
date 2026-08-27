-- Admin audit log: who changed what, when, across profiles, policies,
-- and pipeline/claim stage moves. Additive-only (see CLAUDE.md).

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);

create index audit_log_record_idx on public.audit_log (table_name, record_id);
create index audit_log_changed_at_idx on public.audit_log (changed_at desc);

alter table public.audit_log enable row level security;

-- Admin-only read. No insert/update/delete policy is granted to any
-- client role -- the only writer is the SECURITY DEFINER trigger function
-- below, which (as the table owner) bypasses RLS entirely.
create policy "audit_log_admin_select"
  on public.audit_log for select
  using (public.current_role() = 'admin');

create or replace function public.log_audit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (table_name, record_id, action, changed_by, old_data, new_data)
  values (
    TG_TABLE_NAME,
    coalesce(NEW.id, OLD.id),
    lower(TG_OP),
    auth.uid(),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(NEW) else null end
  );
  return coalesce(NEW, OLD);
end;
$$;

create trigger audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.log_audit();

create trigger audit_client_policies
  after insert or update or delete on public.client_policies
  for each row execute function public.log_audit();

create trigger audit_opportunities
  after insert or update or delete on public.opportunities
  for each row execute function public.log_audit();

create trigger audit_claims
  after insert or update or delete on public.claims
  for each row execute function public.log_audit();
