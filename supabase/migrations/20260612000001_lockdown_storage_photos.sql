-- Lockdown part 2: property-photos storage bucket.
-- Reads stay public (the bucket is public; photo URLs are embedded in the app
-- and OMs), but uploads/deletes now require a signed-in user.
--
-- Run separately from part 1. On newer Supabase projects the SQL editor's
-- postgres role may not own storage.objects and this will fail with
-- "must be owner of table objects" — in that case create the equivalent
-- policies in the dashboard instead: Storage -> Policies -> property-photos:
--   SELECT  -> roles: public        -> using: true
--   INSERT  -> roles: authenticated -> with check: true
--   UPDATE  -> roles: authenticated -> using: true
--   DELETE  -> roles: authenticated -> using: true
-- ...and delete any existing policies on the bucket that allow anon writes.

begin;

-- Drop every existing policy on storage.objects (this project has a single
-- bucket, so nothing else is affected), then recreate scoped policies.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy "Public read for property-photos" on storage.objects
  for select to public using (bucket_id = 'property-photos');

create policy "Authenticated insert for property-photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'property-photos');

create policy "Authenticated update for property-photos" on storage.objects
  for update to authenticated using (bucket_id = 'property-photos') with check (bucket_id = 'property-photos');

create policy "Authenticated delete for property-photos" on storage.objects
  for delete to authenticated using (bucket_id = 'property-photos');

commit;
