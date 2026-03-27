-- ==========================================
-- AUTHENTICATION & RLS HARDENING SCRIPT
-- ==========================================
-- This script fixes critical vulnerabilities:
-- 1. Role Escalation: Users can no longer change their own 'role'.
-- 2. Information Leak: Users can only see their own profile (Admins see all).

-- 1. Ensure RLS is enabled on the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Clean up ALL existing RLS policies on the profiles table
DO $$ 
DECLARE 
  pol record;
BEGIN 
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- 3. Define New Secure Policies

-- SELECT: Users see self, Admins see everyone.
CREATE POLICY "Users can view their own profile."
    ON public.profiles FOR SELECT
    USING ( auth.uid() = id );

CREATE POLICY "Admins can view all profiles."
    ON public.profiles FOR SELECT
    USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );

-- INSERT: Users can only insert their own row (usually handled by trigger).
CREATE POLICY "Users can insert their own profile."
    ON public.profiles FOR INSERT
    WITH CHECK ( auth.uid() = id );

-- UPDATE: Users can update their own row (BUT only specific columns via trigger protection).
CREATE POLICY "Users can update their own profile."
    ON public.profiles FOR UPDATE
    USING ( auth.uid() = id );

-- DELETE: Only users can delete themselves.
CREATE POLICY "Users can delete their own profile."
    ON public.profiles FOR DELETE
    USING ( auth.uid() = id );


-- 4. Add PROTECTION TRIGGER to block role escalation
-- This is necessary because RLS policies for UPDATE on Supabase apply to the entire row.
-- A trigger is the most robust way to protect a single sensitive column like 'role'.

CREATE OR REPLACE FUNCTION public.protect_user_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- If the caller is NOT an admin, they cannot change the role column.
  -- We use auth.uid() to check the current user's role in the DB.
  IF (
    SELECT role FROM public.profiles WHERE id = auth.uid()
  ) != 'admin' OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IS NULL THEN
    
    -- If they try to change the role, revert it to the old value.
    IF NEW.role != OLD.role THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safely recreate the trigger
DROP TRIGGER IF EXISTS ensure_role_protection ON public.profiles;
CREATE TRIGGER ensure_role_protection
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_roles();

-- 5. Final validation comment
COMMENT ON TABLE public.profiles IS 'User profiles with role-based access control and self-escalation protection.';

SELECT 'Authentication and RLS policies hardened successfully!' as result;
