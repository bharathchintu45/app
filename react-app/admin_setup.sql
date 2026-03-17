-- ==========================================
-- NUCLEAR RLS RESET & FIX SCRIPT
-- ==========================================

-- 1. Dynamically wipe out EVERY SINGLE policy on the profiles table
-- This guarantees no rogue recursive policies survive, regardless of what they are named.
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.profiles';
    END LOOP;
END $$;

-- 2. Ensure RLS is enabled on the table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create the simplest, non-recursive policies possible exactly once

-- READ: Anyone who is logged in can read the profiles table. 
-- This completely avoids the infinite recursion loop because it doesn't check the table to grant access.
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles
FOR SELECT 
TO authenticated 
USING (true);

-- INSERT: Users can only create their own profile
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- UPDATE: Users can only update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- DELETE: Only users can delete their own profile
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE 
TO authenticated 
USING (auth.uid() = id);

-- ==========================================
-- DONE!
-- ==========================================
