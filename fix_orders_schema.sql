-- =========================================================
-- TFB Orders Schema Fix
-- Run this in Supabase SQL Editor → New Query → Run
-- =========================================================

-- 1. Drop and recreate orders table with all required columns
-- =========================================================
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;

CREATE TABLE public.orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz DEFAULT now(),
  order_number    text,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status          text DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'delivered')),
  kind            text DEFAULT 'regular' CHECK (kind IN ('regular', 'personalized', 'group')),
  payment_status  text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  subtotal        numeric DEFAULT 0,
  gst_amount      numeric DEFAULT 0,
  total           numeric DEFAULT 0,
  delivery_date   date,
  delivery_details jsonb,
  notes           text,
  customer_name   text
);

-- 2. Create order_items table
-- =========================================================
CREATE TABLE public.order_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id  text,
  quantity      integer DEFAULT 1,
  unit_price    numeric DEFAULT 0,
  item_name     text
);

-- 3. Enable RLS on both tables
-- =========================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for orders
-- =========================================================
-- Customers can insert their own orders
CREATE POLICY "Customers can place orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Customers can view their own orders
CREATE POLICY "Customers can view own orders"
ON public.orders FOR SELECT TO authenticated
USING (auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'kitchen')
  )
);

-- Kitchen and admin can update order status
CREATE POLICY "Staff can update orders"
ON public.orders FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'kitchen')
  )
);

-- 5. RLS Policies for order_items
-- =========================================================
CREATE POLICY "order_items select"
ON public.order_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "order_items insert"
ON public.order_items FOR INSERT TO authenticated WITH CHECK (true);

-- 6. Enable Realtime on orders table
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Done!
SELECT 'Orders schema fix applied successfully!' as result;
