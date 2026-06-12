-- Lockdown: replace the permissive allow-all RLS policies with
-- authenticated-only access, revoke anon's table privileges, and expose a
-- single SECURITY DEFINER function so the public OM client view can still
-- read proposals.om_json (and nothing else).
--
-- Context: the app previously ran with no login and "Allow all" policies on
-- every table, meaning anyone holding the publishable anon key (shipped in
-- the JS bundle) had full read/write. The SPA now requires a Supabase Auth
-- sign-in; /om?proposal=<id> stays anonymous via get_om_json().
--
-- Idempotent and transactional: safe to re-run.

begin;

-- ------------------------------------------------------------------
-- 1. Per-table policies: authenticated-only, full access (single-user app)
-- ------------------------------------------------------------------

-- properties
alter table public.properties enable row level security;
drop policy if exists "Allow all" on public.properties;
drop policy if exists "Allow all for properties" on public.properties;
drop policy if exists "Authenticated full access for properties" on public.properties;
create policy "Authenticated full access for properties" on public.properties
  for all to authenticated using (true) with check (true);

-- proposals
alter table public.proposals enable row level security;
drop policy if exists "Allow all" on public.proposals;
drop policy if exists "Allow all for proposals" on public.proposals;
drop policy if exists "Authenticated full access for proposals" on public.proposals;
create policy "Authenticated full access for proposals" on public.proposals
  for all to authenticated using (true) with check (true);

-- comps
alter table public.comps enable row level security;
drop policy if exists "Allow all" on public.comps;
drop policy if exists "Allow all for comps" on public.comps;
drop policy if exists "Authenticated full access for comps" on public.comps;
create policy "Authenticated full access for comps" on public.comps
  for all to authenticated using (true) with check (true);

-- comp_selections
alter table public.comp_selections enable row level security;
drop policy if exists "Allow all" on public.comp_selections;
drop policy if exists "Allow all for comp_selections" on public.comp_selections;
drop policy if exists "Authenticated full access for comp_selections" on public.comp_selections;
create policy "Authenticated full access for comp_selections" on public.comp_selections
  for all to authenticated using (true) with check (true);

-- monthly_financials
alter table public.monthly_financials enable row level security;
drop policy if exists "Allow all" on public.monthly_financials;
drop policy if exists "Allow all for monthly_financials" on public.monthly_financials;
drop policy if exists "Authenticated full access for monthly_financials" on public.monthly_financials;
create policy "Authenticated full access for monthly_financials" on public.monthly_financials
  for all to authenticated using (true) with check (true);

-- units
alter table public.units enable row level security;
drop policy if exists "Allow all" on public.units;
drop policy if exists "Allow all for units" on public.units;
drop policy if exists "Authenticated full access for units" on public.units;
create policy "Authenticated full access for units" on public.units
  for all to authenticated using (true) with check (true);

-- proposal_dashboard
alter table public.proposal_dashboard enable row level security;
drop policy if exists "Allow all" on public.proposal_dashboard;
drop policy if exists "Allow all for proposal_dashboard" on public.proposal_dashboard;
drop policy if exists "Authenticated full access for proposal_dashboard" on public.proposal_dashboard;
create policy "Authenticated full access for proposal_dashboard" on public.proposal_dashboard
  for all to authenticated using (true) with check (true);

-- app_settings
alter table public.app_settings enable row level security;
drop policy if exists "Allow all" on public.app_settings;
drop policy if exists "Allow all for app_settings" on public.app_settings;
drop policy if exists "Authenticated full access for app_settings" on public.app_settings;
create policy "Authenticated full access for app_settings" on public.app_settings
  for all to authenticated using (true) with check (true);

-- proposal_financials
alter table public.proposal_financials enable row level security;
drop policy if exists "Allow all" on public.proposal_financials;
drop policy if exists "Allow all for proposal_financials" on public.proposal_financials;
drop policy if exists "Authenticated full access for proposal_financials" on public.proposal_financials;
create policy "Authenticated full access for proposal_financials" on public.proposal_financials
  for all to authenticated using (true) with check (true);

-- rent_roll_units
alter table public.rent_roll_units enable row level security;
drop policy if exists "Allow all" on public.rent_roll_units;
drop policy if exists "Allow all for rent_roll_units" on public.rent_roll_units;
drop policy if exists "Authenticated full access for rent_roll_units" on public.rent_roll_units;
create policy "Authenticated full access for rent_roll_units" on public.rent_roll_units
  for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------------
-- 2. Revoke anon's table privileges outright (belt and suspenders, and
--    clears the pg_graphql_anon_table_exposed lint — anon can no longer
--    even see these tables in the GraphQL/REST schema).
-- ------------------------------------------------------------------

revoke all on table
  public.properties,
  public.proposals,
  public.comps,
  public.comp_selections,
  public.monthly_financials,
  public.units,
  public.proposal_dashboard,
  public.app_settings,
  public.proposal_financials,
  public.rent_roll_units
from anon;

-- ------------------------------------------------------------------
-- 3. OM carve-out: anonymous readers of /om?proposal=<id> get exactly
--    om_json for one proposal, nothing else. SECURITY DEFINER bypasses
--    RLS; the empty search_path forces qualified names.
-- ------------------------------------------------------------------

create or replace function public.get_om_json(p_proposal_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select om_json from public.proposals where id = p_proposal_id;
$$;

revoke all on function public.get_om_json(uuid) from public;
grant execute on function public.get_om_json(uuid) to anon, authenticated;

commit;
