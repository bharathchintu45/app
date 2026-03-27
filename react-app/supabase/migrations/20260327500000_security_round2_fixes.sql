-- =====================================================
-- ROUND 2: Fix remaining security issues
-- =====================================================

-- 1. FIX is_staff() — missing delivery and manager roles
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'kitchen', 'delivery', 'manager')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 2. FIX check_is_staff() — also missing delivery and manager
CREATE OR REPLACE FUNCTION public.check_is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'kitchen', 'delivery', 'manager')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 3. Tighten policies from {public} to {authenticated}
DROP POLICY IF EXISTS "Users: insert own" ON public.profiles;
CREATE POLICY "Users: insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users: update own" ON public.profiles;
CREATE POLICY "Users: update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users: insert own" ON public.orders;
CREATE POLICY "Users: insert own" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users: insert own" ON public.subscriptions;
CREATE POLICY "Users: insert own" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users: update own" ON public.subscriptions;
CREATE POLICY "Users: update own" ON public.subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users: insert own order items" ON public.order_items;
CREATE POLICY "Users: insert own order items" ON public.order_items FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
