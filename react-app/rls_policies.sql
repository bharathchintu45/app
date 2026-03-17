-- =================================================================================
-- THE FIT BOWLS — COMPREHENSIVE RLS POLICY FILE
-- Run this in your Supabase SQL Editor to ensure all tables are properly secured.
-- =================================================================================

-- ─── HELPER: A function to check if the current user is Admin or Kitchen Staff ──
-- We use this in multiple policies to avoid repeating the subquery.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'kitchen')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;


-- =================================================================================
-- TABLE: profiles
-- =================================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can view ALL profiles (for user management in admin portal)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- Trigger auto-creates profile on signup via the existing function
-- (No INSERT policy needed because the trigger runs as SECURITY DEFINER)


-- =================================================================================
-- TABLE: menu_items
-- =================================================================================
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- ANYONE (including unauthenticated visitors browsing the menu) can read menu items
DROP POLICY IF EXISTS "Anyone can view menu items" ON public.menu_items;
CREATE POLICY "Anyone can view menu items"
  ON public.menu_items FOR SELECT
  USING (true);

-- Only Admins can create new menu items
DROP POLICY IF EXISTS "Admins can insert menu items" ON public.menu_items;
CREATE POLICY "Admins can insert menu items"
  ON public.menu_items FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

-- Only Admins can update menu items (e.g., toggle availability, change price)
DROP POLICY IF EXISTS "Admins can update menu items" ON public.menu_items;
CREATE POLICY "Admins can update menu items"
  ON public.menu_items FOR UPDATE
  TO authenticated
  USING (public.is_staff());

-- Only Admins can delete menu items
DROP POLICY IF EXISTS "Admins can delete menu items" ON public.menu_items;
CREATE POLICY "Admins can delete menu items"
  ON public.menu_items FOR DELETE
  TO authenticated
  USING (public.is_staff());


-- =================================================================================
-- TABLE: orders
-- =================================================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Customers can view their OWN orders only
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Customers can create their own orders
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
CREATE POLICY "Users can create their own orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Staff (kitchen + admin) can view ALL orders (for kitchen dashboard and admin analytics)
DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;
CREATE POLICY "Staff can view all orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- Staff (kitchen + admin) can update order STATUS (e.g., Pending → Delivered)
DROP POLICY IF EXISTS "Staff can update order status" ON public.orders;
CREATE POLICY "Staff can update order status"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.is_staff());


-- =================================================================================
-- TABLE: order_items
-- =================================================================================
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Customers can view items that belong to their own orders
DROP POLICY IF EXISTS "Users can view order items for their own orders" ON public.order_items;
CREATE POLICY "Users can view order items for their own orders"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
      AND o.user_id = auth.uid()
    )
  );

-- Customers can insert items into their own orders (during checkout)
DROP POLICY IF EXISTS "Users can insert order items for their own orders" ON public.order_items;
CREATE POLICY "Users can insert order items for their own orders"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
      AND o.user_id = auth.uid()
    )
  );

-- Staff (kitchen + admin) can view ALL order items (for kitchen view and analytics)
DROP POLICY IF EXISTS "Staff can view all order items" ON public.order_items;
CREATE POLICY "Staff can view all order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- =================================================================================
-- RLS POLICIES COMPLETE
-- =================================================================================
