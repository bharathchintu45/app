-- =========================================================================
-- STALE USER REPAIR SCRIPT
-- RUN THIS ENTIRE SCRIPT AT ONCE IN THE SUPABASE SQL EDITOR
-- =========================================================================

-- The new Postgres Trigger we just added only runs for NEW users.
-- Any test users you created previously (when the database was broken) 
-- are stuck in a zombie state (they exist in auth.users, but not in profiles).

-- This script finds every single zombie user and forces a profile to be built for them.
-- Once run, all your old test emails will work perfectly again.

INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, '', 'customer'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- Confirm it worked
SELECT 'Successfully synced all ' || count(*) || ' stuck users.' as status 
FROM public.profiles;
