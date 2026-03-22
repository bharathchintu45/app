-- Fix Profiles RLS to prevent "Permissions Lockout"
-- This ensures that the 'admin' role check used in other policies can actually read the 'profiles' table.

-- 1. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Clear old policies to ensure a clean state
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 3. Policy: Users can view their own profile (CRITICAL for role checking)
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- 4. Policy: Admins can view ALL profiles (needed for Staff and Customers tabs)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
  )
);

-- 5. Policy: Admins can update ANY profile (needed for promoting/revoking staff)
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
  )
);

-- 6. Policy: Users can update their own profile (standard behavior)
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- RECOVERY: Ensure the current user is an admin if they are intended to be
-- Run this in the SQL editor if you cannot access the dashboard:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your-email@example.com';

SELECT 'Profiles RLS fixed successfully!' as result;
