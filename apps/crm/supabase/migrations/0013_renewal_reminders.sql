-- Renewal notification cadence (60/30/14 days before a policy's
-- renewal_date). Runs entirely inside Postgres via pg_cron + pg_net — no
-- separate Edge Function needed, so unlike telephony (which needs a real
-- Exotel/Sarvam account before any of it can run), milestone detection and
-- logging here work for real today. Only the actual WhatsApp send is
-- gated on the same "whatsapp" provider credentials already stored under
-- the Lead Ingestion Hub (public.integration_settings) — if those aren't
-- configured yet, reminders still generate and log, just marked
-- 'skipped_no_credentials' instead of silently doing nothing.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table public.renewal_reminders (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.client_policies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  milestone_days integer not null check (milestone_days in (60, 30, 14)),
  renewal_date date not null,
  scheduled_for date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped_no_credentials', 'failed')),
  channel text not null default 'whatsapp',
  sent_at timestamptz,
  error_detail text,
  created_at timestamptz not null default now(),
  unique (policy_id, milestone_days, renewal_date)
);

create index renewal_reminders_status_idx on public.renewal_reminders (status);
create index renewal_reminders_client_idx on public.renewal_reminders (client_id);

alter table public.renewal_reminders enable row level security;

create policy "renewal_reminders_admin_staff_all"
  on public.renewal_reminders for all
  using (public.current_role() in ('admin', 'staff'))
  with check (public.current_role() in ('admin', 'staff'));

create policy "renewal_reminders_associate_select_own"
  on public.renewal_reminders for select
  using (
    public.current_role() = 'associate'
    and exists (select 1 from public.clients c where c.id = renewal_reminders.client_id and c.owner_id = auth.uid())
  );

-- security definer + fixed search_path: this must run unattended under
-- pg_cron (no auth.uid() session), and it needs to both bypass client_policies/
-- clients/integration_settings RLS (to scan every record) and reach the
-- extensions schema for net.http_post. It is intentionally NOT granted to
-- `authenticated`/`anon` — only reachable via the cron job below or a
-- direct SQL session, never as a client-callable RPC (that would let any
-- logged-in user trigger mass WhatsApp sends).
create or replace function public.generate_and_dispatch_renewal_reminders()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  wa_creds jsonb;
  wa_token text;
  wa_phone_id text;
  rec record;
  msg text;
  inserted_id uuid;
  net_request_id bigint;
begin
  select credentials into wa_creds
    from public.integration_settings
    where provider = 'whatsapp' and status = 'connected';

  wa_token := wa_creds ->> 'system_token';
  wa_phone_id := wa_creds ->> 'phone_number_id';

  for rec in
    select cp.id as policy_id, cp.client_id, cp.renewal_date, cp.product_type,
           c.full_name, c.phone, m.days as milestone_days
    from public.client_policies cp
    join public.clients c on c.id = cp.client_id
    cross join (values (60), (30), (14)) as m(days)
    where cp.status = 'active'
      and cp.renewal_date = current_date + m.days
  loop
    insert into public.renewal_reminders (policy_id, client_id, milestone_days, renewal_date, status)
    values (rec.policy_id, rec.client_id, rec.milestone_days, rec.renewal_date, 'pending')
    on conflict (policy_id, milestone_days, renewal_date) do nothing
    returning id into inserted_id;

    -- Already logged for this policy/milestone/cycle (e.g. job re-run same
    -- day) — don't re-send.
    if inserted_id is null then
      continue;
    end if;

    if wa_token is null or wa_phone_id is null then
      update public.renewal_reminders set status = 'skipped_no_credentials'
        where id = inserted_id;
      continue;
    end if;

    msg := format(
      'Hi %s, this is a reminder from Aangi Associates: your %s policy is due for renewal on %s (in %s days). Reply here or call us to renew without a break in cover.',
      rec.full_name, rec.product_type, to_char(rec.renewal_date, 'DD Mon YYYY'), rec.milestone_days
    );

    begin
      -- pg_net is async — this queues the HTTP call and returns a request
      -- id immediately; it does not wait for (or guarantee) a WhatsApp
      -- delivery receipt. 'sent' here means "handed off to pg_net", the
      -- same honest boundary telephony-webhook draws around its own
      -- WhatsApp dispatch. A delivery-status webhook would be a separate,
      -- future piece of work.
      select net.http_post(
        url := 'https://graph.facebook.com/v18.0/' || wa_phone_id || '/messages',
        headers := jsonb_build_object('Authorization', 'Bearer ' || wa_token, 'Content-Type', 'application/json'),
        body := jsonb_build_object(
          'messaging_product', 'whatsapp',
          'to', rec.phone,
          'type', 'text',
          'text', jsonb_build_object('body', msg)
        )
      ) into net_request_id;

      update public.renewal_reminders set status = 'sent', sent_at = now()
        where id = inserted_id;
    exception when others then
      update public.renewal_reminders set status = 'failed', error_detail = sqlerrm
        where id = inserted_id;
    end;
  end loop;
end;
$$;

select cron.schedule(
  'generate-and-dispatch-renewal-reminders',
  '0 3 * * *',
  $$select public.generate_and_dispatch_renewal_reminders();$$
);
