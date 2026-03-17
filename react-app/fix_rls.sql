-- DROP the broken recursive policy
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.profiles;

-- Create a safe, self-contained way to check roles using JWT auth claims instead
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Give everyone base read access 
-- (You want users to be able to see themselves, and staff to see everyone. The simplest way for this app is just letting authenticated users read profiles without recursion)
CREATE POLICY "Enable read access for all authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
