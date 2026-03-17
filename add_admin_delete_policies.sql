-- ================================================================
-- ADD MISSING DELETE POLICIES FOR ADMIN
-- Run this in your Supabase SQL Editor → New Query → Run
-- ================================================================

-- 1. Allow admins to DELETE orders (subscription deletion requires this)
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders"
  ON public.orders FOR DELETE
  TO authenticated
  USING (public.is_staff());

-- 2. Allow admins to DELETE order_items (needed before deleting orders)
DROP POLICY IF EXISTS "Admins can delete order items" ON public.order_items;
CREATE POLICY "Admins can delete order items"
  ON public.order_items FOR DELETE
  TO authenticated
  USING (public.is_staff());

-- 3. Allow admins to DELETE subscription_swaps
DROP POLICY IF EXISTS "Admins can delete subscription swaps" ON public.subscription_swaps;
CREATE POLICY "Admins can delete subscription swaps"
  ON public.subscription_swaps FOR DELETE
  TO authenticated
  USING (public.is_staff());

-- 4. Allow admins to DELETE subscription_holds
DROP POLICY IF EXISTS "Admins can delete subscription holds" ON public.subscription_holds;
CREATE POLICY "Admins can delete subscription holds"
  ON public.subscription_holds FOR DELETE
  TO authenticated
  USING (public.is_staff());

-- Done!
SELECT 'Admin delete policies applied successfully!' AS result;

-- ================================================================
-- ENABLE REALTIME DELETE EVENTS FOR ORDERS TABLE
-- This is required so Supabase broadcasts the deleted row's data
-- (including the ID) when an order is deleted by admin.
-- ================================================================

-- Enable REPLICA IDENTITY FULL so DELETE events include full row data
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Add orders to the realtime publication (skip if already there)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN
  -- already a member, nothing to do
  NULL;
END $$;

SELECT 'Realtime DELETE broadcasting enabled for orders!' AS result2;
