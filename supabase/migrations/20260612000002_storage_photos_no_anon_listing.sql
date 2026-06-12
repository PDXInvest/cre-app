-- Lockdown part 3: stop anonymous file listing on property-photos.
-- The bucket is public, so photo URLs (app, OMs, exported PDFs) are served
-- directly and bypass RLS — no SELECT policy is needed for display. The
-- broad public SELECT policy only enabled storage.list() enumeration of
-- every filename in the bucket, which nothing uses. Scope read to
-- authenticated instead (clears lint 0025 public_bucket_allows_listing).
--
-- Run in the Supabase dashboard SQL editor. If it fails with "must be owner
-- of table objects", make the same change in Storage -> Policies instead:
-- delete "Public read for property-photos" and add a SELECT policy for the
-- authenticated role with using: bucket_id = 'property-photos'.

begin;

drop policy if exists "Public read for property-photos" on storage.objects;
drop policy if exists "Authenticated read for property-photos" on storage.objects;

create policy "Authenticated read for property-photos" on storage.objects
  for select to authenticated using (bucket_id = 'property-photos');

commit;
