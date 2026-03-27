-- =================================================================================
-- SUPABASE SCHEMA UPDATE: Frontend Sync
-- This script safely adds missing columns and tables needed by the frontend AppUser
-- and OrderReceipt types without destroying existing data.
-- =================================================================================

-- 1. ADD MISSING COLUMNS TO PROFILES
-- =================================================================================
-- dietary_goal: PlanType ("breakfast" | "lunch" | "dinner" | "lunch-dinner" | "complete")
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dietary_goal text;

-- is_pro: boolean for AR features
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_pro boolean DEFAULT false;

-- pro_expiry: timestamp for when Pro subscription ends
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pro_expiry timestamptz;

-- health_score: numeric value for gamification tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS health_score integer DEFAULT 0;

-- default_delivery: JSONB object containing DeliveryDetails 
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_delivery jsonb;

-- saved_addresses: JSONB array of DeliveryDetails objects
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS saved_addresses jsonb DEFAULT '[]'::jsonb;


-- 2. CREATE MENU ITEMS AND ORDERS TABLES (For E-Commerce Checkout Flow)
-- =================================================================================
-- It appears these tables were missing from your current Supabase instance.
-- We are creating them fully here, including the new fields.

CREATE TABLE IF NOT EXISTS public.menu_items (
  id TEXT PRIMARY KEY, -- e.g., 'B-1', 'L-1'
  category TEXT NOT NULL, -- Breakfast, Lunch, Dinner, Snack
  name TEXT NOT NULL,
  description TEXT,
  calories INTEGER,
  protein INTEGER,
  carbs INTEGER,
  fat INTEGER,
  fiber INTEGER,
  price_inr INTEGER,
  available BOOLEAN DEFAULT TRUE,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Force add the description column just in case the table was already created without it
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL, -- e.g., 'TFB-XXXXXX'
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  delivery_date DATE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, out_for_delivery, delivered, cancelled
  kind text DEFAULT 'regular', -- regular, personalized, group
  payment_status text DEFAULT 'pending',
  subtotal integer DEFAULT 0,
  gst_amount integer DEFAULT 0,
  total integer DEFAULT 0,
  delivery_details jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Basic Policies for Menu and Orders
DROP POLICY IF EXISTS "Anyone can view menu items" ON public.menu_items;
CREATE POLICY "Anyone can view menu items" ON public.menu_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
CREATE POLICY "Users can create their own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 3. CREATE ORDER_ITEMS TABLE (For Carts and checkout flows)
-- =================================================================================
-- Because one order can contain many items (especially group orders), 
-- we need an order_items table instead of just relying on the single menu_item_id in orders.

CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id text NOT NULL REFERENCES public.menu_items(id),
    quantity integer NOT NULL DEFAULT 1,
    unit_price integer NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS on the new table
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see the items for their own orders
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

-- =================================================================================
-- UPDATE COMPLETE
-- =================================================================================
