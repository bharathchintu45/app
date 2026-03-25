-- Fix: Add missing RLS policy allowing customers to update their own profile.
-- The master_repair migration (20260322000002) dropped this policy but forgot to recreate it.
-- Without this, all customer profile updates (address saves, name changes, etc.) silently fail.

-- Ensure it's clean
DROP POLICY IF EXISTS "Users: update own" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Allow users to update their own profile row
CREATE POLICY "Users: update own"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

SELECT 'Profiles UPDATE policy for users restored!' as result;
