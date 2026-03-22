-- ==========================================
-- THE FIT BOWLS: MASTER DATA RECOVERY SCRIPT
-- ==========================================
-- This script fixes "empty dashboard" issues by correctly setting up
-- role-based access without recursion loops.

-- 1. UTILITY FUNCTION: Safe Admin Check
-- This function runs with the privileges of the creator (postgres)
-- to bypass RLS when checking a user's role.
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 2. RESET PROFILES RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

-- Allow EVERYONE to see their own row (minimum) and admins to see all
CREATE POLICY "Users: view own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins: view all" ON public.profiles FOR SELECT USING (public.check_is_admin());
CREATE POLICY "Admins: update all" ON public.profiles FOR UPDATE USING (public.check_is_admin());

-- 3. RESET ORDERS RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can select any order" ON public.orders;
DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins: full access to orders" ON public.orders;

CREATE POLICY "Admins: full access" ON public.orders FOR ALL USING (public.check_is_admin());

-- 4. RESET SUBSCRIPTIONS RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins: full access to subscriptions" ON public.subscriptions;

CREATE POLICY "Admins: full access" ON public.subscriptions FOR ALL USING (public.check_is_admin());

-- 5. RESET MENU ITEMS RLS (Ensures Catalog works)
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Admins can update menu items" ON public.menu_items;

CREATE POLICY "Public: view" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Admins: manage" ON public.menu_items FOR ALL USING (public.check_is_admin());

-- 6. EMERGENCY ROLE FIX
-- Replace 'USER_EMAIL_HERE' with your email and run this to ensure you are an admin.
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'USER_EMAIL_HERE';

-- 7. DIAGNOSTIC CHECK
SELECT 
  (SELECT count(*) FROM public.menu_items) as items_count,
  (SELECT count(*) FROM public.orders) as orders_count,
  (SELECT count(*) FROM public.subscriptions) as subs_count,
  (SELECT role FROM public.profiles WHERE id = auth.uid()) as your_current_role;
