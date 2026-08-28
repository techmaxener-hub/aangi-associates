-- Database index review (roadmap item 30): a pass over the query
-- patterns actually in the codebase today, adding only indexes that
-- match a real query already being run -- not speculative coverage for
-- hypothetical future queries. Additive-only (see CLAUDE.md).

-- AdminDashboard.tsx + NotificationStrip.tsx both run
-- .eq("status","active").gte("renewal_date", X).lte("renewal_date", Y) --
-- a composite index matches that filter shape better than the existing
-- single-column renewal_date index (0004_crm_core.sql).
create index client_policies_status_renewal_idx on public.client_policies (status, renewal_date);

-- AdminDashboard.tsx runs .neq("stage", "settled") across all claims (the
-- "Open Claims" KPI) -- currently a full-table scan with no index on stage.
create index claims_stage_idx on public.claims (stage);

-- NotificationStrip.tsx runs
-- .eq("assigned_to", me).neq("status","done").eq("due_date", today) --
-- a composite on the two most selective columns serves this better than
-- the existing assigned_to-only index (0004_crm_core.sql).
create index tasks_assigned_due_idx on public.tasks (assigned_to, due_date);

-- CallLogsDesk.tsx lists all calls ordered by created_at desc, with no
-- client scoping -- this table has no index at all on created_at today,
-- and call logs are exactly the kind of table that grows fast once a
-- telephony/voice-AI provider is actually wired up.
create index calls_created_at_idx on public.calls (created_at desc);
