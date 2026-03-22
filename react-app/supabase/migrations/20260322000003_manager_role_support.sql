-- Add 'manager' support to TFB staff role checks
-- This ensures RLS policies correctly identify managers as staff.

-- 1. Update the is_staff() helper function
-- Now includes: admin, kitchen, manager, delivery
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'kitchen', 'manager', 'delivery')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 2. Update the check_is_admin() helper function
-- Includes 'admin' and optionally 'manager' for high-level operations.
-- For now, we'll keep it strict for admin only, but allow managers in a separate check if needed.
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 3. Create a dedicated Manager check for clean RLS policies
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 4. Apply these to the app_settings table (ensure managers can see settings but not edit them)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers/Admins can view settings" ON public.app_settings;
CREATE POLICY "Managers/Admins can view settings" 
ON public.app_settings FOR SELECT 
USING (public.is_manager_or_admin());

SELECT 'Manager role support added successfully!' as result;
