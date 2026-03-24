-- =================================================================================
-- FIX: Add RLS policies for 'delivery' role on orders & order_items tables
-- Simple approach: allow delivery users to view/update all orders (like kitchen)
-- =================================================================================

-- Delivery users can view orders assigned to them
DROP POLICY IF EXISTS "Delivery can view assigned orders" ON public.orders;
CREATE POLICY "Delivery can view assigned orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'delivery'
  );

-- Delivery users can update orders (to write OTP and mark delivered)
DROP POLICY IF EXISTS "Delivery can update assigned orders" ON public.orders;
CREATE POLICY "Delivery can update assigned orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'delivery'
  );

-- Delivery users can view order items
DROP POLICY IF EXISTS "Delivery can view assigned order items" ON public.order_items;
CREATE POLICY "Delivery can view assigned order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'delivery'
  );

SELECT 'Delivery RLS policies applied successfully' AS status;
