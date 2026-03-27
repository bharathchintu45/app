-- ==========================================================================
-- HARDEN PROFILES: Prevent users from changing their own role
-- ==========================================================================
-- VULNERABILITY: The "Users: update own" RLS policy allows users to update
-- ANY column on their own profile row, including the `role` column.
-- A malicious user could run:
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id)
-- from the browser console and gain full admin access.
--
-- FIX: A BEFORE UPDATE trigger that rejects any attempt to change the role
-- column unless the caller is already an admin. This is server-side and
-- cannot be bypassed from the client.
-- ==========================================================================

-- 1. Create a trigger function that blocks role changes by non-admins
CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If the role is being changed...
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Only allow admins to change roles
    IF NOT public.check_is_admin() THEN
      RAISE EXCEPTION 'You are not authorized to change your own role.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop if exists to avoid duplicates
DROP TRIGGER IF EXISTS trg_prevent_self_role_change ON public.profiles;

-- 3. Attach trigger to profiles table
CREATE TRIGGER trg_prevent_self_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_role_change();

-- 4. Also add a CHECK constraint to limit valid roles (defense in depth)
-- First drop it if it already exists
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'admin', 'kitchen', 'delivery', 'manager'));

SELECT 'Profiles role hardening complete — self-promotion blocked!' as result;
