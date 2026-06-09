-- Enable Row Level Security with permissive "Allow all" policies on the 7 tables
-- that Supabase flagged with RLS disabled.
--
-- Context: this is a single-user app that talks to Supabase with the anon key,
-- so the anon role is expected to have full data access. These permissive
-- policies satisfy Supabase's RLS requirement without restricting access, and
-- mirror the pattern already used on app_settings / proposal_financials /
-- rent_roll_units ("Allow all for <table>", ALL, public, using true / check true).
--
-- Idempotent and transactional: safe to re-run. Drops any prior permissive policy
-- (including the interim unqualified "Allow all" name) before creating the
-- normalized "Allow all for <table>" policy, all inside one transaction so the
-- tables are never momentarily left without a policy.

begin;

-- properties
alter table public.properties enable row level security;
drop policy if exists "Allow all" on public.properties;
drop policy if exists "Allow all for properties" on public.properties;
create policy "Allow all for properties" on public.properties
  for all to public using (true) with check (true);

-- comp_selections
alter table public.comp_selections enable row level security;
drop policy if exists "Allow all" on public.comp_selections;
drop policy if exists "Allow all for comp_selections" on public.comp_selections;
create policy "Allow all for comp_selections" on public.comp_selections
  for all to public using (true) with check (true);

-- comps
alter table public.comps enable row level security;
drop policy if exists "Allow all" on public.comps;
drop policy if exists "Allow all for comps" on public.comps;
create policy "Allow all for comps" on public.comps
  for all to public using (true) with check (true);

-- monthly_financials
alter table public.monthly_financials enable row level security;
drop policy if exists "Allow all" on public.monthly_financials;
drop policy if exists "Allow all for monthly_financials" on public.monthly_financials;
create policy "Allow all for monthly_financials" on public.monthly_financials
  for all to public using (true) with check (true);

-- units
alter table public.units enable row level security;
drop policy if exists "Allow all" on public.units;
drop policy if exists "Allow all for units" on public.units;
create policy "Allow all for units" on public.units
  for all to public using (true) with check (true);

-- proposal_dashboard
alter table public.proposal_dashboard enable row level security;
drop policy if exists "Allow all" on public.proposal_dashboard;
drop policy if exists "Allow all for proposal_dashboard" on public.proposal_dashboard;
create policy "Allow all for proposal_dashboard" on public.proposal_dashboard
  for all to public using (true) with check (true);

-- proposals
alter table public.proposals enable row level security;
drop policy if exists "Allow all" on public.proposals;
drop policy if exists "Allow all for proposals" on public.proposals;
create policy "Allow all for proposals" on public.proposals
  for all to public using (true) with check (true);

commit;
