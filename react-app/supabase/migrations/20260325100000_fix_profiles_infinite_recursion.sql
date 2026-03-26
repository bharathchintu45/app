-- ==========================================================================
-- FIX: "infinite recursion detected in policy for relation 'profiles'"
-- ==========================================================================
-- ROOT CAUSE: Some RLS policies on the `profiles` table check if the current
-- user is an admin by doing `SELECT ... FROM profiles WHERE role = 'admin'`.
-- Since RLS is enabled on `profiles`, PostgreSQL tries to apply the same
-- policies to that sub-query, which triggers the same check again, creating
-- an infinite loop.
--
-- This ALSO cascades to `subscriptions` and `orders` tables because their
-- admin policies also do `SELECT FROM profiles` — this hits the recursive
-- profiles RLS and crashes the entire query chain.
--
-- SOLUTION: Drop ALL old policies and recreate them using ONLY:
--   1. `auth.uid() = id` (no sub-query, safe)
--   2. `public.check_is_admin()` (SECURITY DEFINER function, bypasses RLS)
-- ==========================================================================

-- =====================
-- STEP 1: HELPER FUNCTIONS (SECURITY DEFINER = bypasses RLS)
-- =====================
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.check_is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'kitchen', 'delivery', 'manager')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- =====================
-- STEP 2: FIX PROFILES TABLE
-- =====================
-- Drop ALL existing policies on profiles (clean slate)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users: view own"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Admins can read all profiles (SECURITY DEFINER, no recursion)
CREATE POLICY "Admins: view all"
ON public.profiles FOR SELECT
USING (public.check_is_admin());

-- Users can insert their own profile (sign-up)
CREATE POLICY "Users: insert own"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users: update own"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "Admins: update all"
ON public.profiles FOR UPDATE
USING (public.check_is_admin());

-- Admins can delete profiles
CREATE POLICY "Admins: delete all"
ON public.profiles FOR DELETE
USING (public.check_is_admin());

-- =====================
-- STEP 3: FIX SUBSCRIPTIONS TABLE
-- =====================
-- Drop ALL existing policies on subscriptions
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscriptions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.subscriptions', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users: view own subscriptions"
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own subscriptions (checkout)
CREATE POLICY "Users: insert own subscriptions"
ON public.subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions (holds, swaps, etc.)
CREATE POLICY "Users: update own subscriptions"
ON public.subscriptions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins have full access (uses SECURITY DEFINER, no recursion)
CREATE POLICY "Admins: full access subscriptions"
ON public.subscriptions FOR ALL
USING (public.check_is_admin())
WITH CHECK (public.check_is_admin());

-- =====================
-- STEP 4: FIX ORDERS TABLE
-- =====================
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users: view own orders"
ON public.orders FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own orders (checkout)
CREATE POLICY "Users: insert own orders"
ON public.orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins have full access
CREATE POLICY "Admins: full access orders"
ON public.orders FOR ALL
USING (public.check_is_admin())
WITH CHECK (public.check_is_admin());

-- Staff (kitchen/delivery/manager) can view and update orders
CREATE POLICY "Staff: view all orders"
ON public.orders FOR SELECT
USING (public.check_is_staff());

CREATE POLICY "Staff: update orders"
ON public.orders FOR UPDATE
USING (public.check_is_staff());

-- =====================
-- STEP 5: FIX ORDER_ITEMS TABLE
-- =====================
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_items'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.order_items', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Users can view their own order items (via join to orders)
CREATE POLICY "Users: view own order items"
ON public.order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Users can insert order items for their own orders
CREATE POLICY "Users: insert own order items"
ON public.order_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Admins have full access
CREATE POLICY "Admins: full access order items"
ON public.order_items FOR ALL
USING (public.check_is_admin())
WITH CHECK (public.check_is_admin());

-- Staff can view order items
CREATE POLICY "Staff: view order items"
ON public.order_items FOR SELECT
USING (public.check_is_staff());

-- =====================
-- DONE
-- =====================
SELECT 'All RLS policies fixed — infinite recursion eliminated!' as result;
